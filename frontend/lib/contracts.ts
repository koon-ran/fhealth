// Contract addresses
export const CONTRACTS = {
  // Deployed to Sepolia (Original non-FHE escrow)
  ArcEscrow: '0x7cFE62E912368654E6b744CDf8FC057E7D5811C9' as `0x${string}`,
  // Circle USDC on Sepolia
  USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
  
  // ============================================================
  // FHE Confidential Contracts (Zama fhEVM)
  // ============================================================
  // ConfidentialUSDCWrapper - Wraps USDC into privacy-preserving cUSDC (ERC7984)
  CONFIDENTIAL_WRAPPER: '0x6ae83dBFc3BB167bceEF1A5e30C085Ab5c567cAC' as `0x${string}`,
  // ConfidentialEscrow - Privacy-preserving escrow with encrypted amounts
  CONFIDENTIAL_ESCROW: '0xec9dfC4bA90FDf5829b4212FAea03Ef43dcC10dE' as `0x${string}`,
  // Zama Gateway for decryption (required operator for balance reveal)
  ZAMA_GATEWAY: '0x096b4679d45fB675d4e2c1E4565009Cec99A12B1' as `0x${string}`,
} as const

// Hardcoded arbiter address
export const ARBITER_ADDRESS = '0x23BB8aAc3680b9834712365DAA23555D98C69310' as `0x${string}`

// ArcEscrow ABI
export const ARC_ESCROW_ABI = [
  {
    type: 'constructor',
    inputs: [
      { name: '_treasury', type: 'address' },
      { name: '_usdc', type: 'address' },
    ],
  },
  {
    type: 'function',
    name: 'createAndFundInvoice',
    inputs: [
      { name: '_payer', type: 'address' },
      { name: '_payee', type: 'address' },
      { name: '_arbiter', type: 'address' },
      { name: '_amount', type: 'uint256' },
      { name: '_title', type: 'string' },
    ],
    outputs: [{ name: 'invoiceId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveRelease',
    inputs: [{ name: '_invoiceId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'dispute',
    inputs: [
      { name: '_invoiceId', type: 'uint256' },
      { name: '_reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'arbitrateRelease',
    inputs: [{ name: '_invoiceId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'arbitrateRefund',
    inputs: [{ name: '_invoiceId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getInvoice',
    inputs: [{ name: '_invoiceId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'payer', type: 'address' },
          { name: 'payee', type: 'address' },
          { name: 'arbiter', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'payerApproved', type: 'bool' },
          { name: 'payeeApproved', type: 'bool' },
          { name: 'title', type: 'string' },
          { name: 'disputeReason', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'fundedAt', type: 'uint256' },
          { name: 'resolvedAt', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'invoiceCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'calculateFees',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_isDisputed', type: 'bool' },
    ],
    outputs: [
      { name: 'platformFee', type: 'uint256' },
      { name: 'arbiterFee', type: 'uint256' },
      { name: 'netAmount', type: 'uint256' },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'event',
    name: 'InvoiceCreated',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'payee', type: 'address', indexed: true },
      { name: 'arbiter', type: 'address', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FundsDeposited',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ApprovalGranted',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'approver', type: 'address', indexed: true },
      { name: 'isPayer', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'DisputeRaised',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'disputer', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FundsReleased',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payee', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'platformFee', type: 'uint256', indexed: false },
      { name: 'arbiterFee', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'FundsRefunded',
    inputs: [
      { name: 'invoiceId', type: 'uint256', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'platformFee', type: 'uint256', indexed: false },
      { name: 'arbiterFee', type: 'uint256', indexed: false },
    ],
  },
] as const

// USDC ERC20 ABI (minimal)
export const USDC_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

// Invoice status enum
export const InvoiceStatus = {
  CREATED: 0,
  FUNDED: 1,
  PENDING_APPROVAL: 2,
  RELEASED: 3,
  REFUNDED: 4,
  DISPUTED: 5,
  CANCELLED: 6,
} as const

export const InvoiceStatusLabel = {
  0: 'Created',
  1: 'Funded',
  2: 'Pending Approval',
  3: 'Released',
  4: 'Refunded',
  5: 'Disputed',
  6: 'Cancelled',
} as const

// Type definitions
export type Invoice = {
  id: bigint
  payer: `0x${string}`
  payee: `0x${string}`
  arbiter: `0x${string}`
  amount: bigint
  status: number
  payerApproved: boolean
  payeeApproved: boolean
  title: string
  disputeReason: string
  createdAt: bigint
  fundedAt: bigint
  resolvedAt: bigint
}

// Confidential invoice type (amounts are encrypted)
export type ConfidentialInvoice = {
  id: bigint
  payer: `0x${string}`
  payee: `0x${string}`
  arbiter: `0x${string}`
  // amount is encrypted, not visible
  status: number
  payerApproved: boolean
  payeeApproved: boolean
  metadataHash: string
  createdAt: bigint
  completedAt: bigint
}

// ============================================================
// FHE Confidential Token Config (following Aruvi pattern)
// ============================================================
export const TOKEN_CONFIG = {
  symbol: 'cUSDC',
  name: 'Confidential USDC',
  decimals: 6,
  underlyingSymbol: 'USDC',
  underlyingName: 'USD Coin',
} as const

// ============================================================
// Confidential Wrapper ABI (ERC7984)
// ============================================================
export const CONFIDENTIAL_WRAPPER_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'confidentialBalanceOf',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'confidentialTotalSupply',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    name: 'confidentialTransfer',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    name: 'confidentialTransferFrom',
    outputs: [{ name: 'transferred', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'holder', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'isOperator',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'until', type: 'uint48' },
    ],
    name: 'setOperator',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'underlying',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    name: 'unwrap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'wrap',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
    ],
    name: 'ConfidentialTransfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'holder', type: 'address' },
      { indexed: true, name: 'operator', type: 'address' },
      { indexed: false, name: 'until', type: 'uint48' },
    ],
    name: 'OperatorSet',
    type: 'event',
  },
] as const

// ============================================================
// Confidential Escrow ABI
// ============================================================
export const CONFIDENTIAL_ESCROW_ABI = [
  {
    inputs: [
      { name: 'payee', type: 'address' },
      { name: 'arbiter', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
      { name: 'metadataHash', type: 'string' },
    ],
    name: 'createAndFundInvoice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    name: 'approveRelease',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    name: 'dispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'invoiceId', type: 'uint256' },
      { name: 'payeeWins', type: 'bool' },
    ],
    name: 'resolveDispute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    name: 'getInvoice',
    outputs: [
      { name: 'payer', type: 'address' },
      { name: 'payee', type: 'address' },
      { name: 'arbiter', type: 'address' },
      { name: 'status', type: 'uint8' },
      { name: 'payerApproved', type: 'bool' },
      { name: 'payeeApproved', type: 'bool' },
      { name: 'metadataHash', type: 'string' },
      { name: 'createdAt', type: 'uint256' },
      { name: 'completedAt', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'payer', type: 'address' }],
    name: 'getPayerInvoices',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'payee', type: 'address' }],
    name: 'getPayeeInvoices',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'invoiceId', type: 'uint256' }],
    name: 'getEncryptedAmount',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'invoiceCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'defaultToken',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'invoiceId', type: 'uint256' },
      { indexed: true, name: 'payer', type: 'address' },
      { indexed: true, name: 'payee', type: 'address' },
      { indexed: false, name: 'arbiter', type: 'address' },
      { indexed: false, name: 'metadataHash', type: 'string' },
    ],
    name: 'InvoiceCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'invoiceId', type: 'uint256' }],
    name: 'InvoiceFunded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'invoiceId', type: 'uint256' },
      { indexed: true, name: 'approver', type: 'address' },
    ],
    name: 'ApprovalGranted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'invoiceId', type: 'uint256' }],
    name: 'InvoiceCompleted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'invoiceId', type: 'uint256' },
      { indexed: true, name: 'disputer', type: 'address' },
    ],
    name: 'InvoiceDisputed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: true, name: 'invoiceId', type: 'uint256' }],
    name: 'InvoiceRefunded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'invoiceId', type: 'uint256' },
      { indexed: false, name: 'payeeWins', type: 'bool' },
    ],
    name: 'DisputeResolved',
    type: 'event',
  },
] as const

// Confidential Invoice Status enum
export const ConfidentialInvoiceStatus = {
  CREATED: 0,
  FUNDED: 1,
  APPROVED: 2,
  COMPLETED: 3,
  DISPUTED: 4,
  REFUNDED: 5,
  CANCELLED: 6,
} as const

export type ConfidentialInvoiceStatusType = typeof ConfidentialInvoiceStatus[keyof typeof ConfidentialInvoiceStatus]

export const ConfidentialInvoiceStatusLabel: Record<ConfidentialInvoiceStatusType, string> = {
  0: 'Created',
  1: 'Funded',
  2: 'Approved',
  3: 'Completed',
  4: 'Disputed',
  5: 'Refunded',
  6: 'Cancelled',
} as const
