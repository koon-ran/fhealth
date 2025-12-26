// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@fhevm/solidity/lib/FHE.sol";
import {ZamaSepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title ConfidentialEscrow
 * @notice Privacy-preserving escrow for B2B payments using FHE-encrypted amounts
 * @dev Implements mutual consent with dispute arbiter model using confidential tokens
 * 
 * Architecture:
 * - Uses ConfidentialUSDCWrapper (cUSDC) for encrypted balances
 * - Invoice amounts are stored encrypted (euint64)
 * - Only parties involved can decrypt amounts
 * - Transfer amounts remain private on-chain
 * 
 * Fee Structure:
 * - Platform Fee: 1% (collected on all releases)
 * - Arbiter Fee: 2% (only collected during disputed releases/refunds)
 * 
 * Flow:
 * 1. Payer wraps USDC → cUSDC (encrypted)
 * 2. Payer creates invoice with encrypted amount
 * 3. Parties approve or dispute
 * 4. Funds released/refunded (all in encrypted form)
 * 5. Recipient unwraps cUSDC → USDC
 */
contract ConfidentialEscrow is ZamaSepoliaConfig {
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Owner of the contract
    address public owner;
    
    /// @notice Confidential USDC wrapper address
    address public immutable cUSDC;
    
    /// @notice Treasury address for platform fees
    address public treasury;
    
    /// @notice Platform fee in basis points (100 = 1%)
    uint64 public constant PLATFORM_FEE_BPS = 100;
    
    /// @notice Arbiter fee in basis points (200 = 2%)
    uint64 public constant ARBITER_FEE_BPS = 200;
    
    /// @notice Basis points denominator (10000 = 100%)
    uint64 public constant BPS_DENOMINATOR = 10000;
    
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
    
    /// @notice Core invoice data structure with encrypted amount
    struct Invoice {
        uint256 id;
        address payer;
        address payee;
        address arbiter;
        euint64 amount;              // ENCRYPTED: Amount in cUSDC (6 decimals)
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
    mapping(uint256 => Invoice) private invoices;
    
    /// @notice Public invoice metadata (non-encrypted data)
    mapping(uint256 => InvoiceMetadata) public invoiceMetadata;
    
    /// @notice Invoice metadata without encrypted fields
    struct InvoiceMetadata {
        uint256 id;
        address payer;
        address payee;
        address arbiter;
        InvoiceStatus status;
        bool payerApproved;
        bool payeeApproved;
        string title;
        string disputeReason;
        uint256 createdAt;
        uint256 fundedAt;
        uint256 resolvedAt;
    }
    
    // ============================================
    // EVENTS
    // ============================================
    
    /// @notice Emitted when invoice is created (amount is encrypted, not logged)
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed payee,
        address arbiter
    );
    
    /// @notice Emitted when invoice is funded
    event FundsDeposited(
        uint256 indexed invoiceId,
        address indexed payer
    );
    
    /// @notice Emitted when approval is granted
    event ApprovalGranted(
        uint256 indexed invoiceId,
        address indexed approver,
        bool isPayer
    );
    
    /// @notice Emitted when dispute is raised
    event DisputeRaised(
        uint256 indexed invoiceId,
        address indexed disputer,
        string reason
    );
    
    /// @notice Emitted when arbitration completes
    event ArbitrationComplete(
        uint256 indexed invoiceId,
        bool releasedToPayee,
        address indexed arbiter
    );
    
    /// @notice Emitted when funds are released (amount is private)
    event FundsReleased(
        uint256 indexed invoiceId,
        address indexed payee
    );
    
    /// @notice Emitted when funds are refunded (amount is private)
    event FundsRefunded(
        uint256 indexed invoiceId,
        address indexed payer
    );
    
    /// @notice Emitted when invoice is cancelled
    event InvoiceCancelled(
        uint256 indexed invoiceId,
        address indexed canceller
    );
    
    /// @notice Emitted when treasury is updated
    event TreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );
    
    /// @notice Emitted when ownership is transferred
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    
    // ============================================
    // ERRORS
    // ============================================
    
    error InvalidAddress();
    error InvoiceNotFound();
    error UnauthorizedAccess();
    error InvalidStatus(InvoiceStatus expected, InvoiceStatus actual);
    error AlreadyApproved();
    error TransferFailed();
    error CannotCancelFundedInvoice();
    error NotOwner();
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /**
     * @notice Initialize the confidential escrow contract
     * @param _treasury Treasury address for platform fees
     * @param _cUSDC Confidential USDC wrapper address
     */
    constructor(address _treasury, address _cUSDC) {
        if (_treasury == address(0)) revert InvalidAddress();
        if (_cUSDC == address(0)) revert InvalidAddress();
        
        owner = msg.sender;
        treasury = _treasury;
        cUSDC = _cUSDC;
        
        emit OwnershipTransferred(address(0), msg.sender);
    }
    
    // ============================================
    // EXTERNAL FUNCTIONS
    // ============================================
    
    /**
     * @notice Create and fund an invoice with encrypted amount
     * @param _payer Address that will fund the invoice
     * @param _payee Address that will receive funds upon release
     * @param _arbiter Address that can resolve disputes
     * @param encryptedAmount FHE-encrypted amount (euint64)
     * @param proof Encryption proof from fhevmjs
     * @param _title Title/description of the invoice
     * @return invoiceId The ID of the created invoice
     * @dev Caller must have approved cUSDC for this contract
     */
    function createAndFundInvoice(
        address _payer,
        address _payee,
        address _arbiter,
        externalEuint64 encryptedAmount,
        bytes calldata proof,
        string calldata _title
    ) external returns (uint256 invoiceId) {
        // Validation
        if (_payer == address(0) || _payee == address(0) || _arbiter == address(0)) {
            revert InvalidAddress();
        }
        if (_payer == _payee) revert InvalidAddress();
        if (msg.sender != _payer) revert UnauthorizedAccess();
        
        // Convert external encrypted input to on-chain encrypted value
        euint64 amount = FHE.fromExternal(encryptedAmount, proof);
        
        // Allow this contract to operate on the encrypted amount
        FHE.allowThis(amount);
        
        // Allow parties to decrypt the amount
        FHE.allow(amount, _payer);
        FHE.allow(amount, _payee);
        FHE.allow(amount, _arbiter);
        
        // Increment invoice counter
        invoiceId = ++invoiceCount;
        
        // Create invoice with encrypted amount
        Invoice storage invoice = invoices[invoiceId];
        invoice.id = invoiceId;
        invoice.payer = _payer;
        invoice.payee = _payee;
        invoice.arbiter = _arbiter;
        invoice.amount = amount;
        invoice.title = _title;
        invoice.status = InvoiceStatus.CREATED;
        invoice.createdAt = block.timestamp;
        
        // Store public metadata
        invoiceMetadata[invoiceId] = InvoiceMetadata({
            id: invoiceId,
            payer: _payer,
            payee: _payee,
            arbiter: _arbiter,
            status: InvoiceStatus.CREATED,
            payerApproved: false,
            payeeApproved: false,
            title: _title,
            disputeReason: "",
            createdAt: block.timestamp,
            fundedAt: 0,
            resolvedAt: 0
        });
        
        emit InvoiceCreated(invoiceId, _payer, _payee, _arbiter);
        
        // Transfer encrypted tokens from payer to this contract
        FHE.allowTransient(amount, cUSDC);
        IERC7984(cUSDC).confidentialTransferFrom(_payer, address(this), amount);
        
        // Update status
        invoice.status = InvoiceStatus.FUNDED;
        invoice.fundedAt = block.timestamp;
        invoiceMetadata[invoiceId].status = InvoiceStatus.FUNDED;
        invoiceMetadata[invoiceId].fundedAt = block.timestamp;
        
        emit FundsDeposited(invoiceId, _payer);
        
        return invoiceId;
    }
    
    /**
     * @notice Approve release of funds
     * @param _invoiceId ID of the invoice to approve
     * @dev When both parties approve, funds are automatically released
     */
    function approveRelease(uint256 _invoiceId) external {
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
            invoiceMetadata[_invoiceId].payerApproved = true;
            emit ApprovalGranted(_invoiceId, msg.sender, true);
        } else {
            if (invoice.payeeApproved) revert AlreadyApproved();
            invoice.payeeApproved = true;
            invoiceMetadata[_invoiceId].payeeApproved = true;
            emit ApprovalGranted(_invoiceId, msg.sender, false);
        }
        
        // Update status
        if (invoice.payerApproved && invoice.payeeApproved) {
            // Both approved - release funds
            _releaseFunds(_invoiceId, false);
        } else {
            // Only one approved - update status
            invoice.status = InvoiceStatus.PENDING_APPROVAL;
            invoiceMetadata[_invoiceId].status = InvoiceStatus.PENDING_APPROVAL;
        }
    }
    
    /**
     * @notice Raise a dispute on an invoice
     * @param _invoiceId ID of the invoice to dispute
     * @param _reason IPFS hash or short description of dispute
     */
    function dispute(uint256 _invoiceId, string calldata _reason) external {
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
        invoiceMetadata[_invoiceId].status = InvoiceStatus.DISPUTED;
        invoiceMetadata[_invoiceId].disputeReason = _reason;
        
        emit DisputeRaised(_invoiceId, msg.sender, _reason);
    }
    
    /**
     * @notice Arbiter releases funds to payee after dispute
     * @param _invoiceId ID of the disputed invoice
     */
    function arbitrateRelease(uint256 _invoiceId) external {
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
    function arbitrateRefund(uint256 _invoiceId) external {
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
    function cancelInvoice(uint256 _invoiceId) external {
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
        invoiceMetadata[_invoiceId].status = InvoiceStatus.CANCELLED;
        invoiceMetadata[_invoiceId].resolvedAt = block.timestamp;
        
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
        
        euint64 totalAmount = invoice.amount;
        
        // Calculate fees using FHE operations
        euint64 platformFee = FHE.div(FHE.mul(totalAmount, FHE.asEuint64(PLATFORM_FEE_BPS)), FHE.asEuint64(BPS_DENOMINATOR));
        euint64 arbiterFee = _isDisputed 
            ? FHE.div(FHE.mul(totalAmount, FHE.asEuint64(ARBITER_FEE_BPS)), FHE.asEuint64(BPS_DENOMINATOR))
            : FHE.asEuint64(0);
        euint64 payeeAmount = FHE.sub(FHE.sub(totalAmount, platformFee), arbiterFee);
        
        // Update status
        invoice.status = InvoiceStatus.RELEASED;
        invoice.resolvedAt = block.timestamp;
        invoiceMetadata[_invoiceId].status = InvoiceStatus.RELEASED;
        invoiceMetadata[_invoiceId].resolvedAt = block.timestamp;
        
        // Transfer platform fee to treasury
        FHE.allowTransient(platformFee, cUSDC);
        IERC7984(cUSDC).confidentialTransfer(treasury, platformFee);
        
        // Transfer arbiter fee if disputed
        if (_isDisputed) {
            FHE.allowTransient(arbiterFee, cUSDC);
            IERC7984(cUSDC).confidentialTransfer(invoice.arbiter, arbiterFee);
        }
        
        // Transfer remaining amount to payee
        FHE.allowTransient(payeeAmount, cUSDC);
        IERC7984(cUSDC).confidentialTransfer(invoice.payee, payeeAmount);
        
        emit FundsReleased(_invoiceId, invoice.payee);
    }
    
    /**
     * @notice Internal function to refund funds to payer
     * @param _invoiceId ID of the invoice
     */
    function _refundFunds(uint256 _invoiceId) internal {
        Invoice storage invoice = invoices[_invoiceId];
        
        euint64 totalAmount = invoice.amount;
        
        // Calculate fees using FHE operations
        euint64 platformFee = FHE.div(FHE.mul(totalAmount, FHE.asEuint64(PLATFORM_FEE_BPS)), FHE.asEuint64(BPS_DENOMINATOR));
        euint64 arbiterFee = FHE.div(FHE.mul(totalAmount, FHE.asEuint64(ARBITER_FEE_BPS)), FHE.asEuint64(BPS_DENOMINATOR));
        euint64 refundAmount = FHE.sub(FHE.sub(totalAmount, platformFee), arbiterFee);
        
        // Update status
        invoice.status = InvoiceStatus.REFUNDED;
        invoice.resolvedAt = block.timestamp;
        invoiceMetadata[_invoiceId].status = InvoiceStatus.REFUNDED;
        invoiceMetadata[_invoiceId].resolvedAt = block.timestamp;
        
        // Transfer platform fee to treasury
        FHE.allowTransient(platformFee, cUSDC);
        IERC7984(cUSDC).confidentialTransfer(treasury, platformFee);
        
        // Transfer arbiter fee
        FHE.allowTransient(arbiterFee, cUSDC);
        IERC7984(cUSDC).confidentialTransfer(invoice.arbiter, arbiterFee);
        
        // Transfer remaining amount to payer
        FHE.allowTransient(refundAmount, cUSDC);
        IERC7984(cUSDC).confidentialTransfer(invoice.payer, refundAmount);
        
        emit FundsRefunded(_invoiceId, invoice.payer);
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
    
    /**
     * @notice Transfer ownership
     * @param _newOwner New owner address
     */
    function transferOwnership(address _newOwner) external onlyOwner {
        if (_newOwner == address(0)) revert InvalidAddress();
        address oldOwner = owner;
        owner = _newOwner;
        emit OwnershipTransferred(oldOwner, _newOwner);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /**
     * @notice Get public invoice metadata (non-encrypted fields)
     * @param _invoiceId ID of the invoice
     * @return InvoiceMetadata struct
     */
    function getInvoice(uint256 _invoiceId) external view returns (InvoiceMetadata memory) {
        return invoiceMetadata[_invoiceId];
    }
    
    /**
     * @notice Get encrypted invoice amount handle
     * @param _invoiceId ID of the invoice
     * @return Encrypted amount handle (bytes32)
     * @dev Caller must be payer, payee, or arbiter to decrypt
     */
    function getInvoiceAmountHandle(uint256 _invoiceId) external view returns (euint64) {
        return invoices[_invoiceId].amount;
    }
    
    /**
     * @notice Calculate fees for display purposes (plaintext calculation)
     * @param _amount Amount in cUSDC (6 decimals)
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
