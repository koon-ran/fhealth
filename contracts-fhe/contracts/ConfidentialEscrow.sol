// SPDX-License-Identifier: BSD-3-Clause
pragma solidity ^0.8.27;

import "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/// @title ConfidentialEscrow
/// @notice Privacy-preserving escrow for healthcare payments
/// @dev Uses encrypted amounts - only parties can see invoice values
///
/// Flow:
/// 1. Payer wraps USDC → cUSDC via wrapper
/// 2. Payer creates invoice with encrypted amount (calls this contract)
/// 3. Payer/Payee approve or dispute
/// 4. Funds released to payee or refunded to payer
/// 5. Recipient unwraps cUSDC → USDC
contract ConfidentialEscrow is ZamaEthereumConfig {
    
    // ============ State Variables ============
    
    address public owner;
    address public defaultToken; // cUSDC wrapper
    
    // Invoice counter
    uint256 public invoiceCount;
    
    // Invoice status
    enum Status {
        Created,
        Funded,
        Approved,
        Completed,
        Disputed,
        Refunded,
        Cancelled
    }
    
    // Invoice data
    struct Invoice {
        uint256 id;
        address payer;
        address payee;
        address arbiter;
        euint64 amount;         // Encrypted amount
        Status status;
        bool payerApproved;
        bool payeeApproved;
        string metadataHash;    // IPFS hash for invoice details
        uint256 createdAt;
        uint256 completedAt;
    }
    
    // Storage
    mapping(uint256 => Invoice) private invoices;
    mapping(address => uint256[]) public payerInvoices;
    mapping(address => uint256[]) public payeeInvoices;
    
    // ============ Events ============
    
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed payee,
        address arbiter,
        string metadataHash
    );
    
    event InvoiceFunded(uint256 indexed invoiceId);
    event ApprovalGranted(uint256 indexed invoiceId, address indexed approver);
    event InvoiceCompleted(uint256 indexed invoiceId);
    event InvoiceDisputed(uint256 indexed invoiceId, address indexed disputer);
    event InvoiceRefunded(uint256 indexed invoiceId);
    event DisputeResolved(uint256 indexed invoiceId, bool payeeWins);
    
    // ============ Constructor ============
    
    constructor(address _defaultToken) {
        require(_defaultToken != address(0), "Invalid token");
        owner = msg.sender;
        defaultToken = _defaultToken;
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier invoiceExists(uint256 invoiceId) {
        require(invoiceId > 0 && invoiceId <= invoiceCount, "Invoice not found");
        _;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Create and fund an invoice
     * @param payee Healthcare provider address
     * @param arbiter Dispute resolver address
     * @param encryptedAmount Encrypted invoice amount
     * @param inputProof Encryption proof
     * @param metadataHash IPFS hash with invoice details
     */
    function createAndFundInvoice(
        address payee,
        address arbiter,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        string calldata metadataHash
    ) external returns (uint256) {
        require(payee != address(0), "Invalid payee");
        require(payee != msg.sender, "Cannot pay yourself");
        require(arbiter != address(0), "Invalid arbiter");
        
        // Convert encrypted input
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        
        // Allow contract to operate on amount
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.allow(amount, payee);
        FHE.allow(amount, arbiter);
        
        // Create invoice
        invoiceCount++;
        uint256 invoiceId = invoiceCount;
        
        Invoice storage invoice = invoices[invoiceId];
        invoice.id = invoiceId;
        invoice.payer = msg.sender;
        invoice.payee = payee;
        invoice.arbiter = arbiter;
        invoice.amount = amount;
        invoice.status = Status.Funded;
        invoice.metadataHash = metadataHash;
        invoice.createdAt = block.timestamp;
        
        // Track invoices
        payerInvoices[msg.sender].push(invoiceId);
        payeeInvoices[payee].push(invoiceId);
        
        // Transfer encrypted tokens from payer to this contract
        // Payer must have approved this contract as operator on the wrapper
        FHE.allowTransient(amount, defaultToken);
        IERC7984(defaultToken).confidentialTransferFrom(msg.sender, address(this), amount);
        
        emit InvoiceCreated(invoiceId, msg.sender, payee, arbiter, metadataHash);
        emit InvoiceFunded(invoiceId);
        
        return invoiceId;
    }
    
    /**
     * @notice Approve release of funds
     * @param invoiceId Invoice to approve
     */
    function approveRelease(uint256 invoiceId) external invoiceExists(invoiceId) {
        Invoice storage invoice = invoices[invoiceId];
        
        require(invoice.status == Status.Funded || invoice.status == Status.Approved, "Invalid status");
        require(msg.sender == invoice.payer || msg.sender == invoice.payee, "Not authorized");
        
        if (msg.sender == invoice.payer) {
            require(!invoice.payerApproved, "Already approved");
            invoice.payerApproved = true;
        } else {
            require(!invoice.payeeApproved, "Already approved");
            invoice.payeeApproved = true;
        }
        
        emit ApprovalGranted(invoiceId, msg.sender);
        
        // If both approved, release funds
        if (invoice.payerApproved && invoice.payeeApproved) {
            _releaseFunds(invoiceId);
        } else {
            invoice.status = Status.Approved;
        }
    }
    
    /**
     * @notice Raise a dispute
     * @param invoiceId Invoice to dispute
     */
    function dispute(uint256 invoiceId) external invoiceExists(invoiceId) {
        Invoice storage invoice = invoices[invoiceId];
        
        require(
            invoice.status == Status.Funded || invoice.status == Status.Approved,
            "Cannot dispute"
        );
        require(
            msg.sender == invoice.payer || msg.sender == invoice.payee,
            "Not authorized"
        );
        
        invoice.status = Status.Disputed;
        emit InvoiceDisputed(invoiceId, msg.sender);
    }
    
    /**
     * @notice Arbiter resolves dispute
     * @param invoiceId Disputed invoice
     * @param payeeWins True to release to payee, false to refund payer
     */
    function resolveDispute(uint256 invoiceId, bool payeeWins) 
        external 
        invoiceExists(invoiceId) 
    {
        Invoice storage invoice = invoices[invoiceId];
        
        require(invoice.status == Status.Disputed, "Not disputed");
        require(msg.sender == invoice.arbiter, "Only arbiter");
        
        if (payeeWins) {
            _releaseFunds(invoiceId);
        } else {
            _refundFunds(invoiceId);
        }
        
        emit DisputeResolved(invoiceId, payeeWins);
    }
    
    // ============ Internal Functions ============
    
    function _releaseFunds(uint256 invoiceId) internal {
        Invoice storage invoice = invoices[invoiceId];
        
        invoice.status = Status.Completed;
        invoice.completedAt = block.timestamp;
        
        // Transfer full amount to payee (fees handled off-chain or in wrapper)
        FHE.allowTransient(invoice.amount, defaultToken);
        IERC7984(defaultToken).confidentialTransfer(invoice.payee, invoice.amount);
        
        emit InvoiceCompleted(invoiceId);
    }
    
    function _refundFunds(uint256 invoiceId) internal {
        Invoice storage invoice = invoices[invoiceId];
        
        invoice.status = Status.Refunded;
        
        FHE.allowTransient(invoice.amount, defaultToken);
        IERC7984(defaultToken).confidentialTransfer(invoice.payer, invoice.amount);
        
        emit InvoiceRefunded(invoiceId);
    }
    
    // ============ View Functions ============
    
    function getInvoice(uint256 invoiceId) 
        external 
        view 
        invoiceExists(invoiceId) 
        returns (
            address payer,
            address payee,
            address arbiter,
            Status status,
            bool payerApproved,
            bool payeeApproved,
            string memory metadataHash,
            uint256 createdAt,
            uint256 completedAt
        ) 
    {
        Invoice storage invoice = invoices[invoiceId];
        return (
            invoice.payer,
            invoice.payee,
            invoice.arbiter,
            invoice.status,
            invoice.payerApproved,
            invoice.payeeApproved,
            invoice.metadataHash,
            invoice.createdAt,
            invoice.completedAt
        );
    }
    
    function getPayerInvoices(address payer) external view returns (uint256[] memory) {
        return payerInvoices[payer];
    }
    
    function getPayeeInvoices(address payee) external view returns (uint256[] memory) {
        return payeeInvoices[payee];
    }
    
    /**
     * @notice Get encrypted amount handle for an invoice
     * @param invoiceId Invoice ID
     * @return Encrypted amount handle
     * @dev The handle is just a reference - only authorized parties can decrypt via Zama gateway
     */
    function getEncryptedAmount(uint256 invoiceId) 
        external 
        view 
        invoiceExists(invoiceId) 
        returns (euint64) 
    {
        Invoice storage invoice = invoices[invoiceId];
        return invoice.amount;
    }
    
    // ============ Admin Functions ============
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}
