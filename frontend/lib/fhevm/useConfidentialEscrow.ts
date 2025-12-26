/**
 * Confidential Escrow Hook
 * Handles creating, funding, and managing confidential invoices
 * with encrypted payment amounts
 */

import { useCallback, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, formatUnits, Address, Abi, decodeEventLog } from 'viem';
import { useFhevm } from './useFhevmContext';
import { useFhevmEncrypt } from './useFhevmEncrypt';
import { useFhevmDecrypt } from './useFhevmDecrypt';
import { 
  CONTRACTS, 
  TOKEN_CONFIG,
  CONFIDENTIAL_ESCROW_ABI,
  ConfidentialInvoiceStatus,
  ConfidentialInvoiceStatusLabel,
  ConfidentialInvoiceStatusType,
} from '../contracts';

export interface ConfidentialInvoice {
  id: bigint;
  client: Address;
  provider: Address;
  arbiter: Address;
  status: ConfidentialInvoiceStatusType;
  clientApproved: boolean;
  providerApproved: boolean;
  metadataHash: string;
  createdAt: bigint;
  completedAt: bigint;
  decryptedAmount?: string; // Decrypted amount in display format (if user is authorized)
}

export function useConfidentialEscrow() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const { instance, isReady } = useFhevm();
  const { encryptAmount, isEncrypting } = useFhevmEncrypt();
  const { decryptHandle, isDecrypting } = useFhevmDecrypt();
  
  const [isCreating, setIsCreating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDisputing, setIsDisputing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const decimals = TOKEN_CONFIG.decimals;
  const escrowAddress = CONTRACTS.CONFIDENTIAL_ESCROW as Address;
  const wrapperAddress = CONTRACTS.CONFIDENTIAL_WRAPPER as Address;

  // ERC7984 operator management for confidential wrapper
  const WRAPPER_OPERATOR_ABI = [
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'operator', type: 'address' },
      ],
      name: 'isOperator',
      outputs: [{ name: '', type: 'bool' }],
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
  ] as const;

  /**
   * Get current invoice count
   */
  const getInvoiceCount = useCallback(async (): Promise<bigint | null> => {
    if (!publicClient) return null;

    try {
      const count = await publicClient.readContract({
        address: escrowAddress,
        abi: CONFIDENTIAL_ESCROW_ABI as Abi,
        functionName: 'nextInvoiceId',
        args: [],
      });
      return count as bigint;
    } catch (err) {
      console.error('[ConfidentialEscrow] Failed to get invoice count:', err);
      return null;
    }
  }, [publicClient, escrowAddress]);

  /**
   * Get raw invoice data from contract
   */
  const getInvoice = useCallback(async (invoiceId: bigint): Promise<ConfidentialInvoice | null> => {
    if (!publicClient) return null;

    try {
      const data = await publicClient.readContract({
        address: escrowAddress,
        abi: CONFIDENTIAL_ESCROW_ABI as Abi,
        functionName: 'getInvoice',
        args: [invoiceId],
      });

      // getInvoice returns: [payer, payee, arbiter, status, payerApproved, payeeApproved, metadataHash, createdAt, completedAt]
      const [client, provider, arbiter, status, payerApproved, payeeApproved, metadataHash, createdAt, completedAt] = data as [Address, Address, Address, number, boolean, boolean, string, bigint, bigint];

      return {
        id: invoiceId,
        client,
        provider,
        arbiter,
        status: status as ConfidentialInvoiceStatusType,
        clientApproved: payerApproved,
        providerApproved: payeeApproved,
        metadataHash,
        createdAt,
        completedAt,
        decryptedAmount: undefined,
      };
    } catch (err) {
      console.error('[ConfidentialEscrow] Failed to get invoice:', err);
      return null;
    }
  }, [publicClient, escrowAddress]);

  /**
   * Get invoice with decrypted amount
   * Fetches encrypted amount handle and decrypts it for authorized parties
   */
  const getInvoiceWithDecryption = useCallback(
    async (invoiceId: bigint): Promise<ConfidentialInvoice | null> => {
      const invoice = await getInvoice(invoiceId);
      if (!invoice || !isReady || !address) return invoice;

      try {
        // Get encrypted amount handle from contract
        console.log('[ConfidentialEscrow] Fetching encrypted amount for invoice', invoiceId.toString());
        const encryptedHandle = await publicClient?.readContract({
          address: escrowAddress,
          abi: CONFIDENTIAL_ESCROW_ABI as Abi,
          functionName: 'getEncryptedAmount',
          args: [invoiceId],
        });

        console.log('[ConfidentialEscrow] Encrypted handle:', encryptedHandle);

        if (!encryptedHandle) {
          console.log('[ConfidentialEscrow] No encrypted handle returned');
          return invoice;
        }

        // Decrypt the amount
        console.log('[ConfidentialEscrow] Attempting to decrypt...');
        const decryptedValue = await decryptHandle(
          encryptedHandle as `0x${string}`,
          escrowAddress
        );

        console.log('[ConfidentialEscrow] Decrypted value:', decryptedValue);

        if (decryptedValue !== null) {
          invoice.decryptedAmount = formatUnits(decryptedValue, decimals);
          console.log('[ConfidentialEscrow] Formatted amount:', invoice.decryptedAmount);
        } else {
          console.warn('[ConfidentialEscrow] Decryption returned null');
        }
      } catch (err) {
        console.error('[ConfidentialEscrow] Decryption error:', err);
        // Return invoice without decrypted amount - this is OK
      }

      return invoice;
    },
    [getInvoice, isReady, address, publicClient, escrowAddress, decryptHandle, decimals]
  );

  /**
   * Get invoices for current user (as client or provider)
   */
  const getMyInvoices = useCallback(async (): Promise<ConfidentialInvoice[]> => {
    if (!address || !publicClient) return [];

    try {
      const count = await getInvoiceCount();
      if (!count) return [];

      const invoices: ConfidentialInvoice[] = [];
      
      // Fetch all invoices and filter for user
      for (let i = BigInt(0); i < count; i++) {
        const invoice = await getInvoice(i);
        if (invoice) {
          const isParty = 
            address.toLowerCase() === invoice.client.toLowerCase() ||
            address.toLowerCase() === invoice.provider.toLowerCase() ||
            address.toLowerCase() === invoice.arbiter.toLowerCase();
          
          if (isParty) {
            invoices.push(invoice);
          }
        }
      }

      return invoices;
    } catch (err) {
      console.error('[ConfidentialEscrow] Failed to get invoices:', err);
      return [];
    }
  }, [address, publicClient, getInvoiceCount, getInvoice]);

  /**
   * Create and fund a confidential invoice
   */
  const createAndFundInvoice = useCallback(
    async (
      provider: Address,
      arbiter: Address,
      amount: string,
      metadataHash: string = '' // Optional IPFS hash
    ): Promise<{ hash: `0x${string}`; invoiceId: bigint } | null> => {
      if (!walletClient || !address || !instance) {
        setError(new Error('Wallet or FHEVM not ready'));
        return null;
      }

      setIsCreating(true);
      setError(null);

      try {
        const parsedAmount = parseUnits(amount, decimals);

        // 1. Check and set escrow as operator on cUSDC wrapper
        // ERC7984 uses operator pattern, not ERC20 allowance
        const isOperator = await publicClient?.readContract({
          address: wrapperAddress,
          abi: WRAPPER_OPERATOR_ABI,
          functionName: 'isOperator',
          args: [address, escrowAddress],
        });

        if (!isOperator) {
          console.log('[ConfidentialEscrow] Setting escrow as operator...');
          // Set operator for 1 year
          const until = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
          const operatorHash = await walletClient.writeContract({
            address: wrapperAddress,
            abi: WRAPPER_OPERATOR_ABI,
            functionName: 'setOperator',
            args: [escrowAddress, until],
          });
          
          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: operatorHash });
          }
        }

        // 2. Encrypt the amount
        console.log('[ConfidentialEscrow] Encrypting amount...');
        const encrypted = await encryptAmount(parsedAmount, escrowAddress);
        if (!encrypted) {
          throw new Error('Failed to encrypt amount');
        }

        // 3. Create and fund the invoice
        console.log('[ConfidentialEscrow] Creating invoice...');
        const hash = await walletClient.writeContract({
          address: escrowAddress,
          abi: CONFIDENTIAL_ESCROW_ABI as Abi,
          functionName: 'createAndFundInvoice',
          args: [
            provider,
            arbiter,
            encrypted.handles[0],
            encrypted.inputProof,
            metadataHash,
          ],
        });

        console.log('[ConfidentialEscrow] Invoice tx:', hash);

        // 4. Wait for confirmation and extract invoice ID
        let invoiceId = BigInt(0);
        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          
          // Parse InvoiceCreated event to get ID
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: CONFIDENTIAL_ESCROW_ABI as Abi,
                data: log.data,
                topics: log.topics,
              });
              
              if (decoded.eventName === 'InvoiceCreated' && decoded.args) {
                const args = decoded.args as unknown as { invoiceId: bigint };
                invoiceId = args.invoiceId;
                break;
              }
            } catch {
              // Not our event, continue
            }
          }
        }

        console.log('[ConfidentialEscrow] Invoice created, ID:', invoiceId.toString());

        return { hash, invoiceId };
      } catch (err) {
        console.error('[ConfidentialEscrow] createAndFundInvoice failed:', err);
        setError(err instanceof Error ? err : new Error('Create invoice failed'));
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [
      walletClient, 
      address, 
      publicClient, 
      instance, 
      wrapperAddress, 
      escrowAddress, 
      decimals, 
      encryptAmount
    ]
  );

  /**
   * Client approves release of funds to provider
   */
  const approveRelease = useCallback(
    async (invoiceId: bigint): Promise<`0x${string}` | null> => {
      if (!walletClient || !address) {
        setError(new Error('Wallet not connected'));
        return null;
      }

      setIsApproving(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: escrowAddress,
          abi: CONFIDENTIAL_ESCROW_ABI as Abi,
          functionName: 'approveRelease',
          args: [invoiceId],
        });

        console.log('[ConfidentialEscrow] approveRelease tx:', hash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        return hash;
      } catch (err) {
        console.error('[ConfidentialEscrow] approveRelease failed:', err);
        setError(err instanceof Error ? err : new Error('Approve release failed'));
        return null;
      } finally {
        setIsApproving(false);
      }
    },
    [walletClient, address, publicClient, escrowAddress]
  );

  /**
   * Dispute an invoice
   */
  const dispute = useCallback(
    async (invoiceId: bigint): Promise<`0x${string}` | null> => {
      if (!walletClient || !address) {
        setError(new Error('Wallet not connected'));
        return null;
      }

      setIsDisputing(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: escrowAddress,
          abi: CONFIDENTIAL_ESCROW_ABI as Abi,
          functionName: 'dispute',
          args: [invoiceId],
        });

        console.log('[ConfidentialEscrow] dispute tx:', hash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        return hash;
      } catch (err) {
        console.error('[ConfidentialEscrow] dispute failed:', err);
        setError(err instanceof Error ? err : new Error('Dispute failed'));
        return null;
      } finally {
        setIsDisputing(false);
      }
    },
    [walletClient, address, publicClient, escrowAddress]
  );

  /**
   * Arbiter resolves a dispute
   * @param releaseToProvider - true: release to provider, false: refund to client
   */
  const resolveDispute = useCallback(
    async (invoiceId: bigint, releaseToProvider: boolean): Promise<`0x${string}` | null> => {
      if (!walletClient || !address) {
        setError(new Error('Wallet not connected'));
        return null;
      }

      setIsResolving(true);
      setError(null);

      try {
        const hash = await walletClient.writeContract({
          address: escrowAddress,
          abi: CONFIDENTIAL_ESCROW_ABI as Abi,
          functionName: 'resolveDispute',
          args: [invoiceId, releaseToProvider],
        });

        console.log('[ConfidentialEscrow] resolveDispute tx:', hash);

        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash });
        }

        return hash;
      } catch (err) {
        console.error('[ConfidentialEscrow] resolveDispute failed:', err);
        setError(err instanceof Error ? err : new Error('Resolve dispute failed'));
        return null;
      } finally {
        setIsResolving(false);
      }
    },
    [walletClient, address, publicClient, escrowAddress]
  );

  /**
   * Get status label for display
   */
  const getStatusLabel = useCallback((status: ConfidentialInvoiceStatusType): string => {
    return ConfidentialInvoiceStatusLabel[status] || 'Unknown';
  }, []);

  return {
    // Read functions
    getInvoiceCount,
    getInvoice,
    getInvoiceWithDecryption,
    getMyInvoices,
    getStatusLabel,
    // Actions
    createAndFundInvoice,
    approveRelease,
    dispute,
    resolveDispute,
    // State
    isCreating,
    isApproving,
    isDisputing,
    isResolving,
    isEncrypting,
    isDecrypting,
    error,
    isReady,
    // Constants
    decimals,
    escrowAddress,
    InvoiceStatus: ConfidentialInvoiceStatus,
  };
}

export default useConfidentialEscrow;
