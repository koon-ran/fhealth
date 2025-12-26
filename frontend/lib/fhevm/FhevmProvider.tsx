/**
 * FHEVM Provider - Manages Fully Homomorphic Encryption instance
 * Uses Zama RelayerSDK 0.3.0-8 via CDN for encrypted blockchain operations
 * Following Aruvi pattern: https://github.com/ramakrishnanhulk20/Aruvi
 */

'use client';

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useAccount, useChainId } from 'wagmi';
import { FhevmContext } from './FhevmContext';

// Declare global types for the SDK loaded via CDN
declare global {
  interface Window {
    RelayerSDK?: RelayerSDKType;
    relayerSDK?: RelayerSDKType;
  }
}

interface RelayerSDKType {
  initSDK: () => Promise<void>;
  createInstance: (config: FhevmInstanceConfig) => Promise<FhevmInstance>;
  generateKeypair: () => { publicKey: string; privateKey: string };
  SepoliaConfig: FhevmConfig;
}

interface FhevmConfig {
  aclContractAddress: string;
  kmsContractAddress: string;
  inputVerifierContractAddress: string;
  verifyingContractAddressDecryption: string;
  verifyingContractAddressInputVerification: string;
  chainId: number;
  gatewayChainId: number;
  network: string | unknown;
  relayerUrl: string;
}

// Configuration for createInstance - only requires a subset of properties
interface FhevmInstanceConfig {
  verifyingContractAddressDecryption: string;
  verifyingContractAddressInputVerification: string;
  kmsContractAddress: string;
  aclContractAddress: string;
  gatewayChainId: number;
  network: unknown;
  publicKey?: Uint8Array;
  auth?: unknown;
}

// FHEVM Instance interface
export interface FhevmInstance {
  createEncryptedInput: (
    contractAddress: string,
    userAddress: string
  ) => EncryptedInput;
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contractAddresses: string[],
    startTimestamp: string,
    durationDays: string
  ) => EIP712Data;
  userDecrypt: (
    handleContractPairs: Array<{ handle: string; contractAddress: string }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: string[],
    userAddress: string,
    startTimestamp: string,
    durationDays: string
  ) => Promise<Record<string, bigint | string>>;
  publicDecrypt: (handles: string[]) => Promise<{
    clearValues: Record<string, bigint | string>;
  }>;
}

interface EncryptedInput {
  add32: (value: number) => EncryptedInput;
  add64: (value: bigint | number) => EncryptedInput;
  encrypt: () => Promise<{
    handles: `0x${string}`[];
    inputProof: `0x${string}`;
  }>;
}

interface EIP712Data {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: {
    UserDecryptRequestVerification: Array<{ name: string; type: string }>;
  };
  message: Record<string, unknown>;
}

// CDN URL for the Zama RelayerSDK 0.3.0-8
const RELAYER_SDK_CDN = 'https://cdn.zama.org/relayer-sdk-js/0.3.0-8/relayer-sdk-js.umd.cjs';

// Sepolia chain ID
const SEPOLIA_CHAIN_ID = 11155111;

interface FhevmProviderProps {
  children: React.ReactNode;
}

export function FhevmProvider({ children }: FhevmProviderProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [instance, setInstance] = useState<FhevmInstance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Get the SDK from window (v0.3.0-8 uses lowercase 'relayerSDK')
  const getSDK = useCallback((): RelayerSDKType | null => {
    return window.relayerSDK || window.RelayerSDK || null;
  }, []);

  // Load SDK from CDN
  const loadSDK = useCallback(async (): Promise<void> => {
    if (getSDK()) {
      console.log('[FHEVM] SDK already loaded');
      return;
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = RELAYER_SDK_CDN;
      script.async = true;
      script.type = 'text/javascript';
      
      script.onload = () => {
        console.log('[FHEVM] SDK loaded from CDN (v0.3.0-8)');
        resolve();
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load FHEVM SDK from CDN. Please check your network connection.'));
      };
      
      document.head.appendChild(script);
    });
  }, [getSDK]);

  // Initialize FHEVM instance
  const initialize = useCallback(async () => {
    if (!isConnected || !address || typeof window === 'undefined' || !window.ethereum) {
      console.log('[FHEVM] Waiting for wallet connection...');
      return;
    }

    if (chainId !== SEPOLIA_CHAIN_ID) {
      console.log('[FHEVM] Wrong chain, expected Sepolia (11155111)');
      setError(new Error('Please connect to Sepolia network'));
      return;
    }

    if (instance) {
      console.log('[FHEVM] Instance already exists');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Load SDK if not loaded
      await loadSDK();

      const sdk = getSDK();
      if (!sdk) {
        throw new Error('FHEVM SDK not available after loading. Please refresh the page.');
      }

      // Initialize SDK
      console.log('[FHEVM] Initializing SDK...');
      await sdk.initSDK();
      console.log('[FHEVM] SDK initialized');

      // Create instance - NO public key needed during initialization
      // Public key is only generated when decrypting (via generateKeypair())
      console.log('[FHEVM] Creating instance...');
      const fhevmInstance = await sdk.createInstance({
        ...sdk.SepoliaConfig,
        network: window.ethereum, // Override network with Ethereum provider
      });

      setInstance(fhevmInstance);
      console.log('[FHEVM] Instance created successfully');
    } catch (err) {
      console.error('[FHEVM] Initialization failed:', err);
      setError(err instanceof Error ? err : new Error('Failed to initialize FHEVM'));
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, chainId, instance, loadSDK, getSDK]);

  // Auto-initialize when wallet connects
  useEffect(() => {
    if (isConnected && address && chainId === SEPOLIA_CHAIN_ID && !instance && !isLoading) {
      initialize();
    }
  }, [isConnected, address, chainId, instance, isLoading, initialize]);

  // Reset on disconnect or chain change
  useEffect(() => {
    if (!isConnected || chainId !== SEPOLIA_CHAIN_ID) {
      setInstance(null);
      setError(null);
    }
  }, [isConnected, chainId]);

  const value = useMemo(
    () => ({
      instance,
      isReady: !!instance && isConnected,
      isLoading,
      error,
      initialize,
    }),
    [instance, isConnected, isLoading, error, initialize]
  );

  return (
    <FhevmContext.Provider value={value}>
      {children}
    </FhevmContext.Provider>
  );
}

export default FhevmProvider;
