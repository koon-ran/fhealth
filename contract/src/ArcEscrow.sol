// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title ArcEscrow
 * @author Arc Escrow Team
 * @notice Multi-Currency Invoice & Escrow Service for B2B cross-border stablecoin payments
 * @dev Implements mutual consent with dispute arbiter model
 * 
 * Fee Structure:
 * - Platform Fee: 1% (collected on all releases)
 * - Arbiter Fee: 2% (only collected during disputed releases/refunds)
 * 
 * Flow Examples:
 * 1. Normal Release (no dispute):
 *    - Payer deposits: 100 USDC
 *    - Platform fee: 1 USDC → Treasury
 *    - Payee receives: 99 USDC
 * 
 * 2. Disputed Release (arbiter releases to Payee):
 *    - Payer deposits: 100 USDC
 *    - Platform fee: 1 USDC → Treasury
 *    - Arbiter fee: 2 USDC → Arbiter
 *    - Payee receives: 97 USDC
 * 
 * 3. Disputed Refund (arbiter refunds to Payer):
 *    - Payer deposited: 100 USDC
 *    - Platform fee: 1 USDC → Treasury
 *    - Arbiter fee: 2 USDC → Arbiter
 *    - Payer gets back: 97 USDC
 */
contract ArcEscrow is ReentrancyGuard, Ownable {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice USDC contract address
    address public immutable USDC;
    
    /// @notice Treasury address for platform fees
    address public treasury;
    
    /// @notice Platform fee in basis points (100 = 1%)
    uint256 public constant PLATFORM_FEE_BPS = 100;
    
    /// @notice Arbiter fee in basis points (200 = 2%)
    uint256 public constant ARBITER_FEE_BPS = 200;
    
    /// @notice Basis points denominator (10000 = 100%)
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    /// @notice Invoice counter for unique IDs
    uint256 public invoiceCount;
    
    // ============================================
    // ENUMS
    // ============================================
    
    /// @notice Invoice lifecycle states
    enum InvoiceStatus {
        CREATED,           // Invoice exists but unfunded
        FUNDED,            // Payer deposited funds
        PENDING_APPROVAL,  // One party approved, waiting for other
        RELEASED,          // Funds sent to Payee
        REFUNDED,          // Funds returned to Payer
        DISPUTED,          // In arbitration
        CANCELLED          // Cancelled before funding
    }
    
    // ============================================
    // STRUCTS
    // ============================================
    
    /// @notice Core invoice data structure
    struct Invoice {
        uint256 id;
        address payer;
        address payee;
        address arbiter;
        uint256 amount;              // Amount in USDC (6 decimals)
        InvoiceStatus status;
        bool payerApproved;
        bool payeeApproved;
        string title;                // Invoice title/description
        string disputeReason;        // IPFS hash or short reason
        uint256 createdAt;
        uint256 fundedAt;
        uint256 resolvedAt;
    }
    
    // ============================================
    // STORAGE
    // ============================================
    
    /// @notice Mapping of invoice ID to Invoice struct
    mapping(uint256 => Invoice) public invoices;
    
    // ============================================
    // EVENTS
    // ============================================
    
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed payee,
        address arbiter,
        uint256 amount
    );
    
    event FundsDeposited(
        uint256 indexed invoiceId,
        address indexed payer,
        uint256 amount
    );
    
    event ApprovalGranted(
        uint256 indexed invoiceId,
        address indexed approver,
        bool isPayer
    );
    
    event DisputeRaised(
        uint256 indexed invoiceId,
        address indexed disputer,
        string reason
    );
    
    event ArbitrationComplete(
        uint256 indexed invoiceId,
        bool releasedToPayee,
        address indexed arbiter
    );
    
    event FundsReleased(
        uint256 indexed invoiceId,
        address indexed payee,
        uint256 amount,
        uint256 platformFee,
        uint256 arbiterFee
    );
    
    event FundsRefunded(
        uint256 indexed invoiceId,
        address indexed payer,
        uint256 amount,
        uint256 platformFee,
        uint256 arbiterFee
    );
    
    event InvoiceCancelled(
        uint256 indexed invoiceId,
        address indexed canceller
    );
    
    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );
    
    // ============================================
    // ERRORS
    // ============================================
    
    error InvalidAddress();
    error InvalidAmount();
    error InvoiceNotFound();
    error UnauthorizedAccess();
    error InvalidStatus(InvoiceStatus expected, InvoiceStatus actual);
    error AlreadyApproved();
    error InsufficientBalance();
    error TransferFailed();
    error AlreadyFunded();
    error CannotCancelFundedInvoice();
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Initialize the escrow contract
     * @param _treasury Treasury address for platform fees
     * @param _usdc USDC token address (e.g. Circle USDC on Sepolia: 0x1c7D...C7238)
     */
    constructor(address _treasury, address _usdc) Ownable(msg.sender) {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_usdc == address(0)) revert InvalidAddress();
        treasury = _treasury;
        USDC = _usdc;
    }
    
    // ============================================
    // EXTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Create a new invoice (must be funded immediately in this implementation)
     * @param _payer Address that will fund the invoice
     * @param _payee Address that will receive funds upon release
     * @param _arbiter Address that can resolve disputes
     * @param _amount Amount in USDC (6 decimals)
     * @param _title Title/description of the invoice
     * @return invoiceId The ID of the created invoice
     * @dev Invoice must be funded in the same transaction or immediately after
     */
    function createAndFundInvoice(
        address _payer,
        address _payee,
        address _arbiter,
        uint256 _amount,
        string calldata _title
    ) external nonReentrant returns (uint256 invoiceId) {
        // Validation
        if (_payer == address(0) || _payee == address(0) || _arbiter == address(0)) {
            revert InvalidAddress();
        }
        if (_amount == 0) revert InvalidAmount();
        if (_payer == _payee) revert InvalidAddress();
        
        // Increment invoice counter
        invoiceId = ++invoiceCount;
        
        // Create invoice
        Invoice storage invoice = invoices[invoiceId];
        invoice.id = invoiceId;
        invoice.payer = _payer;
        invoice.payee = _payee;
        invoice.arbiter = _arbiter;
        invoice.amount = _amount;
        invoice.title = _title;
        invoice.status = InvoiceStatus.CREATED;
        invoice.createdAt = block.timestamp;
        
        emit InvoiceCreated(invoiceId, _payer, _payee, _arbiter, _amount);
        
        // Immediately fund the invoice
        _fundInvoice(invoiceId);
        
        return invoiceId;
    }
    
    /**
     * @notice Internal function to fund an invoice
     * @param _invoiceId ID of the invoice to fund
     */
    function _fundInvoice(uint256 _invoiceId) internal {
        Invoice storage invoice = invoices[_invoiceId];
        
        // Validation
        if (invoice.id == 0) revert InvoiceNotFound();
        if (msg.sender != invoice.payer) revert UnauthorizedAccess();
        if (invoice.status != InvoiceStatus.CREATED) {
            revert InvalidStatus(InvoiceStatus.CREATED, invoice.status);
        }
        
        // Transfer USDC from payer to this contract
        bool success = IERC20(USDC).transferFrom(
            msg.sender,
            address(this),
            invoice.amount
        );
        if (!success) revert TransferFailed();
        
        // Update status
        invoice.status = InvoiceStatus.FUNDED;
        invoice.fundedAt = block.timestamp;
        
        emit FundsDeposited(_invoiceId, msg.sender, invoice.amount);
    }
    
    /**
     * @notice Approve release of funds
     * @param _invoiceId ID of the invoice to approve
     * @dev When both parties approve, funds are automatically released
     */
    function approveRelease(uint256 _invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[_invoiceId];
        
        // Validation
        if (invoice.id == 0) revert InvoiceNotFound();
        if (invoice.status != InvoiceStatus.FUNDED && 
            invoice.status != InvoiceStatus.PENDING_APPROVAL) {
            revert InvalidStatus(InvoiceStatus.FUNDED, invoice.status);
        }
        
        bool isPayer = msg.sender == invoice.payer;
        bool isPayee = msg.sender == invoice.payee;
        
        if (!isPayer && !isPayee) revert UnauthorizedAccess();
        
        // Set approval
        if (isPayer) {
            if (invoice.payerApproved) revert AlreadyApproved();
            invoice.payerApproved = true;
            emit ApprovalGranted(_invoiceId, msg.sender, true);
        } else {
            if (invoice.payeeApproved) revert AlreadyApproved();
            invoice.payeeApproved = true;
            emit ApprovalGranted(_invoiceId, msg.sender, false);
        }
        
        // Update status
        if (invoice.payerApproved && invoice.payeeApproved) {
            // Both approved - release funds
            _releaseFunds(_invoiceId, false);
        } else {
            // Only one approved - update status
            invoice.status = InvoiceStatus.PENDING_APPROVAL;
        }
    }
    
    /**
     * @notice Raise a dispute on an invoice
     * @param _invoiceId ID of the invoice to dispute
     * @param _reason IPFS hash or short description of dispute
     */
    function dispute(uint256 _invoiceId, string calldata _reason) external nonReentrant {
        Invoice storage invoice = invoices[_invoiceId];
        
        // Validation
        if (invoice.id == 0) revert InvoiceNotFound();
        if (invoice.status != InvoiceStatus.FUNDED && 
            invoice.status != InvoiceStatus.PENDING_APPROVAL) {
            revert InvalidStatus(InvoiceStatus.FUNDED, invoice.status);
        }
        if (msg.sender != invoice.payer && msg.sender != invoice.payee) {
            revert UnauthorizedAccess();
        }
        
        // Update status
        invoice.status = InvoiceStatus.DISPUTED;
        invoice.disputeReason = _reason;
        
        emit DisputeRaised(_invoiceId, msg.sender, _reason);
    }
    
    /**
     * @notice Arbiter releases funds to payee after dispute
     * @param _invoiceId ID of the disputed invoice
     */
    function arbitrateRelease(uint256 _invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[_invoiceId];
        
        // Validation
        if (invoice.id == 0) revert InvoiceNotFound();
        if (msg.sender != invoice.arbiter) revert UnauthorizedAccess();
        if (invoice.status != InvoiceStatus.DISPUTED) {
            revert InvalidStatus(InvoiceStatus.DISPUTED, invoice.status);
        }
        
        emit ArbitrationComplete(_invoiceId, true, msg.sender);
        
        // Release with arbiter fee
        _releaseFunds(_invoiceId, true);
    }
    
    /**
     * @notice Arbiter refunds funds to payer after dispute
     * @param _invoiceId ID of the disputed invoice
     */
    function arbitrateRefund(uint256 _invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[_invoiceId];
        
        // Validation
        if (invoice.id == 0) revert InvoiceNotFound();
        if (msg.sender != invoice.arbiter) revert UnauthorizedAccess();
        if (invoice.status != InvoiceStatus.DISPUTED) {
            revert InvalidStatus(InvoiceStatus.DISPUTED, invoice.status);
        }
        
        emit ArbitrationComplete(_invoiceId, false, msg.sender);
        
        // Refund with fees
        _refundFunds(_invoiceId);
    }
    
    /**
     * @notice Cancel an unfunded invoice
     * @param _invoiceId ID of the invoice to cancel
     */
    function cancelInvoice(uint256 _invoiceId) external nonReentrant {
        Invoice storage invoice = invoices[_invoiceId];
        
        // Validation
        if (invoice.id == 0) revert InvoiceNotFound();
        if (invoice.status != InvoiceStatus.CREATED) {
            revert CannotCancelFundedInvoice();
        }
        if (msg.sender != invoice.payer && msg.sender != invoice.payee) {
            revert UnauthorizedAccess();
        }
        
        invoice.status = InvoiceStatus.CANCELLED;
        invoice.resolvedAt = block.timestamp;
        
        emit InvoiceCancelled(_invoiceId, msg.sender);
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Internal function to release funds to payee
     * @param _invoiceId ID of the invoice
     * @param _isDisputed Whether this release is from arbitration
     */
    function _releaseFunds(uint256 _invoiceId, bool _isDisputed) internal {
        Invoice storage invoice = invoices[_invoiceId];
        
        uint256 totalAmount = invoice.amount;
        uint256 platformFee = (totalAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 arbiterFee = _isDisputed ? (totalAmount * ARBITER_FEE_BPS) / BPS_DENOMINATOR : 0;
        uint256 payeeAmount = totalAmount - platformFee - arbiterFee;
        
        // Update status
        invoice.status = InvoiceStatus.RELEASED;
        invoice.resolvedAt = block.timestamp;
        
        // Transfer platform fee to treasury
        bool success = IERC20(USDC).transfer(treasury, platformFee);
        if (!success) revert TransferFailed();
        
        // Transfer arbiter fee if disputed
        if (_isDisputed && arbiterFee > 0) {
            success = IERC20(USDC).transfer(invoice.arbiter, arbiterFee);
            if (!success) revert TransferFailed();
        }
        
        // Transfer remaining amount to payee
        success = IERC20(USDC).transfer(invoice.payee, payeeAmount);
        if (!success) revert TransferFailed();
        
        emit FundsReleased(_invoiceId, invoice.payee, payeeAmount, platformFee, arbiterFee);
    }
    
    /**
     * @notice Internal function to refund funds to payer
     * @param _invoiceId ID of the invoice
     */
    function _refundFunds(uint256 _invoiceId) internal {
        Invoice storage invoice = invoices[_invoiceId];
        
        uint256 totalAmount = invoice.amount;
        uint256 platformFee = (totalAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 arbiterFee = (totalAmount * ARBITER_FEE_BPS) / BPS_DENOMINATOR;
        uint256 refundAmount = totalAmount - platformFee - arbiterFee;
        
        // Update status
        invoice.status = InvoiceStatus.REFUNDED;
        invoice.resolvedAt = block.timestamp;
        
        // Transfer platform fee to treasury
        bool success = IERC20(USDC).transfer(treasury, platformFee);
        if (!success) revert TransferFailed();
        
        // Transfer arbiter fee
        success = IERC20(USDC).transfer(invoice.arbiter, arbiterFee);
        if (!success) revert TransferFailed();
        
        // Transfer remaining amount to payer
        success = IERC20(USDC).transfer(invoice.payer, refundAmount);
        if (!success) revert TransferFailed();
        
        emit FundsRefunded(_invoiceId, invoice.payer, refundAmount, platformFee, arbiterFee);
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /**
     * @notice Update treasury address
     * @param _newTreasury New treasury address
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidAddress();
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get invoice details
     * @param _invoiceId ID of the invoice
     * @return Invoice struct
     */
    function getInvoice(uint256 _invoiceId) external view returns (Invoice memory) {
        return invoices[_invoiceId];
    }
    
    /**
     * @notice Calculate fees for a given amount
     * @param _amount Amount in USDC
     * @param _isDisputed Whether arbitration is involved
     * @return platformFee Platform fee amount
     * @return arbiterFee Arbiter fee amount (0 if not disputed)
     * @return netAmount Amount after fees
     */
    function calculateFees(uint256 _amount, bool _isDisputed) 
        external 
        pure 
        returns (uint256 platformFee, uint256 arbiterFee, uint256 netAmount) 
    {
        platformFee = (_amount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        arbiterFee = _isDisputed ? (_amount * ARBITER_FEE_BPS) / BPS_DENOMINATOR : 0;
        netAmount = _amount - platformFee - arbiterFee;
    }
}
