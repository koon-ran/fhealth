'use client'

import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits, isAddress } from 'viem'
import Link from 'next/link'
import { CONTRACTS, ARC_ESCROW_ABI, USDC_ABI } from '@/lib/contracts'
import Toast from '@/components/Toast'

export default function CreateInvoice() {
  const { address, isConnected } = useAccount()
  const [title, setTitle] = useState('')
  const [payee, setPayee] = useState('')
  const [arbiter, setArbiter] = useState('')
  const [amount, setAmount] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; txHash?: string } | null>(null)
  
  const { writeContract: approveUSDC, data: approveHash } = useWriteContract()
  const { writeContract: createInvoice, data: createHash } = useWriteContract()
  
  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isCreating, isSuccess } = useWaitForTransactionReceipt({ hash: createHash })

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.USDC,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  useEffect(() => {
    if (isSuccess && createHash) {
      setToast({ message: `Invoice "${title}" created successfully!`, type: 'success', txHash: createHash })
      setTimeout(() => {
        setTitle('')
        setPayee('')
        setArbiter('')
        setAmount('')
      }, 2000)
    }
  }, [isSuccess, createHash, title])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isConnected || !address) {
      setToast({ message: 'Please connect your wallet', type: 'warning' })
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

    try {
      const amountInUsdc = parseUnits(amount, 6)
      
      setToast({ message: 'Step 1/2: Approving USDC...', type: 'info' })
      
      approveUSDC({
        address: CONTRACTS.USDC,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACTS.ArcEscrow, amountInUsdc],
      })
      
      setTimeout(() => {
        setToast({ message: 'Step 2/2: Creating invoice...', type: 'info' })
        createInvoice({
          address: CONTRACTS.ArcEscrow,
          abi: ARC_ESCROW_ABI,
          functionName: 'createAndFundInvoice',
          args: [address, payee as `0x${string}`, arbiter as `0x${string}`, amountInUsdc, title],
        })
      }, 3000)
      
    } catch (error) {
      console.error('Error creating invoice:', error)
      setToast({ message: 'Error creating invoice. Please try again.', type: 'error' })
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
                  <span className="text-[var(--text-muted)] text-xs ml-2">// CREATE</span>
                </div>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="nav-link text-xs uppercase tracking-wider">Dashboard</Link>
                <span className="text-[var(--text-muted)]">|</span>
                <Link href="/wrap" className="nav-link text-xs uppercase tracking-wider">Wrap</Link>
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
            // Standard Escrow
          </p>
          <h1 className="headline text-4xl text-[var(--text-primary)] mb-2">
            Create New Invoice
          </h1>
          <p className="text-[var(--text-secondary)]">
            Set up a new escrow payment with mutual consent approval
          </p>
        </div>

        {/* Balance Display */}
        {isConnected && usdcBalance !== undefined && (
          <div className="card-bracketed p-6 mb-8">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">
              // Your USDC Balance
            </p>
            <p className="headline text-3xl text-[var(--text-primary)]">
              {(Number(usdcBalance) / 1_000_000).toFixed(2)} <span className="text-[var(--accent-primary)]">USDC</span>
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card-bracketed p-4 mb-6">
            <p className="text-xs text-[var(--text-secondary)]">
              <span className="text-[var(--status-info)]">i</span> You are the Payer. Enter the payee&apos;s address who will receive funds once you approve their work.
            </p>
          </div>

          <div>
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
              // Invoice Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Website Development Project"
              className="input-field"
              required
            />
          </div>

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
            <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
              // Amount (USDC)
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
            {amount && (
              <div className="mt-3 p-3 bg-[var(--bg-secondary)] border border-white/5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Platform Fee (1%)</span>
                  <span className="text-[var(--text-secondary)]">{(parseFloat(amount) * 0.01).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-[var(--text-muted)]">Net to Payee</span>
                  <span className="text-[var(--accent-primary)]">{(parseFloat(amount) * 0.99).toFixed(2)} USDC</span>
                </div>
              </div>
            )}
          </div>

          {/* Status Messages */}
          {isApproving && (
            <div className="card-accent p-4">
              <p className="text-xs text-[var(--status-info)]">Approving USDC...</p>
            </div>
          )}

          {isCreating && (
            <div className="card-accent p-4">
              <p className="text-xs text-[var(--status-info)]">Creating invoice...</p>
            </div>
          )}

          {isSuccess && (
            <div className="p-4 bg-[rgba(62,207,178,0.1)] border border-[var(--accent-primary)]/30">
              <p className="text-xs text-[var(--accent-primary)]">Invoice created successfully!</p>
              <Link href="/" className="text-xs text-[var(--accent-primary)] hover:underline mt-2 inline-block">
                View invoices {'\u00BB'}
              </Link>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isConnected || isApproving || isCreating}
            className="btn-primary w-full justify-center"
          >
            {!isConnected
              ? 'Connect Wallet'
              : isApproving
              ? 'Approving USDC...'
              : isCreating
              ? 'Creating & Depositing...'
              : <>Create Invoice & Deposit Funds <span>{'\u00BB'}</span></>}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-8 card-bracketed p-6">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-4">
            // How It Works
          </p>
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            <p><span className="text-[var(--accent-primary)]">01</span> You (Payer) deposit USDC into escrow</p>
            <p><span className="text-[var(--accent-primary)]">02</span> Payee completes work and requests payment</p>
            <p><span className="text-[var(--accent-primary)]">03</span> You approve release or raise dispute</p>
            <p><span className="text-[var(--accent-primary)]">04</span> If disputed, arbiter decides (release or refund)</p>
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
