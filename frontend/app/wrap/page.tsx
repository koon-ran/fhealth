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
    formattedErc20Balance,
    formattedDecryptedBalance,
    hasConfidentialBalance,
    isOperatorValid,
    wrap,
    unwrap,
    decryptBalance,
    setGatewayAsOperator,
    refetch,
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

    setToast({ message: 'Wrapping USDC to cUSDC...', type: 'info' })
    
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

    setToast({ message: 'Unwrapping cUSDC to USDC (requires signature)...', type: 'info' })
    
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-8 h-8 border border-[var(--accent-primary)] flex items-center justify-center">
                  <span className="text-[var(--accent-primary)] text-xs font-bold">FH</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-sm font-medium tracking-wide">FHESCROW</span>
                  <span className="text-[var(--text-muted)] text-xs ml-2">// WRAP</span>
                </div>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="nav-link text-xs uppercase tracking-wider">Dashboard</Link>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="text-xs uppercase tracking-wider text-[var(--text-primary)]">Wrap</span>
                <span className="text-[var(--text-muted)]">|</span>
                <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" className="nav-link text-xs uppercase tracking-wider">
                  Get USDC
                </a>
              </nav>
            </div>
            
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-2">
            // Token Wrapper
          </p>
          <h1 className="headline text-4xl text-[var(--text-primary)] mb-2">
            USDC {'\u2194'} cUSDC
          </h1>
          <p className="text-[var(--text-secondary)]">
            Convert between USDC and Confidential USDC
          </p>
        </div>

        {/* FHEVM Status */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <span className={`w-2 h-2 ${fhevmLoading ? 'bg-[var(--status-warning)] animate-pulse' : fhevmError ? 'bg-[var(--status-error)]' : fhevmReady ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`}></span>
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            {fhevmLoading ? 'Initializing...' : fhevmError ? 'Error' : fhevmReady ? 'Ready' : 'Not ready'}
          </span>
        </div>

        {/* Balance Cards */}
        {isConnected && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="card-bracketed p-5">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">// USDC</p>
              <p className="headline text-2xl text-[var(--text-primary)]">
                {isLoading ? '...' : parseFloat(formattedErc20Balance).toFixed(2)}
              </p>
            </div>
            
            <div className="card-accent p-5">
              <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-2">// cUSDC</p>
              {formattedDecryptedBalance !== null ? (
                <p className="headline text-2xl text-[var(--text-primary)]">
                  {parseFloat(formattedDecryptedBalance).toFixed(2)}
                </p>
              ) : hasConfidentialBalance ? (
                <button
                  onClick={handleRevealBalance}
                  disabled={isDecrypting || !fhevmReady}
                  className="text-lg font-mono text-[var(--accent-primary)] hover:underline disabled:opacity-50"
                >
                  {isDecrypting ? 'Revealing...' : 'Click to reveal'}
                </button>
              ) : (
                <p className="headline text-2xl text-[var(--text-primary)]">0.00</p>
              )}
            </div>
          </div>
        )}

        {/* Operator Status */}
        {isConnected && !isOperatorValid && (
          <div className="p-4 bg-[rgba(229,184,76,0.1)] border border-[var(--status-warning)]/30 mb-8">
            <p className="text-xs text-[var(--status-warning)]">
              Gateway not authorized. Set operator before decrypting balances.
            </p>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex mb-8 border border-white/10">
          <button
            onClick={() => setMode('wrap')}
            className={`flex-1 py-4 px-6 text-xs uppercase tracking-wider transition-all ${
              mode === 'wrap'
                ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Wrap {'\u00BB'} USDC to cUSDC
          </button>
          <button
            onClick={() => setMode('unwrap')}
            className={`flex-1 py-4 px-6 text-xs uppercase tracking-wider transition-all ${
              mode === 'unwrap'
                ? 'bg-[var(--accent-primary)] text-[var(--bg-primary)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Unwrap {'\u00BB'} cUSDC to USDC
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className={`p-4 ${mode === 'wrap' ? 'card-bracketed' : 'card-accent'}`}>
            <p className="text-xs">
              {mode === 'wrap' ? (
                <span className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)]">// </span>
                  Wrap your USDC to confidential cUSDC for private transactions.
                </span>
              ) : (
                <span className="text-[var(--accent-primary)]">
                  <span className="text-[var(--text-muted)]">// </span>
                  Unwrap your cUSDC back to plain USDC. Requires encryption signature.
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
              // Amount
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="input-field pr-20"
                required
              />
              <button
                type="button"
                onClick={setMaxAmount}
                disabled={mode === 'unwrap' && formattedDecryptedBalance === null}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                Max
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {mode === 'wrap' 
                ? `Available: ${parseFloat(formattedErc20Balance).toFixed(2)} USDC`
                : formattedDecryptedBalance !== null 
                  ? `Available: ${parseFloat(formattedDecryptedBalance).toFixed(2)} cUSDC`
                  : 'Available: Reveal balance first'
              }
            </p>
          </div>

          {/* Arrow */}
          <div className="flex justify-center py-2">
            <div className="w-10 h-10 border border-white/10 flex items-center justify-center">
              <span className="text-[var(--text-muted)]">{'\u2193'}</span>
            </div>
          </div>

          <div className="card-bracketed p-5">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-2">// You Will Receive</p>
            <p className="headline text-3xl text-[var(--text-primary)]">
              {amount || '0'} <span className="text-[var(--accent-primary)]">{mode === 'wrap' ? 'cUSDC' : 'USDC'}</span>
            </p>
          </div>

          {/* Status Messages */}
          {(isWrapping || isUnwrapping) && (
            <div className="card-accent p-4">
              <p className="text-xs text-[var(--status-info)]">
                {mode === 'wrap' ? 'Wrapping...' : 'Unwrapping...'}
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isConnected || isWrapping || isUnwrapping || !amount || (mode === 'unwrap' && !fhevmReady)}
            className="btn-primary w-full justify-center"
          >
            {!isConnected
              ? 'Connect Wallet'
              : isWrapping
              ? 'Wrapping...'
              : isUnwrapping
              ? 'Unwrapping...'
              : mode === 'unwrap' && !fhevmReady
              ? 'Waiting for FHEVM...'
              : mode === 'wrap'
              ? <>Wrap USDC to cUSDC <span>{'\u00BB'}</span></>
              : <>Unwrap cUSDC to USDC <span>{'\u00BB'}</span></>}
          </button>
        </form>

        {/* Gateway Operator Section */}
        <div className="mt-8 card-bracketed p-6">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-4">
            // Gateway Setup (One-time)
          </p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Before revealing your cUSDC balance, you need to authorize the Zama Gateway as an operator for your tokens.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={handleSetOperator}
              disabled={!isConnected || isSettingOperator}
              className="btn-secondary flex-1 justify-center"
            >
              {isSettingOperator ? 'Setting...' : 'Set Gateway as Operator'}
            </button>
            {isOperatorValid && (
              <span className="text-xs text-[var(--accent-primary)]">{'\u2713'} Active</span>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 card-bracketed p-6">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-4">
            // What is cUSDC?
          </p>
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <p><span className="text-[var(--accent-primary)]">{'\u2022'}</span> cUSDC is Confidential USDC - an encrypted version of USDC</p>
            <p><span className="text-[var(--accent-primary)]">{'\u2022'}</span> Your balance and transaction amounts are hidden from public view</p>
            <p><span className="text-[var(--accent-primary)]">{'\u2022'}</span> Only you can reveal your balance (click the reveal button)</p>
            <p><span className="text-[var(--accent-primary)]">{'\u2022'}</span> 1:1 backed by USDC - wrap and unwrap anytime</p>
            <p><span className="text-[var(--accent-primary)]">{'\u2022'}</span> Required for confidential escrow payments</p>
          </div>
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
