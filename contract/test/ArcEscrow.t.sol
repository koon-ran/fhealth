// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/ArcEscrow.sol";
import "../src/interfaces/IERC20.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC contract for testing
 */
contract MockUSDC is IERC20 {
    string public name = "USD Coin";
    string public symbol = "USDC";
    uint8 public decimals = 6;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
}

/**
 * @title ArcEscrowTest
 * @notice Comprehensive test suite for ArcEscrow contract
 */
contract ArcEscrowTest is Test {
    ArcEscrow public escrow;
    MockUSDC public usdc;
    
    address public owner;
    address public treasury;
    address public payer;
    address public payee;
    address public arbiter;
    
    uint256 public constant INITIAL_BALANCE = 1_000_000 * 10**6; // 1M USDC
    uint256 public constant INVOICE_AMOUNT = 100 * 10**6; // 100 USDC
    
    // Events to test
    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed payer,
        address indexed payee,
        address arbiter,
        uint256 amount
    );
    
    event FundsDeposited(uint256 indexed invoiceId, address indexed payer, uint256 amount);
    event ApprovalGranted(uint256 indexed invoiceId, address indexed approver, bool isPayer);
    event DisputeRaised(uint256 indexed invoiceId, address indexed disputer, string reason);
    event FundsReleased(uint256 indexed invoiceId, address indexed payee, uint256 amount, uint256 platformFee, uint256 arbiterFee);
    event FundsRefunded(uint256 indexed invoiceId, address indexed payer, uint256 amount, uint256 platformFee, uint256 arbiterFee);
    
    function setUp() public {
        // Setup accounts
        owner = address(this);
        treasury = makeAddr("treasury");
        payer = makeAddr("payer");
        payee = makeAddr("payee");
        arbiter = makeAddr("arbiter");
        
        // Deploy mock USDC
        usdc = new MockUSDC();
        
        // Deploy escrow with mock USDC
        escrow = new ArcEscrow(treasury, address(usdc));
        
        // Mint USDC to payer
        usdc.mint(payer, INITIAL_BALANCE);
        
        // Approve escrow to spend payer's USDC
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }
    
    // ============================================
    // CONSTRUCTOR TESTS
    // ============================================
    
    function test_Constructor() public view {
        assertEq(escrow.treasury(), treasury);
        assertEq(escrow.owner(), owner);
        assertEq(escrow.PLATFORM_FEE_BPS(), 100); // 1%
        assertEq(escrow.ARBITER_FEE_BPS(), 200); // 2%
    }
    
    function test_RevertWhen_ConstructorZeroTreasury() public {
        vm.expectRevert(ArcEscrow.InvalidAddress.selector);
        new ArcEscrow(address(0), address(usdc));
    }
    
    function test_RevertWhen_ConstructorZeroUSDC() public {
        vm.expectRevert(ArcEscrow.InvalidAddress.selector);
        new ArcEscrow(treasury, address(0));
    }
    
    // ============================================
    // INVOICE CREATION TESTS
    // ============================================
    
    function test_CreateAndFundInvoice() public {
        vm.startPrank(payer);
        
        uint256 invoiceId = escrow.createAndFundInvoice(
            payer,
            payee,
            arbiter,
            INVOICE_AMOUNT,
            "Test Invoice"
        );
        
        vm.stopPrank();
        
        assertEq(invoiceId, 1);
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertEq(invoice.id, 1);
        assertEq(invoice.payer, payer);
        assertEq(invoice.payee, payee);
        assertEq(invoice.title, "Test Invoice");
        assertEq(invoice.arbiter, arbiter);
        assertEq(invoice.amount, INVOICE_AMOUNT);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.FUNDED));
        assertEq(usdc.balanceOf(address(escrow)), INVOICE_AMOUNT);
    }
    
    function test_RevertWhen_CreateInvoiceZeroAmount() public {
        vm.prank(payer);
        vm.expectRevert(ArcEscrow.InvalidAmount.selector);
        escrow.createAndFundInvoice(payer, payee, arbiter, 0, "Test");
    }
    
    function test_RevertWhen_CreateInvoiceZeroPayee() public {
        vm.prank(payer);
        vm.expectRevert(ArcEscrow.InvalidAddress.selector);
        escrow.createAndFundInvoice(payer, address(0), arbiter, INVOICE_AMOUNT, "Test");
    }
    
    function test_RevertWhen_CreateInvoiceSamePayerPayee() public {
        vm.prank(payer);
        vm.expectRevert(ArcEscrow.InvalidAddress.selector);
        escrow.createAndFundInvoice(payer, payer, arbiter, INVOICE_AMOUNT, "Test");
    }
    
    // ============================================
    // APPROVAL TESTS
    // ============================================
    
    function test_ApproveReleaseByPayer() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(payer);
        escrow.approveRelease(invoiceId);
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertTrue(invoice.payerApproved);
        assertFalse(invoice.payeeApproved);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.PENDING_APPROVAL));
    }
    
    function test_ApproveReleaseByPayee() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(payee);
        escrow.approveRelease(invoiceId);
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertFalse(invoice.payerApproved);
        assertTrue(invoice.payeeApproved);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.PENDING_APPROVAL));
    }
    
    function test_BothPartiesApprove_ReleaseFunds() public {
        uint256 invoiceId = _createFundedInvoice();
        
        // Payer approves
        vm.prank(payer);
        escrow.approveRelease(invoiceId);
        
        // Payee approves - should trigger release
        vm.prank(payee);
        escrow.approveRelease(invoiceId);
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.RELEASED));
        
        // Check balances
        uint256 platformFee = (INVOICE_AMOUNT * 100) / 10000; // 1%
        uint256 expectedPayeeAmount = INVOICE_AMOUNT - platformFee;
        
        assertEq(usdc.balanceOf(payee), expectedPayeeAmount);
        assertEq(usdc.balanceOf(treasury), platformFee);
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }
    
    function test_RevertWhen_UnauthorizedApproval() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(arbiter);
        vm.expectRevert(ArcEscrow.UnauthorizedAccess.selector);
        escrow.approveRelease(invoiceId);
    }
    
    // ============================================
    // DISPUTE TESTS
    // ============================================
    
    function test_DisputeByPayer() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(payer);
        escrow.dispute(invoiceId, "Quality issues");
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.DISPUTED));
        assertEq(invoice.disputeReason, "Quality issues");
    }
    
    function test_DisputeByPayee() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(payee);
        escrow.dispute(invoiceId, "Payment delayed");
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.DISPUTED));
    }
    
    function test_RevertWhen_DisputeByUnauthorized() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(arbiter);
        vm.expectRevert(ArcEscrow.UnauthorizedAccess.selector);
        escrow.dispute(invoiceId, "Unauthorized");
    }
    
    // ============================================
    // ARBITRATION TESTS
    // ============================================
    
    function test_ArbitrateRelease() public {
        uint256 invoiceId = _createFundedInvoice();
        
        // Dispute
        vm.prank(payer);
        escrow.dispute(invoiceId, "Dispute reason");
        
        // Arbiter releases to payee
        vm.prank(arbiter);
        escrow.arbitrateRelease(invoiceId);
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.RELEASED));
        
        // Check balances - should include arbiter fee
        uint256 platformFee = (INVOICE_AMOUNT * 100) / 10000; // 1%
        uint256 arbiterFee = (INVOICE_AMOUNT * 200) / 10000; // 2%
        uint256 expectedPayeeAmount = INVOICE_AMOUNT - platformFee - arbiterFee;
        
        assertEq(usdc.balanceOf(payee), expectedPayeeAmount);
        assertEq(usdc.balanceOf(treasury), platformFee);
        assertEq(usdc.balanceOf(arbiter), arbiterFee);
    }
    
    function test_ArbitrateRefund() public {
        uint256 invoiceId = _createFundedInvoice();
        
        // Dispute
        vm.prank(payee);
        escrow.dispute(invoiceId, "Dispute reason");
        
        // Arbiter refunds to payer
        vm.prank(arbiter);
        escrow.arbitrateRefund(invoiceId);
        
        ArcEscrow.Invoice memory invoice = escrow.getInvoice(invoiceId);
        assertEq(uint8(invoice.status), uint8(ArcEscrow.InvoiceStatus.REFUNDED));
        
        // Check balances
        uint256 platformFee = (INVOICE_AMOUNT * 100) / 10000; // 1%
        uint256 arbiterFee = (INVOICE_AMOUNT * 200) / 10000; // 2%
        uint256 expectedRefundAmount = INVOICE_AMOUNT - platformFee - arbiterFee;
        
        assertEq(usdc.balanceOf(payer), INITIAL_BALANCE - INVOICE_AMOUNT + expectedRefundAmount);
        assertEq(usdc.balanceOf(treasury), platformFee);
        assertEq(usdc.balanceOf(arbiter), arbiterFee);
    }
    
    function test_RevertWhen_ArbitrateWithoutDispute() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(arbiter);
        vm.expectRevert();
        escrow.arbitrateRelease(invoiceId);
    }
    
    function test_RevertWhen_ArbitrateByNonArbiter() public {
        uint256 invoiceId = _createFundedInvoice();
        
        vm.prank(payer);
        escrow.dispute(invoiceId, "Dispute");
        
        vm.prank(payer);
        vm.expectRevert(ArcEscrow.UnauthorizedAccess.selector);
        escrow.arbitrateRelease(invoiceId);
    }
    
    // ============================================
    // FEE CALCULATION TESTS
    // ============================================
    
    function test_CalculateFeesNormal() public view {
        (uint256 platformFee, uint256 arbiterFee, uint256 netAmount) = 
            escrow.calculateFees(INVOICE_AMOUNT, false);
        
        assertEq(platformFee, 1 * 10**6); // 1 USDC
        assertEq(arbiterFee, 0);
        assertEq(netAmount, 99 * 10**6); // 99 USDC
    }
    
    function test_CalculateFeesDisputed() public view {
        (uint256 platformFee, uint256 arbiterFee, uint256 netAmount) = 
            escrow.calculateFees(INVOICE_AMOUNT, true);
        
        assertEq(platformFee, 1 * 10**6); // 1 USDC
        assertEq(arbiterFee, 2 * 10**6); // 2 USDC
        assertEq(netAmount, 97 * 10**6); // 97 USDC
    }
    
    // ============================================
    // ADMIN TESTS
    // ============================================
    
    function test_UpdateTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        
        escrow.updateTreasury(newTreasury);
        
        assertEq(escrow.treasury(), newTreasury);
    }
    
    function test_RevertWhen_UpdateTreasuryZeroAddress() public {
        vm.expectRevert(ArcEscrow.InvalidAddress.selector);
        escrow.updateTreasury(address(0));
    }
    
    function test_RevertWhen_UpdateTreasuryUnauthorized() public {
        address newTreasury = makeAddr("newTreasury");
        
        vm.prank(payer);
        vm.expectRevert();
        escrow.updateTreasury(newTreasury);
    }
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    
    function _createFundedInvoice() internal returns (uint256) {
        vm.prank(payer);
        return escrow.createAndFundInvoice(
            payer,
            payee,
            arbiter,
            INVOICE_AMOUNT,
            "Test Invoice"
        );
    }
}
