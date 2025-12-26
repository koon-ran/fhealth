/**
 * FHEVM Hooks - Index Export
 * Provides all FHEVM-related hooks for confidential transactions
 */

// Context & Provider
export { FhevmProvider } from './FhevmProvider';
export { useFhevm } from './useFhevmContext';
export type { FhevmContextType } from './FhevmContext';

// Encryption/Decryption
export { useFhevmEncrypt } from './useFhevmEncrypt';
export type { EncryptedAmount } from './useFhevmEncrypt';
export { useFhevmDecrypt } from './useFhevmDecrypt';
export type { HandleContractPair } from './useFhevmDecrypt';

// Token & Escrow
export { useConfidentialToken } from './useConfidentialToken';
export type { TokenBalances } from './useConfidentialToken';
export { useConfidentialEscrow } from './useConfidentialEscrow';
export type { ConfidentialInvoice } from './useConfidentialEscrow';

// Re-export status enum
export { 
  ConfidentialInvoiceStatus,
  ConfidentialInvoiceStatusLabel,
} from '../contracts';
