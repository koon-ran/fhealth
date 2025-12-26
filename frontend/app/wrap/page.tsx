'use client'

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import Toast from '@/components/Toast'
import { useConfidentialToken, useFhevm } from '@/lib/fhevm'

export default function WrapPage() {
  const { isConnected } = useAccount()
  const { isReady: fhevmReady, error: fhevmError, isLoading: fhevmLoading } = useFhevm()
  const {
    // Balances
    formattedErc20Balance,
    formattedDecryptedBalance,
    hasConfidentialBalance,
    
    // Operator
    isOperatorValid,
    
    // Actions
    wrap,
    unwrap,
    decryptBalance,
    setGatewayAsOperator,
    refetch,
    
    // Loading states
    isLoading,
    isWrapping,
    isUnwrapping,
    isDecrypting,
    isSettingOperator,
  } = useConfidentialToken()

  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<'wrap' | 'unwrap'>('wrap')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; txHash?: string } | null>(null)

  const handleRevealBalance = async () => {
    if (!fhevmReady) {
      setToast({ message: 'FHEVM not ready. Please wait...', type: 'warning' })
      return
    }

    if (!isOperatorValid) {
      setToast({ message: 'You need to set the Gateway as operator first.', type: 'warning' })
      return
    }

    setToast({ message: 'Decrypting balance (requires signature)...', type: 'info' })
    
    try {
      const balance = await decryptBalance()
      if (balance !== null) {
        setToast({ message: 'Balance revealed!', type: 'success' })
      } else {
        setToast({ message: 'Failed to decrypt balance.', type: 'error' })
      }
    } catch (err) {
      console.error('Decrypt error:', err)
      setToast({ message: 'Failed to decrypt balance.', type: 'error' })
    }
  }

  const handleWrap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setToast({ message: 'Please enter a valid amount', type: 'warning' })
      return
    }

    setToast({ message: 'Wrapping USDC → cUSDC...', type: 'info' })
    
    try {
      const hash = await wrap(amount)
      if (hash) {
        setToast({ message: 'Successfully wrapped USDC to cUSDC!', type: 'success', txHash: hash })
        setAmount('')
        await refetch()
      } else {
        setToast({ message: 'Wrap failed. Please try again.', type: 'error' })
      }
    } catch (err) {
      console.error('Wrap error:', err)
      setToast({ message: 'Wrap failed. Please try again.', type: 'error' })
    }
  }

  const handleUnwrap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setToast({ message: 'Please enter a valid amount', type: 'warning' })
      return
    }

    if (!fhevmReady) {
      setToast({ message: 'FHEVM not ready. Please wait...', type: 'warning' })
      return
    }

    setToast({ message: 'Unwrapping cUSDC → USDC (requires signature)...', type: 'info' })
    
    try {
      const hash = await unwrap(amount)
      if (hash) {
        setToast({ message: 'Successfully unwrapped cUSDC to USDC!', type: 'success', txHash: hash })
        setAmount('')
        await refetch()
      } else {
        setToast({ message: 'Unwrap failed. Please try again.', type: 'error' })
      }
    } catch (err) {
      console.error('Unwrap error:', err)
      setToast({ message: 'Unwrap failed. Please try again.', type: 'error' })
    }
  }

  const handleSetOperator = async () => {
    setToast({ message: 'Setting Gateway as operator...', type: 'info' })
    
    try {
      const hash = await setGatewayAsOperator()
      if (hash) {
        setToast({ message: 'Gateway operator set successfully!', type: 'success', txHash: hash })
      } else {
        setToast({ message: 'Failed to set operator.', type: 'error' })
      }
    } catch (err) {
      console.error('Set operator error:', err)
      setToast({ message: 'Failed to set operator.', type: 'error' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'wrap') {
      handleWrap()
    } else {
      handleUnwrap()
    }
  }

  const setMaxAmount = () => {
    if (mode === 'wrap') {
      setAmount(formattedErc20Balance)
    } else {
      setAmount(formattedDecryptedBalance || '0')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">A</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">FHEscrow</h1>
                <p className="text-xs text-gray-400">Token Wrapper</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-all text-sm font-medium"
              >
                <span>Get USDC</span>
              </a>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-xl">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Token Wrapper</h2>
          <p className="text-gray-400">Convert between USDC and Confidential USDC (cUSDC)</p>
        </div>

        {/* FHEVM Status */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <span className={`w-2 h-2 rounded-full ${fhevmLoading ? 'bg-yellow-400 animate-pulse' : fhevmError ? 'bg-red-400' : fhevmReady ? 'bg-green-400' : 'bg-gray-400'}`}></span>
          <span className="text-gray-400">
            {fhevmLoading ? 'Initializing encryption...' : fhevmError ? 'Encryption error' : fhevmReady ? 'Encryption ready' : 'Encryption not ready'}
          </span>
        </div>

        {/* Balance Cards */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* USDC Balance */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">USDC Balance</p>
              <p className="text-2xl font-bold text-white">
                {isLoading ? '...' : parseFloat(formattedErc20Balance).toFixed(2)}
              </p>
            </div>
            
            {/* cUSDC Balance with Reveal Button */}
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">cUSDC Balance</p>
              {formattedDecryptedBalance !== null ? (
                <p className="text-2xl font-bold text-white">
                  {parseFloat(formattedDecryptedBalance).toFixed(2)}
                </p>
              ) : hasConfidentialBalance ? (
                <button
                  onClick={handleRevealBalance}
                  disabled={isDecrypting || !fhevmReady}
                  className="text-lg font-bold text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDecrypting ? (
                    '🔐 Revealing...'
                  ) : (
                    <>
                      🔐 <span className="underline">Click to reveal</span>
                    </>
                  )}
                </button>
              ) : (
                <p className="text-2xl font-bold text-white">0.00</p>
              )}
            </div>
          </div>
        )}

        {/* Operator Status */}
        {isConnected && !isOperatorValid && (
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 mb-6">
            <p className="text-orange-400 text-sm">
              ⚠️ Gateway not authorized. Set operator before decrypting balances.
            </p>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex mb-6 bg-gray-800/50 rounded-lg p-1">
          <button
            onClick={() => setMode('wrap')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              mode === 'wrap'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Wrap (USDC → cUSDC)
          </button>
          <button
            onClick={() => setMode('unwrap')}
            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
              mode === 'unwrap'
                ? 'bg-purple-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Unwrap (cUSDC → USDC)
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 space-y-6">
          <div className={`p-4 rounded-lg ${mode === 'wrap' ? 'bg-blue-900/20 border border-blue-500/30' : 'bg-purple-900/20 border border-purple-500/30'}`}>
            <p className="text-sm">
              {mode === 'wrap' ? (
                <span className="text-blue-300">
                  🔒 <strong>Wrap</strong> your USDC to confidential cUSDC for private transactions.
                </span>
              ) : (
                <span className="text-purple-300">
                  🔓 <strong>Unwrap</strong> your cUSDC back to plain USDC. Requires encryption signature.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 pr-24 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={setMaxAmount}
                disabled={mode === 'unwrap' && formattedDecryptedBalance === null}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-gray-700 text-gray-300 text-sm rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                MAX
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              {mode === 'wrap' 
                ? `Available: ${parseFloat(formattedErc20Balance).toFixed(2)} USDC`
                : formattedDecryptedBalance !== null 
                  ? `Available: ${parseFloat(formattedDecryptedBalance).toFixed(2)} cUSDC`
                  : 'Available: Reveal balance first'
              }
            </p>
          </div>

          {/* Arrow Icon */}
          <div className="flex justify-center">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${mode === 'wrap' ? 'bg-blue-500/20' : 'bg-purple-500/20'}`}>
              <span className="text-2xl">↓</span>
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">You will receive</p>
            <p className="text-2xl font-bold text-white">
              {amount || '0'} {mode === 'wrap' ? 'cUSDC' : 'USDC'}
            </p>
          </div>

          {/* Status Messages */}
          {(isWrapping || isUnwrapping) && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400">
                ⏳ {mode === 'wrap' ? 'Wrapping' : 'Unwrapping'}...
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isConnected || isWrapping || isUnwrapping || !amount || (mode === 'unwrap' && !fhevmReady)}
            className={`w-full font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === 'wrap'
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white'
                : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white'
            }`}
          >
            {!isConnected
              ? 'Connect Wallet'
              : isWrapping
              ? '⏳ Wrapping...'
              : isUnwrapping
              ? '⏳ Unwrapping...'
              : mode === 'unwrap' && !fhevmReady
              ? '⏳ Waiting for FHEVM...'
              : mode === 'wrap'
              ? 'Wrap USDC → cUSDC'
              : 'Unwrap cUSDC → USDC'}
          </button>
        </form>

        {/* Gateway Operator Section */}
        <div className="mt-6 bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
          <h4 className="font-bold text-white mb-2">🔑 Gateway Setup (One-time)</h4>
          <p className="text-sm text-gray-400 mb-4">
            Before revealing your cUSDC balance, you need to authorize the Zama Gateway as an operator for your tokens.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSetOperator}
              disabled={!isConnected || isSettingOperator}
              className="flex-1 bg-gray-700 text-white font-medium py-2 px-4 rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSettingOperator ? '⏳ Setting...' : 'Set Gateway as Operator'}
            </button>
            {isOperatorValid && (
              <span className="text-green-400 text-sm">✓ Active</span>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
          <h4 className="font-bold text-white mb-2">What is cUSDC?</h4>
          <ul className="text-sm text-gray-400 space-y-2">
            <li>• <strong>cUSDC</strong> is Confidential USDC - an encrypted version of USDC</li>
            <li>• Your balance and transaction amounts are hidden from public view</li>
            <li>• Only you can reveal your balance (click the reveal button)</li>
            <li>• 1:1 backed by USDC - wrap and unwrap anytime</li>
            <li>• Required for confidential escrow payments</li>
          </ul>
        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          txHash={toast.txHash}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
