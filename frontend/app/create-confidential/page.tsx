'use client'

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Toast from '@/components/Toast'
import { useFhevm, useConfidentialToken, useConfidentialEscrow } from '@/lib/fhevm'

export default function CreateConfidentialInvoice() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { isReady: fhevmReady, error: fhevmError, isLoading: fhevmLoading } = useFhevm()
  const { 
    formattedErc20Balance,
    formattedDecryptedBalance,
    hasConfidentialBalance,
    decryptedBalance,
    isOperatorValid,
    decryptBalance,
    isLoading,
    isDecrypting,
  } = useConfidentialToken()
  const { createAndFundInvoice, isCreating, isEncrypting, error: escrowError } = useConfidentialEscrow()

  const [payee, setPayee] = useState('')
  const [arbiter, setArbiter] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; txHash?: string } | null>(null)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)

  const amountNum = parseFloat(amount) || 0
  const cusdcNum = decryptedBalance !== null ? Number(decryptedBalance) / 1e6 : null
  const hasEnoughBalance = cusdcNum !== null && cusdcNum >= amountNum

  const handleRevealBalance = async () => {
    if (!fhevmReady) {
      setToast({ message: 'FHEVM not ready. Please wait...', type: 'warning' })
      return
    }

    if (!isOperatorValid) {
      setToast({ message: 'You need to set the Gateway as operator first. Go to Wrap page.', type: 'warning' })
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

  const handleCreate = async () => {
    if (!payee || !arbiter || !amount) {
      setToast({ message: 'Please fill in all fields', type: 'warning' })
      return
    }

    if (!isAddress(payee)) {
      setToast({ message: 'Invalid payee address', type: 'error' })
      return
    }

    if (!isAddress(arbiter)) {
      setToast({ message: 'Invalid arbiter address', type: 'error' })
      return
    }

    if (!fhevmReady) {
      setToast({ message: 'FHEVM not ready. Please wait...', type: 'warning' })
      return
    }

    if (decryptedBalance === null) {
      setToast({ message: 'Please reveal your cUSDC balance first.', type: 'warning' })
      return
    }

    if (!hasEnoughBalance) {
      setToast({ message: 'Insufficient cUSDC balance. Please wrap more USDC.', type: 'warning' })
      router.push('/wrap')
      return
    }

    setToast({ message: 'Encrypting amount and creating invoice...', type: 'info' })
    
    try {
      const result = await createAndFundInvoice(
        payee as `0x${string}`,
        arbiter as `0x${string}`,
        amount,
        description || ''
      )

      if (result) {
        setCreatedInvoiceId(result.invoiceId.toString())
        setToast({ 
          message: `Confidential invoice #${result.invoiceId} created!`, 
          type: 'success', 
          txHash: result.hash 
        })
        setPayee('')
        setAmount('')
        setDescription('')
      } else {
        setToast({ message: 'Failed to create invoice. Please try again.', type: 'error' })
      }
    } catch (err) {
      console.error('Create invoice error:', err)
      setToast({ message: 'Failed to create invoice. Please try again.', type: 'error' })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleCreate()
  }

  const isProcessing = isCreating || isEncrypting

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
                  <span className="text-[var(--accent-primary)] text-xs ml-2">// CONFIDENTIAL</span>
                </div>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="nav-link text-xs uppercase tracking-wider">Dashboard</Link>
                <span className="text-[var(--text-muted)]">|</span>
                <Link href="/wrap" className="nav-link text-xs uppercase tracking-wider text-[var(--accent-primary)]">Wrap</Link>
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
      <main className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-8 transition-colors">
          {'\u2190'} Back to Dashboard
        </Link>

        <div className="mb-8">
          <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-2">
            // FHE Encrypted
          </p>
          <h1 className="headline text-4xl text-[var(--text-primary)] mb-2">
            Create Confidential Invoice
          </h1>
          <p className="text-[var(--text-secondary)]">
            Create an escrow with encrypted payment amount - only parties involved can see the amount.
          </p>
        </div>

        {/* FHEVM Status */}
        <div className="flex items-center gap-3 mb-6">
          <span className={`w-2 h-2 ${fhevmLoading ? 'bg-[var(--status-warning)] animate-pulse' : fhevmError ? 'bg-[var(--status-error)]' : fhevmReady ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`}></span>
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
            {fhevmLoading ? 'Initializing encryption...' : fhevmError ? 'Encryption error' : fhevmReady ? 'Encryption ready' : 'Encryption not ready'}
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

        {/* No cUSDC Warning */}
        {isConnected && decryptedBalance !== null && cusdcNum !== null && cusdcNum === 0 && (
          <div className="p-4 bg-[rgba(229,184,76,0.1)] border border-[var(--status-warning)]/30 mb-8">
            <p className="text-xs text-[var(--status-warning)] mb-2">
              You don&apos;t have any cUSDC. You need to wrap USDC first.
            </p>
            <Link
              href="/wrap"
              className="text-xs text-[var(--status-warning)] hover:underline"
            >
              Go to Wrap Page {'\u00BB'}
            </Link>
          </div>
        )}

        {/* Success Message */}
        {createdInvoiceId && (
          <div className="p-6 bg-[rgba(62,207,178,0.1)] border border-[var(--accent-primary)]/30 mb-8">
            <p className="text-xs text-[var(--accent-primary)] uppercase tracking-wider mb-2">// Invoice Created</p>
            <p className="text-[var(--text-secondary)] mb-4">
              Confidential Invoice #{createdInvoiceId} has been created and funded.
            </p>
            <Link
              href={`/confidential/${createdInvoiceId}`}
              className="btn-primary inline-flex"
            >
              View Invoice {'\u00BB'}
            </Link>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card-accent p-4">
            <p className="text-xs text-[var(--accent-primary)]">
              <span className="text-[var(--text-muted)]">// </span>
              Privacy Enabled: The payment amount will be encrypted on-chain. 
              Only you, the payee, and the arbiter can decrypt and view it.
            </p>
          </div>

          {decryptedBalance === null && hasConfidentialBalance && (
            <div className="p-4 bg-[rgba(229,184,76,0.1)] border border-[var(--status-warning)]/30">
              <p className="text-xs text-[var(--status-warning)]">
                Please reveal your cUSDC balance first to create an invoice.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
              // Payee Address
            </label>
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="0x..."
              className="input-field font-mono"
              required
            />
            <p className="text-xs text-[var(--text-muted)] mt-2">Who will receive payment</p>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
              // Arbiter Address
            </label>
            <input
              type="text"
              value={arbiter}
              onChange={(e) => setArbiter(e.target.value)}
              placeholder="0x..."
              className="input-field font-mono"
              required
            />
            <p className="text-xs text-[var(--text-muted)] mt-2">Resolves disputes if needed</p>
          </div>

          <div>
            <label className="block text-xs text-[var(--accent-primary)] uppercase tracking-wider mb-3">
              // Amount (cUSDC) <span className="text-[var(--text-muted)]">- Will be encrypted</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              step="0.01"
              min="0"
              className="input-field"
              required
            />
            {amount && decryptedBalance !== null && !hasEnoughBalance && (
              <div className="mt-3">
                <p className="text-xs text-[var(--status-error)] mb-2">
                  Insufficient cUSDC. You need {(amountNum - (cusdcNum || 0)).toFixed(2)} more.
                </p>
                <Link href="/wrap" className="text-xs text-[var(--accent-primary)] hover:underline">
                  Go wrap more USDC {'\u00BB'}
                </Link>
              </div>
            )}
            {decryptedBalance !== null && cusdcNum !== null && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Available: {cusdcNum.toFixed(2)} cUSDC
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
              // Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work or service..."
              rows={3}
              className="input-field resize-none"
            />
          </div>

          {/* Status Messages */}
          {isEncrypting && (
            <div className="card-accent p-4">
              <p className="text-xs text-[var(--accent-primary)]">Encrypting amount...</p>
            </div>
          )}

          {isCreating && (
            <div className="card-accent p-4">
              <p className="text-xs text-[var(--status-info)]">Creating and funding invoice...</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isConnected || isProcessing || !fhevmReady || decryptedBalance === null || !hasEnoughBalance}
            className="btn-primary w-full justify-center"
          >
            {!isConnected
              ? 'Connect Wallet'
              : !fhevmReady
              ? 'Waiting for FHEVM...'
              : decryptedBalance === null
              ? 'Reveal Balance First'
              : !hasEnoughBalance
              ? 'Insufficient cUSDC'
              : isEncrypting
              ? 'Encrypting Amount...'
              : isCreating
              ? 'Creating Invoice...'
              : <>Create Confidential Invoice <span>{'\u00BB'}</span></>}
          </button>
        </form>

        {/* How it works */}
        <div className="mt-8 card-bracketed p-6">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-4">
            // How Confidential Escrow Works
          </p>
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <p><span className="text-[var(--accent-primary)]">01</span> First, wrap USDC to cUSDC on the <Link href="/wrap" className="text-[var(--accent-primary)] hover:underline">Wrap page</Link></p>
            <p><span className="text-[var(--accent-primary)]">02</span> You (Client) deposit encrypted cUSDC into escrow</p>
            <p><span className="text-[var(--accent-primary)]">03</span> The amount is hidden from everyone except parties involved</p>
            <p><span className="text-[var(--accent-primary)]">04</span> Provider completes work and requests payment</p>
            <p><span className="text-[var(--accent-primary)]">05</span> You approve release or raise dispute</p>
            <p><span className="text-[var(--accent-primary)]">06</span> If disputed, arbiter decides (they can also decrypt)</p>
          </div>
        </div>
      </main>

      {/* Toast */}
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
