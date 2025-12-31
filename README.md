# FHEscrow

A privacy-preserving escrow payment system built on Ethereum using Fully Homomorphic Encryption (FHE). FHEscrow enables confidential escrow transactions where payment amounts remain encrypted on-chain, visible only to authorized parties.

video demo: https://www.loom.com/share/af57f6d8601c4cc7845d5f34afd84b5d

## Overview

FHEscrow provides two escrow modes:

- **Standard Escrow**: Traditional on-chain escrow with public payment amounts
- **Confidential Escrow**: Privacy-preserving escrow using Zama's fhEVM where amounts are encrypted

Both modes support a sequential approval workflow with dispute resolution through a designated arbiter.

## Architecture

```
FHEscrow/
├── contract/           # Foundry smart contracts (standard escrow)
├── contracts-fhe/      # Hardhat smart contracts (confidential escrow)
└── frontend/           # Next.js web application
```

## Smart Contracts

### Standard Escrow (Foundry)

**Escrow.sol** - Public escrow contract using USDC
- Payer creates and funds invoice
- Payee requests payment upon work completion
- Payer approves release or raises dispute
- Arbiter resolves disputes

### Confidential Escrow (Hardhat + fhEVM)

**ConfidentialEscrow.sol** - FHE-encrypted escrow contract
- Payment amounts stored as encrypted `euint64` values
- Only payer, payee, and arbiter can decrypt amounts
- Uses Zama Gateway for decryption operations

**ConfidentialUSDCWrapper.sol** - ERC7984 confidential token wrapper
- Wraps USDC into confidential cUSDC
- Supports encrypted balances and transfers
- Gateway operator authorization for decryption

## Payment Flow

1. **Payer** creates invoice and deposits funds (USDC or cUSDC)
2. **Payee** completes work and requests payment
3. **Payer** reviews and either:
   - Approves release (funds transferred to payee)
   - Raises dispute (arbiter intervention required)
4. **Arbiter** (if disputed) reviews and decides to release or refund

## Technology Stack

### Smart Contracts
- Solidity 0.8.27
- Foundry (standard contracts)
- Hardhat (confidential contracts)
- OpenZeppelin Contracts
- OpenZeppelin Confidential Contracts
- Zama fhEVM (Fully Homomorphic Encryption)

### Frontend
- Next.js 16 with Turbopack
- TypeScript
- wagmi / viem for Web3 interactions
- RainbowKit for wallet connection
- Tailwind CSS

### Network
- Ethereum Sepolia Testnet
- Circle USDC (testnet)
- Zama fhEVM Coprocessor


## Getting Started

### Prerequisites

- Node.js 18+
- Foundry
- A wallet with Sepolia ETH and USDC

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

### Contract Development

**Foundry (Standard Contracts)**
```bash
cd contract
forge build
forge test
```

**Hardhat (Confidential Contracts)**
```bash
cd contracts-fhe
npm install
npx hardhat compile
npx hardhat deploy --network sepolia
```

## Usage

### Creating a Standard Invoice

1. Connect wallet
2. Navigate to Create Invoice
3. Enter payee address and amount
4. Approve USDC and create invoice

### Creating a Confidential Invoice

1. Connect wallet
2. Authorize Gateway operator (one-time setup)
3. Wrap USDC to cUSDC on the Wrap page
4. Navigate to Create Confidential Invoice
5. Enter payee address and amount (will be encrypted)
6. Create invoice

### Decrypting Amounts

Authorized parties (payer, payee, arbiter) can decrypt confidential amounts by:
1. Opening the invoice detail page
2. Clicking the decrypt button
3. Signing the decryption request

## Security Considerations

- Encrypted amounts are secured by Zama's FHEVM
- Only authorized parties can request decryption via the Gateway
- Smart contracts use OpenZeppelin's audited implementations
- Dispute resolution requires arbiter intervention

## License

MIT
