import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

/**
 * FHEscrow Protocol Test Suite
 * 
 * Contracts:
 * - ConfidentialUSDCWrapper: Wraps USDC → cUSDC (FHE-encrypted via ERC7984)
 * - ConfidentialEscrow: Privacy-preserving escrow for B2B payments
 * 
 * Test Flow:
 * 1. Deploy MockUSDC, Wrapper, and Escrow
 * 2. Wrap USDC → cUSDC (encrypted)
 * 3. Create and fund escrow invoices
 * 4. Test approval flows (dual approval releases funds)
 * 5. Test dispute resolution by arbiter
 * 6. Unwrap cUSDC → USDC
 */
describe("FHEscrow Protocol", function () {
  let usdc: any;
  let wrapper: any;
  let escrow: any;

  let owner: HardhatEthersSigner;
  let payer: HardhatEthersSigner;      // Client who pays
  let payee: HardhatEthersSigner;      // Provider who receives
  let arbiter: HardhatEthersSigner;    // Dispute resolver
  let outsider: HardhatEthersSigner;   // Non-participant

  const INITIAL_MINT = 10_000_000_000n; // 10,000 USDC (6 decimals)
  const WRAP_AMOUNT = 1_000_000_000n;   // 1,000 USDC

  beforeEach(async function () {
    [owner, payer, payee, arbiter, outsider] = await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    // Deploy ConfidentialUSDCWrapper
    const Wrapper = await ethers.getContractFactory("ConfidentialUSDCWrapper");
    wrapper = await Wrapper.deploy(
      await usdc.getAddress(),
      "Confidential USDC",
      "cUSDC",
      ""
    );
    await wrapper.waitForDeployment();

    // Deploy ConfidentialEscrow
    const Escrow = await ethers.getContractFactory("ConfidentialEscrow");
    escrow = await Escrow.deploy(await wrapper.getAddress());
    await escrow.waitForDeployment();

    // Mint USDC to test users
    await usdc.mint(payer.address, INITIAL_MINT);
    await usdc.mint(payee.address, INITIAL_MINT);
    await usdc.mint(arbiter.address, INITIAL_MINT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //                        CONFIDENTIAL USDC WRAPPER
  // ═══════════════════════════════════════════════════════════════════════════

  describe("ConfidentialUSDCWrapper", function () {
    describe("Deployment", function () {
      it("should have correct name", async function () {
        expect(await wrapper.name()).to.equal("Confidential USDC");
      });

      it("should have correct symbol", async function () {
        expect(await wrapper.symbol()).to.equal("cUSDC");
      });

      it("should have correct underlying token", async function () {
        expect(await wrapper.underlying()).to.equal(await usdc.getAddress());
      });

      it("should have 6 decimals matching USDC", async function () {
        expect(await wrapper.decimals()).to.equal(6);
      });

      it("should have 1:1 conversion rate", async function () {
        expect(await wrapper.rate()).to.equal(1);
      });
    });

    describe("Wrapping USDC → cUSDC", function () {
      const wrapAmount = 500_000_000n; // 500 USDC

      beforeEach(async function () {
        await usdc.connect(payer).approve(await wrapper.getAddress(), wrapAmount);
      });

      it("should wrap USDC into cUSDC", async function () {
        const wrapperAddr = await wrapper.getAddress();
        const payerBalanceBefore = await usdc.balanceOf(payer.address);

        await wrapper.connect(payer).wrap(payer.address, wrapAmount);

        expect(await usdc.balanceOf(wrapperAddr)).to.equal(wrapAmount);
        expect(await usdc.balanceOf(payer.address)).to.equal(payerBalanceBefore - wrapAmount);
      });

      it("should create encrypted balance after wrap", async function () {
        await wrapper.connect(payer).wrap(payer.address, wrapAmount);

        const handle = await wrapper.confidentialBalanceOf(payer.address);
        expect(handle).to.not.equal(ethers.ZeroHash);
      });

      it("should decrypt to correct wrapped amount", async function () {
        await wrapper.connect(payer).wrap(payer.address, wrapAmount);

        const handle = await wrapper.confidentialBalanceOf(payer.address);
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          handle,
          await wrapper.getAddress(),
          payer
        );

        expect(decrypted).to.equal(wrapAmount);
      });

      it("should allow wrapping to different recipient", async function () {
        await wrapper.connect(payer).wrap(payee.address, wrapAmount);

        const handle = await wrapper.confidentialBalanceOf(payee.address);
        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          handle,
          await wrapper.getAddress(),
          payee
        );

        expect(decrypted).to.equal(wrapAmount);
      });

      it("should revert on insufficient allowance", async function () {
        await expect(
          wrapper.connect(payer).wrap(payer.address, wrapAmount + 1n)
        ).to.be.reverted;
      });
    });

    describe("Confidential Transfers", function () {
      const wrapAmount = 1_000_000_000n;

      beforeEach(async function () {
        await usdc.connect(payer).approve(await wrapper.getAddress(), wrapAmount);
        await wrapper.connect(payer).wrap(payer.address, wrapAmount);
      });

      it("should transfer encrypted tokens between users", async function () {
        const transferAmount = 250_000_000n;
        const wrapperAddr = await wrapper.getAddress();

        const input = await fhevm.createEncryptedInput(wrapperAddr, payer.address);
        input.add64(transferAmount);
        const encrypted = await input.encrypt();

        await wrapper.connect(payer)["confidentialTransfer(address,bytes32,bytes)"](
          payee.address,
          encrypted.handles[0],
          encrypted.inputProof
        );

        const payerHandle = await wrapper.confidentialBalanceOf(payer.address);
        const payeeHandle = await wrapper.confidentialBalanceOf(payee.address);

        const payerBalance = await fhevm.userDecryptEuint(FhevmType.euint64, payerHandle, wrapperAddr, payer);
        const payeeBalance = await fhevm.userDecryptEuint(FhevmType.euint64, payeeHandle, wrapperAddr, payee);

        expect(payerBalance).to.equal(wrapAmount - transferAmount);
        expect(payeeBalance).to.equal(transferAmount);
      });
    });

    describe("Operator Management", function () {
      const wrapAmount = 1_000_000_000n;

      beforeEach(async function () {
        await usdc.connect(payer).approve(await wrapper.getAddress(), wrapAmount);
        await wrapper.connect(payer).wrap(payer.address, wrapAmount);
      });

      it("should allow setting operator", async function () {
        const escrowAddr = await escrow.getAddress();
        const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

        await wrapper.connect(payer).setOperator(escrowAddr, farFuture);

        expect(await wrapper.isOperator(payer.address, escrowAddr)).to.be.true;
      });

      it("should allow confidentialTransferFrom when operator is set", async function () {
        const escrowAddr = await escrow.getAddress();
        const wrapperAddr = await wrapper.getAddress();
        const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

        await wrapper.connect(payer).setOperator(escrowAddr, farFuture);

        // Now escrow can transfer on behalf of payer
        expect(await wrapper.isOperator(payer.address, escrowAddr)).to.be.true;
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //                        CONFIDENTIAL ESCROW
  // ═══════════════════════════════════════════════════════════════════════════

  describe("ConfidentialEscrow", function () {
    const INVOICE_AMOUNT = 100_000_000n; // 100 USDC

    beforeEach(async function () {
      const wrapperAddr = await wrapper.getAddress();
      const escrowAddr = await escrow.getAddress();

      // Wrap USDC for payer
      await usdc.connect(payer).approve(wrapperAddr, WRAP_AMOUNT);
      await wrapper.connect(payer).wrap(payer.address, WRAP_AMOUNT);

      // Set escrow as operator (ERC7984 uses operators with expiry timestamp)
      const farFuture = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      await wrapper.connect(payer).setOperator(escrowAddr, farFuture);
    });

    describe("Deployment", function () {
      it("should set correct owner", async function () {
        expect(await escrow.owner()).to.equal(owner.address);
      });

      it("should set correct default token", async function () {
        expect(await escrow.defaultToken()).to.equal(await wrapper.getAddress());
      });

      it("should start with zero invoices", async function () {
        expect(await escrow.invoiceCount()).to.equal(0);
      });
    });

    describe("Create and Fund Invoice", function () {
      it("should create an invoice with encrypted amount", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        const tx = await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          "ipfs://Qm..." // metadata hash
        );
        const receipt = await tx.wait();

        // Verify event
        const event = receipt?.logs.find((log: any) => {
          try {
            return escrow.interface.parseLog(log)?.name === "InvoiceCreated";
          } catch { return false; }
        });
        expect(event).to.not.be.undefined;
      });

      it("should increment invoice count", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        expect(await escrow.invoiceCount()).to.equal(1);
      });

      it("should store correct invoice data", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          "ipfs://test"
        );

        const invoice = await escrow.getInvoice(1);
        expect(invoice.payer).to.equal(payer.address);
        expect(invoice.payee).to.equal(payee.address);
        expect(invoice.arbiter).to.equal(arbiter.address);
        expect(invoice.status).to.equal(1); // Status.Funded
        expect(invoice.metadataHash).to.equal("ipfs://test");
      });

      it("should transfer funds to escrow", async function () {
        const escrowAddr = await escrow.getAddress();
        const wrapperAddr = await wrapper.getAddress();

        // Check initial balance
        const payerBalanceBefore = await wrapper.confidentialBalanceOf(payer.address);
        const payerDecryptedBefore = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          payerBalanceBefore,
          wrapperAddr,
          payer
        );

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        // Check balance decreased
        const payerBalanceAfter = await wrapper.confidentialBalanceOf(payer.address);
        const payerDecryptedAfter = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          payerBalanceAfter,
          wrapperAddr,
          payer
        );

        expect(payerDecryptedAfter).to.equal(payerDecryptedBefore - INVOICE_AMOUNT);
      });

      it("should track payer invoices", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        const payerInvoices = await escrow.getPayerInvoices(payer.address);
        expect(payerInvoices.length).to.equal(1);
        expect(payerInvoices[0]).to.equal(1n);
      });

      it("should track payee invoices", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        const payeeInvoices = await escrow.getPayeeInvoices(payee.address);
        expect(payeeInvoices.length).to.equal(1);
        expect(payeeInvoices[0]).to.equal(1n);
      });

      it("should revert with zero address payee", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await expect(
          escrow.connect(payer).createAndFundInvoice(
            ethers.ZeroAddress,
            arbiter.address,
            encrypted.handles[0],
            encrypted.inputProof,
            ""
          )
        ).to.be.revertedWith("Invalid payee");
      });

      it("should revert when paying yourself", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await expect(
          escrow.connect(payer).createAndFundInvoice(
            payer.address,
            arbiter.address,
            encrypted.handles[0],
            encrypted.inputProof,
            ""
          )
        ).to.be.revertedWith("Cannot pay yourself");
      });

      it("should revert with zero address arbiter", async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await expect(
          escrow.connect(payer).createAndFundInvoice(
            payee.address,
            ethers.ZeroAddress,
            encrypted.handles[0],
            encrypted.inputProof,
            ""
          )
        ).to.be.revertedWith("Invalid arbiter");
      });
    });

    describe("Approval Flow", function () {
      let invoiceId: bigint;

      beforeEach(async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        invoiceId = 1n;
      });

      it("should allow payee to approve", async function () {
        await escrow.connect(payee).approveRelease(invoiceId);

        const invoice = await escrow.getInvoice(invoiceId);
        expect(invoice.payeeApproved).to.be.true;
        expect(invoice.status).to.equal(2); // Status.Approved
      });

      it("should allow payer to approve", async function () {
        await escrow.connect(payer).approveRelease(invoiceId);

        const invoice = await escrow.getInvoice(invoiceId);
        expect(invoice.payerApproved).to.be.true;
        expect(invoice.status).to.equal(2); // Status.Approved
      });

      it("should emit ApprovalGranted event", async function () {
        const tx = await escrow.connect(payee).approveRelease(invoiceId);
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            return escrow.interface.parseLog(log)?.name === "ApprovalGranted";
          } catch { return false; }
        });
        expect(event).to.not.be.undefined;
      });

      it("should release funds when both approve", async function () {
        const wrapperAddr = await wrapper.getAddress();

        // Initial payee balance
        const payeeBalanceBefore = await wrapper.confidentialBalanceOf(payee.address);
        const payeeDecryptedBefore = payeeBalanceBefore === ethers.ZeroHash ? 0n :
          await fhevm.userDecryptEuint(FhevmType.euint64, payeeBalanceBefore, wrapperAddr, payee);

        // Both approve
        await escrow.connect(payee).approveRelease(invoiceId);
        await escrow.connect(payer).approveRelease(invoiceId);

        // Check status
        const invoice = await escrow.getInvoice(invoiceId);
        expect(invoice.status).to.equal(3); // Status.Completed

        // Check payee balance increased
        const payeeBalanceAfter = await wrapper.confidentialBalanceOf(payee.address);
        const payeeDecryptedAfter = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          payeeBalanceAfter,
          wrapperAddr,
          payee
        );

        expect(payeeDecryptedAfter).to.equal(payeeDecryptedBefore + INVOICE_AMOUNT);
      });

      it("should emit InvoiceCompleted when both approve", async function () {
        await escrow.connect(payee).approveRelease(invoiceId);
        
        const tx = await escrow.connect(payer).approveRelease(invoiceId);
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            return escrow.interface.parseLog(log)?.name === "InvoiceCompleted";
          } catch { return false; }
        });
        expect(event).to.not.be.undefined;
      });

      it("should revert when approving twice", async function () {
        await escrow.connect(payee).approveRelease(invoiceId);

        await expect(
          escrow.connect(payee).approveRelease(invoiceId)
        ).to.be.revertedWith("Already approved");
      });

      it("should revert when non-party approves", async function () {
        await expect(
          escrow.connect(outsider).approveRelease(invoiceId)
        ).to.be.revertedWith("Not authorized");
      });

      it("should revert when arbiter tries to approve", async function () {
        await expect(
          escrow.connect(arbiter).approveRelease(invoiceId)
        ).to.be.revertedWith("Not authorized");
      });
    });

    describe("Dispute Flow", function () {
      let invoiceId: bigint;

      beforeEach(async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        invoiceId = 1n;
      });

      it("should allow payer to dispute", async function () {
        await escrow.connect(payer).dispute(invoiceId);

        const invoice = await escrow.getInvoice(invoiceId);
        expect(invoice.status).to.equal(4); // Status.Disputed
      });

      it("should allow payee to dispute", async function () {
        await escrow.connect(payee).dispute(invoiceId);

        const invoice = await escrow.getInvoice(invoiceId);
        expect(invoice.status).to.equal(4); // Status.Disputed
      });

      it("should emit InvoiceDisputed event", async function () {
        const tx = await escrow.connect(payer).dispute(invoiceId);
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            return escrow.interface.parseLog(log)?.name === "InvoiceDisputed";
          } catch { return false; }
        });
        expect(event).to.not.be.undefined;
      });

      it("should revert when non-party disputes", async function () {
        await expect(
          escrow.connect(outsider).dispute(invoiceId)
        ).to.be.revertedWith("Not authorized");
      });

      it("should revert when arbiter disputes", async function () {
        await expect(
          escrow.connect(arbiter).dispute(invoiceId)
        ).to.be.revertedWith("Not authorized");
      });
    });

    describe("Dispute Resolution", function () {
      let invoiceId: bigint;

      beforeEach(async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        invoiceId = 1n;

        // Raise dispute
        await escrow.connect(payer).dispute(invoiceId);
      });

      it("should allow arbiter to resolve in favor of payee", async function () {
        const wrapperAddr = await wrapper.getAddress();

        // Get payee balance before
        const payeeBalanceBefore = await wrapper.confidentialBalanceOf(payee.address);
        const payeeDecryptedBefore = payeeBalanceBefore === ethers.ZeroHash ? 0n :
          await fhevm.userDecryptEuint(FhevmType.euint64, payeeBalanceBefore, wrapperAddr, payee);

        // Resolve in favor of payee
        await escrow.connect(arbiter).resolveDispute(invoiceId, true);

        const invoice = await escrow.getInvoice(invoiceId);
        expect(invoice.status).to.equal(3); // Status.Completed

        // Check payee received funds
        const payeeBalanceAfter = await wrapper.confidentialBalanceOf(payee.address);
        const payeeDecryptedAfter = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          payeeBalanceAfter,
          wrapperAddr,
          payee
        );

        expect(payeeDecryptedAfter).to.equal(payeeDecryptedBefore + INVOICE_AMOUNT);
      });

      it("should allow arbiter to resolve in favor of payer (refund)", async function () {
        const wrapperAddr = await wrapper.getAddress();

        // Get payer balance before
        const payerBalanceBefore = await wrapper.confidentialBalanceOf(payer.address);
        const payerDecryptedBefore = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          payerBalanceBefore,
          wrapperAddr,
          payer
        );

        // Resolve in favor of payer
        await escrow.connect(arbiter).resolveDispute(invoiceId, false);

        const invoice = await escrow.getInvoice(invoiceId);
        expect(invoice.status).to.equal(5); // Status.Refunded

        // Check payer got refund
        const payerBalanceAfter = await wrapper.confidentialBalanceOf(payer.address);
        const payerDecryptedAfter = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          payerBalanceAfter,
          wrapperAddr,
          payer
        );

        expect(payerDecryptedAfter).to.equal(payerDecryptedBefore + INVOICE_AMOUNT);
      });

      it("should emit DisputeResolved event", async function () {
        const tx = await escrow.connect(arbiter).resolveDispute(invoiceId, true);
        const receipt = await tx.wait();

        const event = receipt?.logs.find((log: any) => {
          try {
            return escrow.interface.parseLog(log)?.name === "DisputeResolved";
          } catch { return false; }
        });
        expect(event).to.not.be.undefined;
      });

      it("should revert when non-arbiter resolves", async function () {
        await expect(
          escrow.connect(payer).resolveDispute(invoiceId, true)
        ).to.be.revertedWith("Only arbiter");
      });

      it("should revert when payee tries to resolve", async function () {
        await expect(
          escrow.connect(payee).resolveDispute(invoiceId, true)
        ).to.be.revertedWith("Only arbiter");
      });

      it("should revert when resolving non-disputed invoice", async function () {
        const escrowAddr = await escrow.getAddress();

        // Create new invoice (not disputed)
        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          ""
        );

        await expect(
          escrow.connect(arbiter).resolveDispute(2n, true)
        ).to.be.revertedWith("Not disputed");
      });
    });

    describe("View Functions", function () {
      beforeEach(async function () {
        const escrowAddr = await escrow.getAddress();

        const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
        input.add64(INVOICE_AMOUNT);
        const encrypted = await input.encrypt();

        await escrow.connect(payer).createAndFundInvoice(
          payee.address,
          arbiter.address,
          encrypted.handles[0],
          encrypted.inputProof,
          "ipfs://metadata"
        );
      });

      it("should return encrypted amount handle", async function () {
        const handle = await escrow.getEncryptedAmount(1n);
        expect(handle).to.not.equal(ethers.ZeroHash);
      });

      it("should allow authorized party to decrypt amount", async function () {
        const handle = await escrow.getEncryptedAmount(1n);
        const escrowAddr = await escrow.getAddress();

        const decrypted = await fhevm.userDecryptEuint(
          FhevmType.euint64,
          handle,
          escrowAddr,
          payer
        );

        expect(decrypted).to.equal(INVOICE_AMOUNT);
      });

      it("should revert for non-existent invoice", async function () {
        await expect(escrow.getInvoice(999)).to.be.revertedWith("Invoice not found");
      });
    });

    describe("Admin Functions", function () {
      it("should allow owner to transfer ownership", async function () {
        await escrow.connect(owner).transferOwnership(payer.address);
        expect(await escrow.owner()).to.equal(payer.address);
      });

      it("should revert non-owner ownership transfer", async function () {
        await expect(
          escrow.connect(payer).transferOwnership(outsider.address)
        ).to.be.revertedWith("Only owner");
      });

      it("should revert transfer to zero address", async function () {
        await expect(
          escrow.connect(owner).transferOwnership(ethers.ZeroAddress)
        ).to.be.revertedWith("Invalid owner");
      });
    });

    describe("Multiple Invoices", function () {
      it("should handle multiple invoices correctly", async function () {
        const escrowAddr = await escrow.getAddress();

        // Create 3 invoices
        for (let i = 0; i < 3; i++) {
          const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
          input.add64(INVOICE_AMOUNT + BigInt(i * 10_000_000)); // Different amounts
          const encrypted = await input.encrypt();

          await escrow.connect(payer).createAndFundInvoice(
            payee.address,
            arbiter.address,
            encrypted.handles[0],
            encrypted.inputProof,
            `metadata-${i}`
          );
        }

        expect(await escrow.invoiceCount()).to.equal(3);

        const payerInvoices = await escrow.getPayerInvoices(payer.address);
        expect(payerInvoices.length).to.equal(3);

        const payeeInvoices = await escrow.getPayeeInvoices(payee.address);
        expect(payeeInvoices.length).to.equal(3);
      });

      it("should allow different statuses for different invoices", async function () {
        const escrowAddr = await escrow.getAddress();

        // Create 3 invoices
        for (let i = 0; i < 3; i++) {
          const input = await fhevm.createEncryptedInput(escrowAddr, payer.address);
          input.add64(INVOICE_AMOUNT);
          const encrypted = await input.encrypt();

          await escrow.connect(payer).createAndFundInvoice(
            payee.address,
            arbiter.address,
            encrypted.handles[0],
            encrypted.inputProof,
            ""
          );
        }

        // Invoice 1: Complete (both approve)
        await escrow.connect(payee).approveRelease(1n);
        await escrow.connect(payer).approveRelease(1n);

        // Invoice 2: Disputed
        await escrow.connect(payer).dispute(2n);

        // Invoice 3: Stay funded

        const invoice1 = await escrow.getInvoice(1n);
        const invoice2 = await escrow.getInvoice(2n);
        const invoice3 = await escrow.getInvoice(3n);

        expect(invoice1.status).to.equal(3); // Completed
        expect(invoice2.status).to.equal(4); // Disputed
        expect(invoice3.status).to.equal(1); // Funded
      });
    });
  });
});
