/**
 * Confidential Token Hook
 * Manages ERC7984 confidential wrapper operations following Aruvi pattern:
 * - Balance queries (ERC20 and confidential)
 * - Wrap/Unwrap operations
 * - Operator management
 * - Balance decryption (explicit reveal)
 */

import { useCallback, useState, useMemo, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseAbi, formatUnits, parseUnits, Address } from 'viem';
import { CONTRACTS, TOKEN_CONFIG } from '../contracts';
import { useFhevmEncrypt } from './useFhevmEncrypt';
import { useFhevmDecrypt } from './useFhevmDecrypt';
import { useFhevm } from './useFhevmContext';

// ABIs
const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]);

const WRAPPER_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function confidentialBalanceOf(address) view returns (bytes32)',
  'function decimals() view returns (uint8)',
  'function isOperator(address owner, address operator) view returns (bool)',
  'function wrap(address to, uint256 amount)',
  'function unwrap(address from, address to, bytes32 encryptedAmount, bytes inputProof)',
  'function confidentialTransfer(address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)',
  'function setOperator(address operator, uint48 until)',
]);

export interface TokenBalances {
  usdc: string;
  cusdc: string | null; // null if not yet decrypted
  usdcRaw: bigint;
  cusdcRaw: bigint | null;
}

export function useConfidentialToken() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const { isReady: fhevmReady } = useFhevm();
  const { encryptAmount, isEncrypting } = useFhevmEncrypt();
  const { decryptHandle, isDecrypting } = useFhevmDecrypt();

  // Local state for decrypted balance (must be explicitly revealed)
  const [decryptedBalance, setDecryptedBalance] = useState<bigint | null>(null);
  const [isWrapping, setIsWrapping] = useState(false);
  const [isUnwrapping, setIsUnwrapping] = useState(false);
  const [isSettingOperator, setIsSettingOperator] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const wrapperAddress = CONTRACTS.CONFIDENTIAL_WRAPPER as Address;
  const usdcAddress = CONTRACTS.USDC as Address;

  // Read ERC20 USDC balance
  const { 
    data: erc20Balance, 
    refetch: refetchErc20,
    isLoading: isLoadingErc20 
  } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read ERC20 allowance for wrapper
  const { 
    data: erc20Allowance, 
    refetch: refetchAllowance 
  } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, wrapperAddress] : undefined,
    query: { enabled: !!address },
  });

  // Read confidential balance handle (encrypted - NOT decrypted!)
  const { 
    data: confidentialBalanceHandle, 
    refetch: refetchConfidential,
    isLoading: isLoadingConfidential 
  } = useReadContract({
    address: wrapperAddress,
    abi: WRAPPER_ABI,
    functionName: 'confidentialBalanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Check if Zama gateway is set as operator (required for decryption)
  const { 
    data: isOperatorValid, 
    refetch: refetchOperator 
  } = useReadContract({
    address: wrapperAddress,
    abi: WRAPPER_ABI,
    functionName: 'isOperator',
    args: address ? [address, CONTRACTS.ZAMA_GATEWAY as Address] : undefined,
    query: { enabled: !!address },
  });

  // Formatted balances
  const formattedErc20Balance = useMemo(() => {
    if (!erc20Balance) return '0.00';
    return formatUnits(erc20Balance as bigint, TOKEN_CONFIG.decimals);
  }, [erc20Balance]);

  const formattedDecryptedBalance = useMemo(() => {
    if (decryptedBalance === null) return null;
    return formatUnits(decryptedBalance, TOKEN_CONFIG.decimals);
  }, [decryptedBalance]);

  // Check if handle is non-zero (has balance)
  const hasConfidentialBalance = useMemo(() => {
    if (!confidentialBalanceHandle) return false;
    const handle = confidentialBalanceHandle as string;
    return handle !== '0x' + '0'.repeat(64);
  }, [confidentialBalanceHandle]);

  // Approve USDC for wrapping
  const approveForWrap = useCallback(
    async (amount: bigint) => {
      if (!address || !isConnected) {
        console.error('[Token] Not connected');
        return null;
      }

      try {
        console.log('[Token] Approving', amount.toString(), 'for wrapper...');
        
        const hash = await writeContractAsync({
          address: usdcAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [wrapperAddress, amount],
        });

        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === 'reverted') {
            throw new Error('USDC approval transaction reverted.');
          }
        }

        await refetchAllowance();
        console.log('[Token] Approval successful');
        return hash;
      } catch (err) {
        console.error('[Token] Approval failed:', err);
        throw err;
      }
    },
    [address, isConnected, writeContractAsync, publicClient, refetchAllowance, usdcAddress, wrapperAddress]
  );

  // Wrap USDC to confidential cUSDC
  const wrap = useCallback(
    async (amount: string) => {
      if (!address || !isConnected) {
        console.error('[Token] Not connected');
        return null;
      }

      setIsWrapping(true);

      try {
        const parsedAmount = parseUnits(amount, TOKEN_CONFIG.decimals);

        // Check allowance
        const currentAllowance = (erc20Allowance as bigint) || BigInt(0);
        if (currentAllowance < parsedAmount) {
          console.log('[Token] Insufficient allowance, approving...');
          await approveForWrap(parsedAmount);
        }

        console.log('[Token] Wrapping', parsedAmount.toString(), 'USDC...');
        
        const hash = await writeContractAsync({
          address: wrapperAddress,
          abi: WRAPPER_ABI,
          functionName: 'wrap',
          args: [address, parsedAmount],
          gas: BigInt(500000),
        });

        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === 'reverted') {
            throw new Error('Wrap transaction reverted. Check USDC balance and approval.');
          }
        }

        await Promise.all([refetchErc20(), refetchConfidential()]);
        // Clear decrypted balance since it changed
        setDecryptedBalance(null);
        console.log('[Token] Wrap successful');
        return hash;
      } catch (err) {
        console.error('[Token] Wrap failed:', err);
        throw err;
      } finally {
        setIsWrapping(false);
      }
    },
    [address, isConnected, erc20Allowance, approveForWrap, writeContractAsync, publicClient, refetchErc20, refetchConfidential, wrapperAddress]
  );

  // Unwrap cUSDC to USDC
  const unwrap = useCallback(
    async (amount: string) => {
      if (!address || !isConnected || !fhevmReady) {
        console.error('[Token] Not ready for unwrap');
        return null;
      }

      setIsUnwrapping(true);

      try {
        const parsedAmount = parseUnits(amount, TOKEN_CONFIG.decimals);
        
        console.log('[Token] Encrypting amount for unwrap...');
        
        const encrypted = await encryptAmount(parsedAmount, wrapperAddress);
        if (!encrypted || !encrypted.handles[0]) {
          throw new Error('Failed to encrypt amount');
        }

        console.log('[Token] Unwrapping', parsedAmount.toString(), 'cUSDC...');
        
        const hash = await writeContractAsync({
          address: wrapperAddress,
          abi: WRAPPER_ABI,
          functionName: 'unwrap',
          args: [address, address, encrypted.handles[0], encrypted.inputProof],
          gas: BigInt(800000),
        });

        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === 'reverted') {
            throw new Error('Unwrap transaction reverted. Check cUSDC balance.');
          }
        }

        await Promise.all([refetchErc20(), refetchConfidential()]);
        // Clear decrypted balance since it changed
        setDecryptedBalance(null);
        console.log('[Token] Unwrap successful');
        return hash;
      } catch (err) {
        console.error('[Token] Unwrap failed:', err);
        throw err;
      } finally {
        setIsUnwrapping(false);
      }
    },
    [address, isConnected, fhevmReady, encryptAmount, writeContractAsync, publicClient, refetchErc20, refetchConfidential, wrapperAddress]
  );

  // Set Zama gateway as operator (required for decryption)
  const setGatewayAsOperator = useCallback(async () => {
    if (!address || !isConnected) {
      console.error('[Token] Not connected');
      return null;
    }

    setIsSettingOperator(true);

    try {
      // Set operator for 1 year
      const until = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      
      console.log('[Token] Setting Zama gateway as operator until:', new Date(until * 1000));
      
      const hash = await writeContractAsync({
        address: wrapperAddress,
        abi: WRAPPER_ABI,
        functionName: 'setOperator',
        args: [CONTRACTS.ZAMA_GATEWAY as Address, until],
        gas: BigInt(100000),
      });

      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === 'reverted') {
          throw new Error('Set operator transaction reverted.');
        }
      }

      await refetchOperator();
      console.log('[Token] Operator set successfully');
      return hash;
    } catch (err) {
      console.error('[Token] Set operator failed:', err);
      throw err;
    } finally {
      setIsSettingOperator(false);
    }
  }, [address, isConnected, writeContractAsync, publicClient, refetchOperator, wrapperAddress]);

  // Decrypt confidential balance (REVEAL button)
  const decryptBalance = useCallback(async () => {
    if (!confidentialBalanceHandle || !fhevmReady) {
      console.log('[Token] Cannot decrypt: no handle or FHEVM not ready');
      return null;
    }

    try {
      console.log('[Token] Decrypting balance...');
      
      const decrypted = await decryptHandle(
        confidentialBalanceHandle as string,
        wrapperAddress
      );

      if (decrypted !== null) {
        setDecryptedBalance(decrypted);
        console.log('[Token] Balance decrypted:', decrypted.toString());
      }

      return decrypted;
    } catch (err) {
      console.error('[Token] Decrypt failed:', err);
      return null;
    }
  }, [confidentialBalanceHandle, fhevmReady, decryptHandle, wrapperAddress]);

  // Confidential transfer (cUSDC to cUSDC, stays encrypted)
  const confidentialTransfer = useCallback(
    async (to: `0x${string}`, amount: string) => {
      if (!address || !isConnected || !fhevmReady) {
        console.error('[Token] Not ready for transfer');
        return null;
      }

      setIsTransferring(true);

      try {
        const parsedAmount = parseUnits(amount, TOKEN_CONFIG.decimals);
        
        console.log('[Token] Encrypting amount for transfer...');
        
        const encrypted = await encryptAmount(parsedAmount, wrapperAddress);
        if (!encrypted || !encrypted.handles[0]) {
          throw new Error('Failed to encrypt amount');
        }

        console.log('[Token] Transferring', parsedAmount.toString(), 'cUSDC to', to);
        
        const hash = await writeContractAsync({
          address: wrapperAddress,
          abi: WRAPPER_ABI,
          functionName: 'confidentialTransfer',
          args: [to, encrypted.handles[0], encrypted.inputProof],
          gas: BigInt(800000),
        });

        if (publicClient) {
          const receipt = await publicClient.waitForTransactionReceipt({ hash });
          if (receipt.status === 'reverted') {
            throw new Error('Transfer reverted on-chain. Check your cUSDC balance.');
          }
        }

        await refetchConfidential();
        // Clear decrypted balance since it changed
        setDecryptedBalance(null);
        console.log('[Token] Transfer successful');
        return hash;
      } catch (err) {
        console.error('[Token] Transfer failed:', err);
        throw err;
      } finally {
        setIsTransferring(false);
      }
    },
    [address, isConnected, fhevmReady, encryptAmount, writeContractAsync, publicClient, refetchConfidential, wrapperAddress]
  );

  // Refetch all data
  const refetch = useCallback(() => {
    setDecryptedBalance(null); // Clear cached decryption
    return Promise.all([
      refetchErc20(),
      refetchAllowance(),
      refetchConfidential(),
      refetchOperator(),
    ]);
  }, [refetchErc20, refetchAllowance, refetchConfidential, refetchOperator]);

  return {
    // Balances
    erc20Balance: erc20Balance as bigint | undefined,
    formattedErc20Balance,
    confidentialBalanceHandle: confidentialBalanceHandle as `0x${string}` | undefined,
    hasConfidentialBalance,
    decryptedBalance,
    formattedDecryptedBalance,
    
    // Allowance & Operator
    erc20Allowance: erc20Allowance as bigint | undefined,
    isOperatorValid: Boolean(isOperatorValid),
    
    // Token info
    decimals: TOKEN_CONFIG.decimals,
    symbol: TOKEN_CONFIG.symbol,
    
    // Loading states
    isLoading: isLoadingErc20 || isLoadingConfidential,
    isWritePending,
    isWrapping,
    isUnwrapping,
    isTransferring,
    isSettingOperator,
    isEncrypting,
    isDecrypting,
    fhevmReady,
    
    // Actions
    approveForWrap,
    wrap,
    unwrap,
    confidentialTransfer,
    setGatewayAsOperator,
    decryptBalance,
    refetch,
  };
}

export default useConfidentialToken;
