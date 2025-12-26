/**
 * FHEVM Decryption Hook
 * Provides functions to decrypt encrypted values using signature-based authentication
 * Following Aruvi pattern exactly
 */

import { useCallback, useState } from 'react';
import { useAccount, useSignTypedData } from 'wagmi';
import { useFhevm } from './useFhevmContext';

export interface HandleContractPair {
  handle: string;
  contractAddress: string;
}

export function useFhevmDecrypt() {
  const { instance, isReady, error } = useFhevm();
  const { address, isConnected } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<Error | null>(null);

  /**
   * Decrypt a single encrypted handle
   * @param handle - The encrypted handle to decrypt
   * @param contractAddress - The contract address that owns this value
   * @returns Decrypted value as bigint, or null on failure
   */
  const decryptHandle = useCallback(
    async (
      handle: string,
      contractAddress: string
    ): Promise<bigint | null> => {
      if (!instance || !address || !isReady || !isConnected) {
        setDecryptError(new Error('FHEVM not ready or wallet not connected'));
        return null;
      }

      // Empty handle = zero value
      if (!handle || handle === '0x' + '0'.repeat(64)) {
        return BigInt(0);
      }

      setIsDecrypting(true);
      setDecryptError(null);

      try {
        console.log('[FHEVM] Decrypting handle...');
        
        // Generate keypair for this decryption session
        const keypair = instance.generateKeypair();
        
        const handleContractPairs = [
          { handle, contractAddress },
        ];
        
        const startTimestamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '10';
        const contractAddresses = [contractAddress];

        // Create EIP-712 typed data
        const eip712 = instance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimestamp,
          durationDays
        );

        // User signs the typed data (triggers wallet popup)
        const signature = await signTypedDataAsync({
          domain: eip712.domain as Record<string, unknown>,
          types: { 
            UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification 
          } as Record<string, unknown>,
          message: eip712.message as Record<string, unknown>,
          primaryType: 'UserDecryptRequestVerification',
        });

        // Request decryption from relayer
        const result = await instance.userDecrypt(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contractAddresses,
          address,
          startTimestamp,
          durationDays
        );

        const value = result[handle];
        console.log('[FHEVM] Decryption successful');
        return typeof value === 'bigint' ? value : BigInt(value ?? 0);
      } catch (err) {
        console.error('[FHEVM] Decryption failed:', err);
        setDecryptError(err instanceof Error ? err : new Error('Decryption failed'));
        return null;
      } finally {
        setIsDecrypting(false);
      }
    },
    [instance, address, isReady, isConnected, signTypedDataAsync]
  );

  /**
   * Decrypt multiple handles at once (more efficient)
   * @param pairs - Array of handle/contract pairs
   * @returns Map of handle -> decrypted value, or null on failure
   */
  const decryptHandles = useCallback(
    async (
      pairs: HandleContractPair[]
    ): Promise<Record<string, bigint> | null> => {
      if (!instance || !address || !isReady || !isConnected) {
        setDecryptError(new Error('FHEVM not ready or wallet not connected'));
        return null;
      }

      // Filter valid handles
      const validPairs = pairs.filter(
        p => p.handle && p.handle !== '0x' + '0'.repeat(64)
      );

      if (validPairs.length === 0) {
        return {};
      }

      setIsDecrypting(true);
      setDecryptError(null);

      try {
        console.log('[FHEVM] Batch decrypting', validPairs.length, 'handles...');
        
        const keypair = instance.generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '10';
        const contractAddresses = Array.from(
          new Set(validPairs.map(pair => pair.contractAddress))
        );

        const eip712 = instance.createEIP712(
          keypair.publicKey,
          contractAddresses,
          startTimestamp,
          durationDays
        );

        const signature = await signTypedDataAsync({
          domain: eip712.domain as Record<string, unknown>,
          types: { 
            UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification 
          } as Record<string, unknown>,
          message: eip712.message as Record<string, unknown>,
          primaryType: 'UserDecryptRequestVerification',
        });

        const result = await instance.userDecrypt(
          validPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contractAddresses,
          address,
          startTimestamp,
          durationDays
        );

        const mapped: Record<string, bigint> = {};
        for (const pair of validPairs) {
          const value = result[pair.handle];
          mapped[pair.handle] = typeof value === 'bigint' ? value : BigInt(value ?? 0);
        }

        console.log('[FHEVM] Batch decryption successful');
        return mapped;
      } catch (err) {
        console.error('[FHEVM] Batch decryption failed:', err);
        setDecryptError(err instanceof Error ? err : new Error('Batch decryption failed'));
        return null;
      } finally {
        setIsDecrypting(false);
      }
    },
    [instance, address, isReady, isConnected, signTypedDataAsync]
  );

  return {
    decryptHandle,
    decryptHandles,
    isDecrypting,
    error: error || decryptError,
    isReady,
  };
}

export default useFhevmDecrypt;
