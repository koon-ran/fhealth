'use client'

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { parseUnits } from 'viem'
import Toast from '@/components/Toast'
import { ARBITER_ADDRESS } from '@/lib/contracts'
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
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; txHash?: string } | null>(null)
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null)

  // Check if user has enough cUSDC
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
    if (!payee || !amount) {
      setToast({ message: 'Please fill in all fields', type: 'warning' })
      return
    }

    if (!fhevmReady) {
      setToast({ message: 'FHEVM not ready. Please wait...', type: 'warning' })
      return
    }

    // Check if balance is revealed
    if (decryptedBalance === null) {
      setToast({ message: 'Please reveal your cUSDC balance first.', type: 'warning' })
      return
    }

    // Check if enough balance
    if (!hasEnoughBalance) {
      setToast({ message: 'Insufficient cUSDC balance. Please wrap more USDC.', type: 'warning' })
      router.push('/wrap')
      return
    }

    setToast({ message: 'Encrypting amount and creating invoice...', type: 'info' })
    
    try {
      const result = await createAndFundInvoice(
        payee as `0x${string}`,
        ARBITER_ADDRESS,
        amount,
        description || '' // Use description as metadata hash (or empty string)
      )

      if (result) {
        setCreatedInvoiceId(result.invoiceId.toString())
        setToast({ 
          message: `Confidential invoice #${result.invoiceId} created!`, 
          type: 'success', 
          txHash: result.hash 
        })
        // Reset form
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">🔐</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">FHEscrow</h1>
                <p className="text-xs text-gray-400">Confidential Invoice</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/wrap"
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-all text-sm font-medium"
              >
                <span>Wrap Tokens</span>
              </Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Link href="/" className="text-purple-400 hover:underline mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h2 className="text-3xl font-bold text-white mb-2">Create Confidential Invoice</h2>
          <p className="text-gray-400">Create an escrow with encrypted payment amount - only parties involved can see the amount.</p>
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
              <p className="text-xl font-bold text-white">
                {isLoading ? '...' : parseFloat(formattedErc20Balance).toFixed(2)}
              </p>
            </div>
            
            {/* cUSDC Balance with Reveal Button */}
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-1">cUSDC Balance</p>
              {formattedDecryptedBalance !== null ? (
                <p className="text-xl font-bold text-white">
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
                <p className="text-xl font-bold text-white">0.00</p>
              )}
            </div>
          </div>
        )}

        {/* No cUSDC Warning */}
        {isConnected && decryptedBalance !== null && cusdcNum !== null && cusdcNum === 0 && (
          <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4 mb-6">
            <p className="text-orange-400 mb-2">
              ⚠️ You don&apos;t have any cUSDC. You need to wrap USDC first.
            </p>
            <Link
              href="/wrap"
              className="inline-flex items-center gap-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              Go to Wrap Page →
            </Link>
          </div>
        )}

        {/* Success Message */}
        {createdInvoiceId && (
          <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6 mb-6">
            <h3 className="text-green-400 font-bold text-lg mb-2">✓ Invoice Created!</h3>
            <p className="text-gray-300 mb-4">
              Confidential Invoice #{createdInvoiceId} has been created and funded.
            </p>
            <Link
              href={`/confidential/${createdInvoiceId}`}
              className="inline-flex items-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 px-4 py-2 rounded-lg transition-colors"
            >
              View Invoice →
            </Link>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 rounded-lg border border-gray-700 p-6 space-y-6">
          <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
            <p className="text-sm text-purple-300">
              🔐 <strong>Privacy Enabled:</strong> The payment amount will be encrypted on-chain. 
              Only you, the payee, and the arbiter can decrypt and view it.
            </p>
          </div>

          {/* Must reveal balance first */}
          {decryptedBalance === null && hasConfidentialBalance && (
            <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                ⚠️ Please reveal your cUSDC balance first to create an invoice.
              </p>
            </div>
          )}

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
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Arbiter
              <span className="text-gray-500 ml-2">(Resolves disputes)</span>
            </label>
            <div className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-4 py-3 text-gray-400 font-mono text-sm">
              {ARBITER_ADDRESS}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount (cUSDC)
              <span className="text-purple-400 ml-2">🔐 Will be encrypted</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              step="0.01"
              min="0"
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              required
            />
            {amount && decryptedBalance !== null && !hasEnoughBalance && (
              <div className="mt-2">
                <p className="text-sm text-red-400 mb-2">
                  ⚠️ Insufficient cUSDC. You need {(amountNum - (cusdcNum || 0)).toFixed(2)} more.
                </p>
                <Link
                  href="/wrap"
                  className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm"
                >
                  Go wrap more USDC →
                </Link>
              </div>
            )}
            {decryptedBalance !== null && cusdcNum !== null && (
              <p className="mt-2 text-sm text-gray-400">
                Available: {cusdcNum.toFixed(2)} cUSDC
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the work or service..."
              rows={3}
              className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Status Messages */}
          {isEncrypting && (
            <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
              <p className="text-purple-400">🔐 Encrypting amount...</p>
            </div>
          )}

          {isCreating && (
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-400">⏳ Creating and funding invoice...</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isConnected || isProcessing || !fhevmReady || decryptedBalance === null || !hasEnoughBalance}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-600 text-white font-bold py-3 px-6 rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {!isConnected
              ? 'Connect Wallet'
              : !fhevmReady
              ? '⏳ Waiting for FHEVM...'
              : decryptedBalance === null
              ? '🔐 Reveal Balance First'
              : !hasEnoughBalance
              ? 'Insufficient cUSDC'
              : isEncrypting
              ? '🔐 Encrypting Amount...'
              : isCreating
              ? '⏳ Creating Invoice...'
              : 'Create Confidential Invoice'}
          </button>
        </form>

        {/* How it works */}
        <div className="mt-6 bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
          <h4 className="font-bold text-white mb-2">How Confidential Escrow Works:</h4>
          <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
            <li>First, wrap USDC to cUSDC on the <Link href="/wrap" className="text-purple-400 hover:underline">Wrap page</Link></li>
            <li>You (Client) deposit encrypted cUSDC into escrow</li>
            <li>The amount is hidden from everyone except parties involved</li>
            <li>Provider completes work and requests payment</li>
            <li>You approve release or raise dispute</li>
            <li>If disputed, arbiter decides (they can also decrypt the amount)</li>
          </ol>
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
