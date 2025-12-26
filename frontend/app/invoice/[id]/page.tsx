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

  const { data: invoice, refetch } = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: [invoiceId],
  }) as { data: Invoice | undefined; refetch: () => void }

  const { writeContract: approveRelease, data: approveHash } = useWriteContract()
  const { writeContract: raiseDispute, data: disputeHash } = useWriteContract()
  const { writeContract: arbitrateReleaseAction, data: arbReleaseHash } = useWriteContract()
  const { writeContract: arbitrateRefundAction, data: arbRefundHash } = useWriteContract()

  const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isDisputing, isSuccess: disputeSuccess } = useWaitForTransactionReceipt({ hash: disputeHash })
  const { isLoading: isArbitratingRelease, isSuccess: arbReleaseSuccess } = useWaitForTransactionReceipt({ hash: arbReleaseHash })
  const { isLoading: isArbitratingRefund, isSuccess: arbRefundSuccess } = useWaitForTransactionReceipt({ hash: arbRefundHash })

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

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-secondary)]">Loading invoice...</p>
        </div>
      </div>
    )
  }

  const isPayer = address?.toLowerCase() === invoice.payer.toLowerCase()
  const isPayee = address?.toLowerCase() === invoice.payee.toLowerCase()
  const isArbiter = address?.toLowerCase() === invoice.arbiter.toLowerCase()
  
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

  const statusConfig: Record<number, { label: string; class: string }> = {
    0: { label: 'CREATED', class: 'badge-neutral' },
    1: { label: 'FUNDED', class: 'badge-info' },
    2: { label: 'APPROVED', class: 'badge-info' },
    3: { label: 'RELEASED', class: 'badge-success' },
    4: { label: 'REFUNDED', class: 'badge-warning' },
    5: { label: 'DISPUTED', class: 'badge-error' },
  }

  const status = statusConfig[invoice.status] || statusConfig[0]

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
                  <span className="text-[var(--text-muted)] text-xs ml-2">// INVOICE</span>
                </div>
              </Link>
            </div>
            
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-8 transition-colors">
          {'\u2190'} Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">
              // Invoice #{invoice.id.toString()}
            </p>
            <h1 className="headline text-4xl text-[var(--text-primary)]">
              {invoice.title || `Invoice #${invoice.id.toString()}`}
            </h1>
          </div>
          <span className={`badge ${status.class}`}>{status.label}</span>
        </div>

        {/* Amount Card */}
        <div className="card-accent p-8 mb-8 glow-accent">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">
            // Escrow Amount
          </p>
          <p className="headline text-5xl text-[var(--text-primary)] mb-6">
            {formatUnits(invoice.amount, 6)} <span className="text-[var(--accent-primary)]">USDC</span>
          </p>
          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-[var(--accent-border)]">
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">// Platform Fee (1%)</p>
              <p className="text-[var(--text-secondary)]">{(Number(formatUnits(invoice.amount, 6)) * 0.01).toFixed(2)} USDC</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)] mb-1">// Net to Payee</p>
              <p className="text-[var(--accent-primary)]">{(Number(formatUnits(invoice.amount, 6)) * 0.99).toFixed(2)} USDC</p>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="card-bracketed p-6 mb-8">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-6">
            // Participants
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] border border-white/5">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">// PAYER {isPayer && '(You)'}</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{invoice.payer}</p>
              </div>
              {invoice.payerApproved && (
                <span className="badge badge-success">{'\u2713'} Approved</span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] border border-white/5">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">// PAYEE {isPayee && '(You)'}</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{invoice.payee}</p>
              </div>
              {invoice.payeeApproved && (
                <span className="badge badge-success">{'\u2713'} Approved</span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] border border-white/5">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">// ARBITER {isArbiter && '(You)'}</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{invoice.arbiter}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="card-bracketed p-6 mb-8">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-6">
            // Timeline
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 bg-[var(--accent-primary)]"></div>
              <div>
                <p className="text-[var(--text-primary)] text-sm">Created</p>
                <p className="text-xs text-[var(--text-muted)]">{new Date(Number(invoice.createdAt) * 1000).toLocaleString()}</p>
              </div>
            </div>
            {invoice.fundedAt > 0 && (
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-[var(--accent-primary)]"></div>
                <div>
                  <p className="text-[var(--text-primary)] text-sm">Funded</p>
                  <p className="text-xs text-[var(--text-muted)]">{new Date(Number(invoice.fundedAt) * 1000).toLocaleString()}</p>
                </div>
              </div>
            )}
            {invoice.resolvedAt > 0 && (
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 bg-[var(--accent-primary)]"></div>
                <div>
                  <p className="text-[var(--text-primary)] text-sm">Resolved</p>
                  <p className="text-xs text-[var(--text-muted)]">{new Date(Number(invoice.resolvedAt) * 1000).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dispute Info */}
        {invoice.status === 5 && invoice.disputeReason && (
          <div className="p-6 bg-[rgba(229,76,76,0.1)] border border-[var(--status-error)]/30 mb-8">
            <p className="text-xs text-[var(--status-error)] uppercase tracking-wider mb-2">// Dispute Raised</p>
            <p className="text-[var(--text-primary)]">{invoice.disputeReason}</p>
          </div>
        )}

        {/* Actions */}
        {isConnected && (
          <div className="card-bracketed p-6">
            <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-6">
              // Actions
            </p>
            
            {!isPayer && !isPayee && !isArbiter && (
              <p className="text-[var(--text-secondary)]">You are not a participant in this invoice.</p>
            )}

            {/* Payee: Request Payment */}
            {payeeCanRequest && (
              <div className="mb-6">
                <div className="p-4 bg-[rgba(76,168,229,0.1)] border border-[var(--status-info)]/30 mb-4">
                  <p className="text-xs text-[var(--status-info)]">
                    Have you completed your work? Request payment from the payer.
                  </p>
                </div>
                <button
                  onClick={handlePayeeRequest}
                  disabled={isApproving}
                  className="btn-primary w-full justify-center"
                >
                  {isApproving ? 'Requesting...' : <>Request Payment <span>{'\u00BB'}</span></>}
                </button>
              </div>
            )}

            {/* Payer: Approve or Dispute */}
            {payerCanApprove && (
              <div className="mb-6 space-y-4">
                <div className="p-4 bg-[rgba(229,184,76,0.1)] border border-[var(--status-warning)]/30">
                  <p className="text-xs text-[var(--status-warning)]">
                    Payee has requested payment. Review their work and decide:
                  </p>
                </div>
                <button
                  onClick={handlePayerApprove}
                  disabled={isApproving}
                  className="btn-primary w-full justify-center"
                >
                  {isApproving ? 'Approving...' : <>Approve & Release Funds <span>{'\u00BB'}</span></>}
                </button>
                <div className="text-center text-xs text-[var(--text-muted)]">OR</div>
              </div>
            )}

            {/* Payer: Dispute */}
            {canDispute && invoice.status !== 5 && (
              <div className="mb-6">
                <label className="block text-xs text-[var(--text-muted)] uppercase tracking-wider mb-3">
                  // Raise a Dispute
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Explain why you're disputing..."
                  className="input-field resize-none mb-4"
                  rows={3}
                />
                <button
                  onClick={handleDispute}
                  disabled={isDisputing || !disputeReason.trim()}
                  className="btn-danger w-full justify-center"
                >
                  {isDisputing ? 'Raising Dispute...' : <>Raise Dispute <span>{'\u00BB'}</span></>}
                </button>
                <p className="text-xs text-[var(--text-muted)] mt-2">
                  The arbiter will review and make a final decision
                </p>
              </div>
            )}

            {/* Arbiter Actions */}
            {canArbitrate && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--text-secondary)] mb-4">As arbiter, you can resolve this dispute:</p>
                <button
                  onClick={handleArbitrateRelease}
                  disabled={isArbitratingRelease}
                  className="btn-primary w-full justify-center"
                >
                  {isArbitratingRelease ? 'Processing...' : <>Release Funds to Payee <span>{'\u00BB'}</span></>}
                </button>
                <button
                  onClick={handleArbitrateRefund}
                  disabled={isArbitratingRefund}
                  className="btn-secondary w-full justify-center"
                >
                  {isArbitratingRefund ? 'Processing...' : <>Refund to Payer <span>{'\u00BB'}</span></>}
                </button>
              </div>
            )}

            {/* Completed Status */}
            {(invoice.status === 3 || invoice.status === 4) && (
              <div className="p-4 bg-[var(--bg-secondary)] border border-white/5">
                <p className="text-[var(--text-secondary)]">
                  {invoice.status === 3 ? 'This invoice has been released to the payee.' : 'This invoice has been refunded to the payer.'}
                </p>
              </div>
            )}
          </div>
        )}

        {!isConnected && (
          <div className="p-6 bg-[rgba(229,184,76,0.1)] border border-[var(--status-warning)]/30">
            <p className="text-[var(--status-warning)]">Please connect your wallet to interact with this invoice.</p>
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
