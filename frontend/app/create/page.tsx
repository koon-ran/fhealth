'use client'

import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { parseUnits } from 'viem'
import Link from 'next/link'
import { CONTRACTS, ARC_ESCROW_ABI, USDC_ABI, ARBITER_ADDRESS } from '@/lib/contracts'
import Toast from '@/components/Toast'

export default function CreateInvoice() {
  const { address, isConnected } = useAccount()
  const [title, setTitle] = useState('')
  const [payee, setPayee] = useState('')
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

  const { data: invoiceCount } = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'invoiceCount',
  })

  // Handle success
  useEffect(() => {
    if (isSuccess && createHash) {
      setToast({ message: `Invoice "${title}" created successfully!`, type: 'success', txHash: createHash })
      
      // Reset form
      setTimeout(() => {
        setTitle('')
        setPayee('')
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

    try {
      const amountInUsdc = parseUnits(amount, 6) // USDC has 6 decimals
      
      setToast({ message: 'Step 1/2: Approving USDC...', type: 'info' })
      
      // Step 1: Approve USDC
      approveUSDC({
        address: CONTRACTS.USDC,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACTS.ArcEscrow, amountInUsdc],
      })
      
      // Wait a bit for approval, then create invoice
      setTimeout(() => {
        setToast({ message: 'Step 2/2: Creating invoice...', type: 'info' })
        createInvoice({
          address: CONTRACTS.ArcEscrow,
          abi: ARC_ESCROW_ABI,
          functionName: 'createAndFundInvoice',
          args: [address, payee as `0x${string}`, ARBITER_ADDRESS, amountInUsdc, title],
        })
      }, 3000)
      
    } catch (error) {
      console.error('Error creating invoice:', error)
      setToast({ message: 'Error creating invoice. Please try again.', type: 'error' })
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
                <h1 className="text-xl font-bold text-white">Arcscrow</h1>
                <p className="text-xs text-gray-400">Create Invoice</p>
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
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Create New Invoice</h2>
          <p className="text-gray-400">Set up a new escrow payment with mutual consent approval</p>
        </div>

        {/* Balance Display */}
        {isConnected && usdcBalance !== undefined && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400">Your USDC Balance</p>
            <p className="text-2xl font-bold text-white">
              {(Number(usdcBalance) / 1_000_000).toFixed(2)} USDC
            </p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 space-y-6">
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-300">
              ℹ️ You are the <strong>Payer</strong>. Enter the payee's address who will receive funds once you approve their work.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Invoice Title
              <span className="text-gray-500 ml-2">(e.g., "Website Development Project")</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a descriptive title..."
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Payee Address
              <span className="text-gray-500 ml-2">(Who will receive payment)</span>
            </label>
            <input
              type="text"
              value={payee}
              onChange={(e) => setPayee(e.target.value)}
              placeholder="0x..."
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Arbiter
              <span className="text-gray-500 ml-2">(Resolves disputes if they occur)</span>
            </label>
            <div className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-gray-400 font-mono text-sm">
              {ARBITER_ADDRESS}
            </div>
            <p className="mt-1 text-xs text-gray-500">Designated arbiter for all escrows</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              step="0.01"
              min="0"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              required
            />
            {amount && (
              <p className="mt-2 text-sm text-gray-400">
                You will deposit: {amount} USDC (1% platform fee will be deducted on release)
              </p>
            )}
          </div>

          {/* Status Messages */}
          {isApproving && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400">⏳ Approving USDC...</p>
            </div>
          )}

          {isCreating && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-400">⏳ Creating invoice...</p>
            </div>
          )}

          {isSuccess && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-400">✅ Invoice created successfully!</p>
              <Link href="/" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
                View invoices →
              </Link>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isConnected || isApproving || isCreating}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {!isConnected
              ? 'Connect Wallet'
              : isApproving
              ? '⏳ Approving USDC...'
              : isCreating
              ? '⏳ Creating & Depositing...'
              : 'Create Invoice & Deposit Funds'}
          </button>
        </form>

        {/* Info Box */}
        <div className="mt-6 bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
          <h4 className="font-bold text-white mb-2">How it works:</h4>
          <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
            <li>You (Payer) deposit USDC into escrow</li>
            <li>Payee completes work and requests payment</li>
            <li>You approve release or raise dispute</li>
            <li>If disputed, arbiter decides (release or refund)</li>
          </ol>
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

