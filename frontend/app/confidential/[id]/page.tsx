'use client'

import { use, useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import Toast from '@/components/Toast'
import ConfirmModal from '@/components/ConfirmModal'
import { CONTRACTS } from '@/lib/contracts'
import { 
  useFhevm, 
  useConfidentialEscrow, 
  ConfidentialInvoiceStatus 
} from '@/lib/fhevm'

type ConfirmAction = {
  title: string
  message: string
  onConfirm: () => void
  type?: 'danger' | 'warning' | 'info'
  confirmText?: string
}

export default function ConfidentialInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const invoiceId = BigInt(resolvedParams.id)
  const { address, isConnected } = useAccount()
  const { isReady: fhevmReady, isLoading: fhevmLoading } = useFhevm()
  const {
    getInvoiceWithDecryption,
    approveRelease,
    dispute,
    resolveDispute,
    getStatusLabel,
    isApproving,
    isDisputing,
    isResolving,
    isDecrypting,
    error: escrowError,
    decimals,
  } = useConfidentialEscrow()

  const [invoice, setInvoice] = useState<{
    id: bigint
    client: `0x${string}`
    provider: `0x${string}`
    arbiter: `0x${string}`
    status: number
    clientApproved: boolean
    providerApproved: boolean
    metadataHash: string
    createdAt: bigint
    completedAt: bigint
    decryptedAmount?: string
  } | null>(null)
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning'; txHash?: string } | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [isDecryptingAmount, setIsDecryptingAmount] = useState(false)

  const loadInvoice = async () => {
    setIsLoadingInvoice(true)
    try {
      const data = await getInvoiceWithDecryption(invoiceId)
      if (data) {
        setInvoice(data)
      }
    } catch (err) {
      console.error('Failed to load invoice:', err)
    } finally {
      setIsLoadingInvoice(false)
    }
  }

  useEffect(() => {
    if (fhevmReady) {
      loadInvoice()
    }
  }, [fhevmReady, invoiceId])

  if (fhevmLoading || isLoadingInvoice) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-2">// Loading</p>
          <p className="text-[var(--text-secondary)]">
            {fhevmLoading ? 'Initializing encryption...' : 'Loading confidential invoice...'}
          </p>
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[var(--text-secondary)] mb-4">Invoice not found</p>
          <Link href="/" className="text-[var(--accent-primary)] hover:underline text-sm">
            {'\u2190'} Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isClient = address?.toLowerCase() === invoice.client.toLowerCase()
  const isProvider = address?.toLowerCase() === invoice.provider.toLowerCase()
  const isArbiter = address?.toLowerCase() === invoice.arbiter.toLowerCase()

  const isFunded = invoice.status === ConfidentialInvoiceStatus.FUNDED
  const isApproved = invoice.status === ConfidentialInvoiceStatus.APPROVED
  const isDisputed = invoice.status === ConfidentialInvoiceStatus.DISPUTED
  const isCompleted = invoice.status === ConfidentialInvoiceStatus.COMPLETED
  const isRefunded = invoice.status === ConfidentialInvoiceStatus.REFUNDED
  const canTakeAction = isFunded || isApproved

  const providerCanApprove = isProvider && canTakeAction && !invoice.providerApproved
  const clientCanApprove = isClient && canTakeAction && !invoice.clientApproved && invoice.providerApproved
  const clientCanDispute = isClient && (isFunded || isApproved)
  const arbiterCanResolve = isArbiter && isDisputed

  const handleApproveRelease = () => {
    setConfirmAction({
      title: 'Approve Release',
      message: `Approve release of funds?\n\nAmount: ${invoice.decryptedAmount || 'Encrypted'}\n\nWhen both parties approve, funds will be released to the provider.`,
      type: 'warning',
      confirmText: 'Approve',
      onConfirm: async () => {
        setConfirmAction(null)
        setToast({ message: 'Approving release...', type: 'info' })
        
        const hash = await approveRelease(invoiceId)
        if (hash) {
          setToast({ message: 'Approval submitted!', type: 'success', txHash: hash })
          setTimeout(loadInvoice, 3000)
        } else {
          setToast({ message: 'Failed to approve.', type: 'error' })
        }
      },
    })
  }

  const handleDispute = () => {
    setConfirmAction({
      title: 'Raise Dispute',
      message: 'Raise a dispute? The arbiter will review and make a decision.',
      type: 'danger',
      confirmText: 'Raise Dispute',
      onConfirm: async () => {
        setConfirmAction(null)
        setToast({ message: 'Raising dispute...', type: 'info' })
        
        const hash = await dispute(invoiceId)
        if (hash) {
          setToast({ message: 'Dispute raised successfully!', type: 'success', txHash: hash })
          setTimeout(loadInvoice, 3000)
        } else {
          setToast({ message: 'Failed to raise dispute.', type: 'error' })
        }
      },
    })
  }

  const handleResolveToProvider = () => {
    setConfirmAction({
      title: 'Release to Provider',
      message: `Release funds to the provider?\n\nThis decision is final.`,
      type: 'warning',
      confirmText: 'Release',
      onConfirm: async () => {
        setConfirmAction(null)
        setToast({ message: 'Resolving dispute...', type: 'info' })
        
        const hash = await resolveDispute(invoiceId, true)
        if (hash) {
          setToast({ message: 'Dispute resolved - funds released to provider.', type: 'success', txHash: hash })
          setTimeout(loadInvoice, 3000)
        } else {
          setToast({ message: 'Failed to resolve dispute.', type: 'error' })
        }
      },
    })
  }

  const handleResolveToClient = () => {
    setConfirmAction({
      title: 'Refund to Client',
      message: `Refund to the client?\n\nThis decision is final.`,
      type: 'warning',
      confirmText: 'Refund',
      onConfirm: async () => {
        setConfirmAction(null)
        setToast({ message: 'Resolving dispute...', type: 'info' })
        
        const hash = await resolveDispute(invoiceId, false)
        if (hash) {
          setToast({ message: 'Dispute resolved - funds refunded to client.', type: 'success', txHash: hash })
          setTimeout(loadInvoice, 3000)
        } else {
          setToast({ message: 'Failed to resolve dispute.', type: 'error' })
        }
      },
    })
  }

  const statusConfig: Record<number, { label: string; class: string }> = {
    0: { label: 'CREATED', class: 'badge-neutral' },
    1: { label: 'FUNDED', class: 'badge-info' },
    2: { label: 'APPROVED', class: 'badge-info' },
    3: { label: 'COMPLETED', class: 'badge-success' },
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
                  <span className="text-[var(--accent-primary)] text-xs ml-2">// CONFIDENTIAL</span>
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
            <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-2">
              // Confidential Invoice #{invoice.id.toString()}
            </p>
            <h1 className="headline text-4xl text-[var(--text-primary)]">
              Privacy-preserved escrow
            </h1>
          </div>
          <span className={`badge ${status.class}`}>{status.label}</span>
        </div>

        {/* Amount Card - Encrypted */}
        <div className="card-accent p-8 mb-8 glow-accent animate-pulse-glow">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 border border-[var(--accent-primary)] flex items-center justify-center">
              <span className="text-[var(--accent-primary)] text-xs">FH</span>
            </div>
            <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider">
              // Encrypted Amount
            </p>
          </div>
          
          {isDecrypting ? (
            <p className="headline text-3xl text-[var(--text-secondary)]">Decrypting...</p>
          ) : invoice.decryptedAmount ? (
            <>
              <p className="headline text-5xl text-[var(--text-primary)] mb-2">
                {invoice.decryptedAmount} <span className="text-[var(--accent-primary)]">cUSDC</span>
              </p>
              <p className="text-xs text-[var(--accent-primary)]">{'\u2713'} Decrypted successfully</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-mono text-[var(--text-muted)] tracking-widest mb-4">
                ████████████
              </p>
              {(isClient || isProvider || isArbiter) && (
                <button
                  onClick={async () => {
                    setIsDecryptingAmount(true)
                    setToast({ message: 'Decrypting amount (requires signature)...', type: 'info' })
                    try {
                      const updatedInvoice = await getInvoiceWithDecryption(invoiceId)
                      if (updatedInvoice) {
                        setInvoice(updatedInvoice)
                        if (updatedInvoice.decryptedAmount) {
                          setToast({ message: 'Amount decrypted successfully!', type: 'success' })
                        } else {
                          setToast({ message: 'Could not decrypt amount. Check console for details.', type: 'warning' })
                        }
                      } else {
                        setToast({ message: 'Failed to fetch invoice data.', type: 'error' })
                      }
                    } catch (err) {
                      console.error('Decrypt error:', err)
                      setToast({ message: `Decryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`, type: 'error' })
                    } finally {
                      setIsDecryptingAmount(false)
                    }
                  }}
                  disabled={isDecryptingAmount}
                  className="btn-secondary"
                >
                  {isDecryptingAmount ? 'Decrypting...' : <>Decrypt Amount <span>{'\u00BB'}</span></>}
                </button>
              )}
              {!(isClient || isProvider || isArbiter) && (
                <p className="text-xs text-[var(--text-muted)]">
                  Only parties can decrypt
                </p>
              )}
            </>
          )}

          <div className="mt-6 pt-6 border-t border-[var(--accent-border)]">
            <p className="text-xs text-[var(--text-muted)]">
              Created: {new Date(Number(invoice.createdAt) * 1000).toLocaleDateString()}
            </p>
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
                <p className="text-xs text-[var(--text-muted)] mb-1">// CLIENT (PAYER) {isClient && '(You)'}</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{invoice.client}</p>
              </div>
              {invoice.clientApproved && (
                <span className="badge badge-success">{'\u2713'} Approved</span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] border border-white/5">
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">// PROVIDER (PAYEE) {isProvider && '(You)'}</p>
                <p className="font-mono text-sm text-[var(--text-primary)]">{invoice.provider}</p>
              </div>
              {invoice.providerApproved && (
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

        {/* Actions */}
        <div className="card-bracketed p-6 mb-8">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-6">
            // Actions
          </p>
          
          {!isConnected ? (
            <p className="text-[var(--text-secondary)]">Connect your wallet to take actions</p>
          ) : !isClient && !isProvider && !isArbiter ? (
            <p className="text-[var(--text-secondary)]">You are not a party to this invoice</p>
          ) : isCompleted || isRefunded ? (
            <p className="text-[var(--text-secondary)]">This invoice has been {isCompleted ? 'completed' : 'refunded'}.</p>
          ) : (
            <div className="space-y-4">
              {/* Provider actions */}
              {providerCanApprove && (
                <button
                  onClick={handleApproveRelease}
                  disabled={isApproving}
                  className="btn-primary w-full justify-center"
                >
                  {isApproving ? 'Processing...' : <>Confirm Work Complete & Request Payment <span>{'\u00BB'}</span></>}
                </button>
              )}

              {/* Client actions */}
              {clientCanApprove && (
                <button
                  onClick={handleApproveRelease}
                  disabled={isApproving}
                  className="btn-primary w-full justify-center"
                >
                  {isApproving ? 'Processing...' : <>Approve & Release Funds <span>{'\u00BB'}</span></>}
                </button>
              )}

              {clientCanDispute && (
                <button
                  onClick={handleDispute}
                  disabled={isDisputing}
                  className="btn-danger w-full justify-center"
                >
                  {isDisputing ? 'Processing...' : <>Raise Dispute <span>{'\u00BB'}</span></>}
                </button>
              )}

              {/* Arbiter Actions */}
              {arbiterCanResolve && (
                <>
                  <button
                    onClick={handleResolveToProvider}
                    disabled={isResolving}
                    className="btn-primary w-full justify-center"
                  >
                    {isResolving ? 'Processing...' : <>Release to Provider <span>{'\u00BB'}</span></>}
                  </button>
                  <button
                    onClick={handleResolveToClient}
                    disabled={isResolving}
                    className="btn-secondary w-full justify-center"
                  >
                    {isResolving ? 'Processing...' : <>Refund to Client <span>{'\u00BB'}</span></>}
                  </button>
                </>
              )}

              {/* Status messages */}
              {isApproved && isClient && (
                <div className="p-4 bg-[rgba(76,168,229,0.1)] border border-[var(--status-info)]/30">
                  <p className="text-xs text-[var(--status-info)]">
                    Provider requested payment. Review and either release funds or raise a dispute.
                  </p>
                </div>
              )}

              {isApproved && isProvider && (
                <div className="p-4 bg-[rgba(76,168,229,0.1)] border border-[var(--status-info)]/30">
                  <p className="text-xs text-[var(--status-info)]">
                    Payment requested. Waiting for payer decision (release or dispute).
                  </p>
                </div>
              )}

              {isFunded && isClient && (
                <div className="p-4 bg-[var(--bg-secondary)] border border-white/5">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Invoice funded. Waiting for provider to confirm work and request payment.
                  </p>
                </div>
              )}

              {isFunded && isProvider && (
                <div className="p-4 bg-[var(--bg-secondary)] border border-white/5">
                  <p className="text-xs text-[var(--text-secondary)]">
                    Invoice funded. Complete work, then click &quot;Confirm Work Complete&quot; to request payment.
                  </p>
                </div>
              )}

              {isDisputed && !isArbiter && (
                <div className="p-4 bg-[rgba(229,184,76,0.1)] border border-[var(--status-warning)]/30">
                  <p className="text-xs text-[var(--status-warning)]">
                    This invoice is under dispute. Waiting for arbiter decision.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contract Info */}
        <div className="p-4 bg-[var(--bg-secondary)] border border-white/5">
          <p className="text-xs text-[var(--text-muted)]">
            <span className="text-[var(--text-muted)]">// </span>
            Contract: <span className="font-mono">{CONTRACTS.CONFIDENTIAL_ESCROW}</span>
          </p>
        </div>
      </main>

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          type={confirmAction.type}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}

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
