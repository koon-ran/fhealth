'use client'

import { use, useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS, ARC_ESCROW_ABI, InvoiceStatusLabel, type Invoice } from '@/lib/contracts'
import { formatUnits } from 'viem'
import Toast from '@/components/Toast'
import ConfirmModal from '@/components/ConfirmModal'

type ConfirmAction = {
  title: string
  message: string
  onConfirm: () => void
  type?: 'danger' | 'warning' | 'info'
  confirmText?: string
}

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const invoiceId = BigInt(resolvedParams.id)
  const { address, isConnected } = useAccount()
  const [disputeReason, setDisputeReason] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; txHash?: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  // Read invoice data
  const { data: invoice, refetch } = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: [invoiceId],
  }) as { data: Invoice | undefined; refetch: () => void }

  // Write functions
  const { writeContract: approveRelease, data: approveHash } = useWriteContract()
  const { writeContract: raiseDispute, data: disputeHash } = useWriteContract()
  const { writeContract: arbitrateReleaseAction, data: arbReleaseHash } = useWriteContract()
  const { writeContract: arbitrateRefundAction, data: arbRefundHash } = useWriteContract()

  // Transaction status
  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isDisputing, isSuccess: disputeSuccess } = useWaitForTransactionReceipt({ hash: disputeHash })
  const { isLoading: isArbitratingRelease, isSuccess: arbReleaseSuccess } = useWaitForTransactionReceipt({ hash: arbReleaseHash })
  const { isLoading: isArbitratingRefund, isSuccess: arbRefundSuccess } = useWaitForTransactionReceipt({ hash: arbRefundHash })

  // Refetch on success and show success toast
  useEffect(() => {
    if (approveSuccess && approveHash) {
      setToast({ message: 'Action completed successfully!', type: 'success', txHash: approveHash })
      setTimeout(() => refetch(), 2000)
    }
    if (disputeSuccess && disputeHash) {
      setToast({ message: 'Dispute raised successfully. Arbiter will review.', type: 'success', txHash: disputeHash })
      setTimeout(() => refetch(), 2000)
    }
    if (arbReleaseSuccess && arbReleaseHash) {
      setToast({ message: 'Funds released to payee by arbiter.', type: 'success', txHash: arbReleaseHash })
      setTimeout(() => refetch(), 2000)
    }
    if (arbRefundSuccess && arbRefundHash) {
      setToast({ message: 'Funds refunded to payer by arbiter.', type: 'success', txHash: arbRefundHash })
      setTimeout(() => refetch(), 2000)
    }
  }, [approveSuccess, disputeSuccess, arbReleaseSuccess, arbRefundSuccess, refetch, approveHash, disputeHash, arbReleaseHash, arbRefundHash])

  // Get title from localStorage
  const getInvoiceTitle = (id: bigint) => {
    if (typeof window === 'undefined') return null
    const titles = JSON.parse(localStorage.getItem('invoiceTitles') || '{}')
    return titles[id.toString()] || null
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Loading invoice...</p>
        </div>
      </div>
    )
  }

  const isPayer = address?.toLowerCase() === invoice.payer.toLowerCase()
  const isPayee = address?.toLowerCase() === invoice.payee.toLowerCase()
  const isArbiter = address?.toLowerCase() === invoice.arbiter.toLowerCase()
  
  // Action permissions based on correct flow
  const payeeCanRequest = isPayee && invoice.status === 1 && !invoice.payeeApproved
  const payerCanApprove = isPayer && invoice.status === 2 && invoice.payeeApproved && !invoice.payerApproved
  const canDispute = isPayer && (invoice.status === 1 || invoice.status === 2)
  const canArbitrate = isArbiter && invoice.status === 5

  const handlePayeeRequest = () => {
    setConfirmAction({
      title: 'Request Payment',
      message: 'Confirm that you have completed your work and are requesting payment?',
      type: 'info',
      onConfirm: () => {
        approveRelease({
          address: CONTRACTS.ArcEscrow,
          abi: ARC_ESCROW_ABI,
          functionName: 'approveRelease',
          args: [invoiceId],
        })
        setConfirmAction(null)
        setToast({ message: 'Payment request submitted...', type: 'info' })
      },
    })
  }

  const handlePayerApprove = () => {
    setConfirmAction({
      title: 'Release Funds',
      message: `Release ${formatUnits(invoice.amount, 6)} USDC to the payee?\n\nThis action cannot be undone.`,
      type: 'warning',
      confirmText: 'Release Funds',
      onConfirm: () => {
        approveRelease({
          address: CONTRACTS.ArcEscrow,
          abi: ARC_ESCROW_ABI,
          functionName: 'approveRelease',
          args: [invoiceId],
        })
        setConfirmAction(null)
        setToast({ message: 'Releasing funds...', type: 'info' })
      },
    })
  }

  const handleDispute = () => {
    if (!disputeReason.trim()) {
      setToast({ message: 'Please provide a dispute reason', type: 'warning' })
      return
    }
    setConfirmAction({
      title: 'Raise Dispute',
      message: `Raise a dispute with this reason?\n\n"${disputeReason}"\n\nThe arbiter will review and make a decision.`,
      type: 'danger',
      confirmText: 'Raise Dispute',
      onConfirm: () => {
        raiseDispute({
          address: CONTRACTS.ArcEscrow,
          abi: ARC_ESCROW_ABI,
          functionName: 'dispute',
          args: [invoiceId, disputeReason],
        })
        setConfirmAction(null)
        setToast({ message: 'Submitting dispute...', type: 'info' })
      },
    })
  }

  const handleArbitrateRelease = () => {
    setConfirmAction({
      title: 'Release to Payee',
      message: `Release funds to the payee?\n\nAmount: ${formatUnits(invoice.amount, 6)} USDC\nArbiter fee (2%): ${(Number(formatUnits(invoice.amount, 6)) * 0.02).toFixed(2)} USDC\n\nThis decision is final.`,
      type: 'warning',
      confirmText: 'Release',
      onConfirm: () => {
        arbitrateReleaseAction({
          address: CONTRACTS.ArcEscrow,
          abi: ARC_ESCROW_ABI,
          functionName: 'arbitrateRelease',
          args: [invoiceId],
        })
        setConfirmAction(null)
        setToast({ message: 'Processing arbitration decision...', type: 'info' })
      },
    })
  }

  const handleArbitrateRefund = () => {
    setConfirmAction({
      title: 'Refund to Payer',
      message: `Refund to the payer?\n\nAmount: ${formatUnits(invoice.amount, 6)} USDC\nArbiter fee (2%): ${(Number(formatUnits(invoice.amount, 6)) * 0.02).toFixed(2)} USDC\n\nThis decision is final.`,
      type: 'warning',
      confirmText: 'Refund',
      onConfirm: () => {
        arbitrateRefundAction({
          address: CONTRACTS.ArcEscrow,
          abi: ARC_ESCROW_ABI,
          functionName: 'arbitrateRefund',
          args: [invoiceId],
        })
        setConfirmAction(null)
        setToast({ message: 'Processing arbitration decision...', type: 'info' })
      },
  })
}

  const invoiceTitle = getInvoiceTitle(invoiceId)

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
                <p className="text-xs text-gray-400">
                  {invoice.title || `Invoice #${invoice.id.toString()}`}
                </p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <a
                href="https://faucet.circle.com/?_gl=1*2rcr6z*_gcl_au*MTU5NDk5NzY1MC4xNzYyNjk2ODI2"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 transition-all text-sm font-medium"
              >
                <span>💧</span>
                <span>Get USDC</span>
              </a>
              <ConnectButton />
            </div>
          </div>
        </div>
      </header>      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <Link href="/" className="text-blue-400 hover:underline mb-4 inline-block">
            ← Back to Invoices
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white mb-2">
                {invoice.title || `Invoice #${invoice.id.toString()}`}
              </h2>
              {invoice.title && (
                <p className="text-sm text-gray-500 mb-1">Invoice #{invoice.id.toString()}</p>
              )}
              <p className="text-gray-400">Escrow payment details and actions</p>
            </div>
            <span className={`rounded-full px-4 py-2 text-sm font-semibold ${
              invoice.status === 3 ? 'bg-green-500/20 text-green-400' :
              invoice.status === 5 ? 'bg-red-500/20 text-red-400' :
              invoice.status === 1 ? 'bg-blue-500/20 text-blue-400' :
              invoice.status === 4 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-gray-500/20 text-gray-400'
            }`}>
              {InvoiceStatusLabel[invoice.status as keyof typeof InvoiceStatusLabel]}
            </span>
          </div>
        </div>

        {/* Amount Card */}
        <div className="bg-gradient-to-br from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl p-8 mb-8">
          <p className="text-sm text-gray-400 mb-2">Escrow Amount</p>
          <p className="text-5xl font-bold text-white mb-4">{formatUnits(invoice.amount, 6)} USDC</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Platform Fee (1%)</p>
              <p className="text-white font-semibold">{(Number(formatUnits(invoice.amount, 6)) * 0.01).toFixed(2)} USDC</p>
            </div>
            <div>
              <p className="text-gray-400">Net to Payee</p>
              <p className="text-white font-semibold">{(Number(formatUnits(invoice.amount, 6)) * 0.99).toFixed(2)} USDC</p>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Participants</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-sm text-gray-400">Payer {isPayer && '(You)'}</p>
                <p className="font-mono text-white">{invoice.payer}</p>
              </div>
              {invoice.payerApproved && (
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">✓ Approved</span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-sm text-gray-400">Payee {isPayee && '(You)'}</p>
                <p className="font-mono text-white">{invoice.payee}</p>
              </div>
              {invoice.payeeApproved && (
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">✓ Approved</span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-sm text-gray-400">Arbiter {isArbiter && '(You)'}</p>
                <p className="font-mono text-white">{invoice.arbiter}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Timeline</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <div>
                <p className="text-white">Created</p>
                <p className="text-sm text-gray-400">{new Date(Number(invoice.createdAt) * 1000).toLocaleString()}</p>
              </div>
            </div>
            {invoice.fundedAt > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <div>
                  <p className="text-white">Funded</p>
                  <p className="text-sm text-gray-400">{new Date(Number(invoice.fundedAt) * 1000).toLocaleString()}</p>
                </div>
              </div>
            )}
            {invoice.resolvedAt > 0 && (
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <div>
                  <p className="text-white">Resolved</p>
                  <p className="text-sm text-gray-400">{new Date(Number(invoice.resolvedAt) * 1000).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dispute Info */}
        {invoice.status === 5 && invoice.disputeReason && (
          <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-6 mb-8">
            <h3 className="text-xl font-bold text-red-400 mb-2">Dispute Raised</h3>
            <p className="text-white">{invoice.disputeReason}</p>
          </div>
        )}

        {/* Actions */}
        {isConnected && (
          <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Actions</h3>
            
            {!isPayer && !isPayee && !isArbiter && (
              <p className="text-gray-400">You are not a participant in this invoice.</p>
            )}

            {/* Payee: Request Payment */}
            {payeeCanRequest && (
              <div className="mb-4">
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-3">
                  <p className="text-sm text-blue-300">
                    ℹ️ Have you completed your work? Request payment from the payer.
                  </p>
                </div>
                <button
                  onClick={handlePayeeRequest}
                  disabled={isApproving}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isApproving ? '⏳ Requesting...' : '💰 Request Payment'}
                </button>
              </div>
            )}

            {/* Payer: Approve or Dispute */}
            {payerCanApprove && (
              <div className="mb-4 space-y-3">
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm text-yellow-300">
                    ⚠️ Payee has requested payment. Review their work and decide:
                  </p>
                </div>
                <button
                  onClick={handlePayerApprove}
                  disabled={isApproving}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isApproving ? '⏳ Approving...' : '✅ Approve & Release Funds'}
                </button>
                <p className="text-xs text-gray-400 text-center">OR</p>
              </div>
            )}

            {/* Payer: Dispute */}
            {canDispute && invoice.status !== 5 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Raise a Dispute
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why you're disputing (e.g., work incomplete, quality issues)..."
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 mb-2"
                  rows={3}
                />
                <button
                  onClick={handleDispute}
                  disabled={isDisputing || !disputeReason.trim()}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-bold py-3 px-6 rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isDisputing ? '⏳ Raising Dispute...' : '⚠️ Raise Dispute'}
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  The arbiter will review and make a final decision
                </p>
              </div>
            )}

            {/* Arbiter Actions */}
            {canArbitrate && (
              <div className="space-y-3">
                <p className="text-sm text-gray-400 mb-3">As arbiter, you can resolve this dispute:</p>
                <button
                  onClick={handleArbitrateRelease}
                  disabled={isArbitratingRelease}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-3 px-6 rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isArbitratingRelease ? '⏳ Processing...' : '✓ Release Funds to Payee'}
                </button>
                <button
                  onClick={handleArbitrateRefund}
                  disabled={isArbitratingRefund}
                  className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-bold py-3 px-6 rounded-lg hover:from-yellow-600 hover:to-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isArbitratingRefund ? '⏳ Processing...' : '↩ Refund to Payer'}
                </button>
              </div>
            )}

            {/* Success Messages */}
            {approveSuccess && (
              <div className="mt-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400">✅ Approval submitted successfully!</p>
              </div>
            )}
            {disputeSuccess && (
              <div className="mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <p className="text-red-400">⚠ Dispute raised successfully!</p>
              </div>
            )}
            {(arbReleaseSuccess || arbRefundSuccess) && (
              <div className="mt-4 bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-400">✅ Arbitration completed successfully!</p>
              </div>
            )}

            {/* Completed Status */}
            {(invoice.status === 3 || invoice.status === 4) && (
              <div className="bg-gray-900/50 border border-gray-600 rounded-lg p-4">
                <p className="text-gray-400">
                  {invoice.status === 3 ? '✅ This invoice has been released to the payee.' : '↩ This invoice has been refunded to the payer.'}
                </p>
              </div>
            )}
          </div>
        )}

        {!isConnected && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-2xl p-6">
            <p className="text-yellow-400">Please connect your wallet to interact with this invoice.</p>
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          type={confirmAction.type}
          confirmText={confirmAction.confirmText}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

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
