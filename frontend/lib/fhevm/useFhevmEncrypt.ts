/**
 * FHEVM Encryption Hook
 * Provides functions to encrypt amounts for confidential transactions
 * Following Aruvi pattern exactly
 */

import { useCallback, useState } from 'react';
import { useAccount } from 'wagmi';
import { toHex } from 'viem';
import { useFhevm } from './useFhevmContext';

export interface EncryptedAmount {
  handles: `0x${string}`[];
  inputProof: `0x${string}`;
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(arr: Uint8Array): `0x${string}` {
  return toHex(arr);
}

export function useFhevmEncrypt() {
  const { instance, isReady, error } = useFhevm();
  const { address, isConnected } = useAccount();
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [encryptError, setEncryptError] = useState<Error | null>(null);

  // Max uint64 value for validation
  const MAX_UINT64 = BigInt('18446744073709551615');

  /**
   * Encrypt an amount for a specific contract
   * @param amount - The amount to encrypt (in token decimals)
   * @param contractAddress - The contract that will receive the encrypted value
   * @returns Encrypted handles and proof, or null on failure
   */
  const encryptAmount = useCallback(
    async (
      amount: bigint,
      contractAddress: string
    ): Promise<EncryptedAmount | null> => {
      if (!instance || !address || !isReady || !isConnected) {
        setEncryptError(new Error('FHEVM not ready or wallet not connected'));
        return null;
      }

      // Validate amount bounds for uint64 encryption
      if (amount < BigInt(0) || amount > MAX_UINT64) {
        setEncryptError(new Error('Amount out of range for uint64 encryption'));
        return null;
      }

      setIsEncrypting(true);
      setEncryptError(null);

      try {
        console.log('[FHEVM] Encrypting amount:', amount.toString());
        
        const encryptedInput = instance.createEncryptedInput(
          contractAddress,
          address
        );
        
        const result = await encryptedInput.add64(amount).encrypt();
        
        console.log('[FHEVM] Raw encryption result:', result);
        
        // SDK returns Uint8Array - convert to hex strings for viem
        const { handles, inputProof } = result;
        
        // Convert handles array to hex strings
        const hexHandles = handles.map((h: unknown) => {
          if (typeof h === 'string' && h.startsWith('0x')) {
            return h as `0x${string}`;
          }
          return uint8ArrayToHex(h as Uint8Array);
        });
        
        // Convert inputProof to hex string
        const hexProof = typeof inputProof === 'string' && inputProof.startsWith('0x')
          ? inputProof as `0x${string}`
          : uint8ArrayToHex(inputProof as unknown as Uint8Array);
        
        console.log('[FHEVM] Converted - handles:', hexHandles, 'proof:', hexProof);
        
        return { handles: hexHandles, inputProof: hexProof };
      } catch (err) {
        console.error('[FHEVM] Encryption failed:', err);
        setEncryptError(err instanceof Error ? err : new Error('Encryption failed'));
        return null;
      } finally {
        setIsEncrypting(false);
      }
    },
    [instance, address, isReady, isConnected]
  );

  return {
    encryptAmount,
    isEncrypting,
    error: error || encryptError,
    isReady,
  };
}

export default useFhevmEncrypt;
