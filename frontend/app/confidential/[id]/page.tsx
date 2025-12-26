'use client'

import { use, useEffect, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
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

  // Load invoice data
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">🔐 Loading confidential invoice...</p>
          {fhevmLoading && <p className="text-gray-400 mt-2">Initializing encryption...</p>}
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl">Invoice not found</p>
          <Link href="/" className="text-purple-400 hover:underline mt-4 inline-block">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isClient = address?.toLowerCase() === invoice.client.toLowerCase()
  const isProvider = address?.toLowerCase() === invoice.provider.toLowerCase()
  const isArbiter = address?.toLowerCase() === invoice.arbiter.toLowerCase()

  // Status checks
  const isFunded = invoice.status === ConfidentialInvoiceStatus.FUNDED
  const isApproved = invoice.status === ConfidentialInvoiceStatus.APPROVED
  const isDisputed = invoice.status === ConfidentialInvoiceStatus.DISPUTED
  const isCompleted = invoice.status === ConfidentialInvoiceStatus.COMPLETED
  const isRefunded = invoice.status === ConfidentialInvoiceStatus.REFUNDED
  const canTakeAction = isFunded || isApproved

  // Action permissions - check who has already approved
  // Flow: payer (client) created invoice, provider (payee) requests payment first, then payer releases or disputes
  const providerCanApprove = isProvider && canTakeAction && !invoice.providerApproved
  // Payer can only approve AFTER payee has requested payment (providerApproved = true)
  const clientCanApprove = isClient && canTakeAction && !invoice.clientApproved && invoice.providerApproved
  const clientCanDispute = isClient && (isFunded || isApproved)
  const arbiterCanResolve = isArbiter && isDisputed

  const handleApproveRelease = () => {
    setConfirmAction({
      title: 'Approve Release',
      message: `Approve release of funds?\n\nAmount: ${invoice.decryptedAmount || '🔐 Encrypted'}\n\nWhen both parties approve, funds will be released to the provider.`,
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

  const statusColor = isCompleted
    ? 'bg-green-500/20 text-green-400'
    : isRefunded
    ? 'bg-red-500/20 text-red-400'
    : isDisputed
    ? 'bg-yellow-500/20 text-yellow-400'
    : isFunded
    ? 'bg-blue-500/20 text-blue-400'
    : 'bg-gray-500/20 text-gray-400'

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
                <p className="text-xs text-gray-400">Confidential Invoice #{invoice.id.toString()}</p>
              </div>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Link href="/" className="text-purple-400 hover:underline mb-4 inline-block">
          ← Back to Dashboard
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">
              Confidential Invoice #{invoice.id.toString()}
            </h2>
            <p className="text-gray-400">Privacy-preserved escrow payment</p>
          </div>
          <span className={`rounded-full px-4 py-2 text-sm font-semibold ${statusColor}`}>
            {getStatusLabel(invoice.status as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
          </span>
        </div>

        {/* Amount Card - Encrypted */}
        <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🔐</span>
            <p className="text-sm text-gray-400">Encrypted Amount</p>
          </div>
          
          {isDecrypting ? (
            <p className="text-3xl font-bold text-white">Decrypting...</p>
          ) : invoice.decryptedAmount ? (
            <>
              <p className="text-5xl font-bold text-white mb-2">
                {invoice.decryptedAmount} cUSDC
              </p>
              <p className="text-sm text-green-400">✓ Decrypted successfully</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-400 font-mono">
                ██████████
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
                  className="mt-3 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg border border-purple-500/50 text-sm font-medium transition-all disabled:opacity-50"
                >
                  {isDecryptingAmount ? '⏳ Decrypting...' : '🔓 Decrypt Amount'}
                </button>
              )}
              {!(isClient || isProvider || isArbiter) && (
                <p className="text-sm text-gray-500 mt-2">
                  Only parties can decrypt
                </p>
              )}
            </>
          )}

          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <p className="text-xs text-gray-500">
              Created: {new Date(Number(invoice.createdAt) * 1000).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Participants</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-sm text-gray-400">Client (Payer) {isClient && '(You)'}</p>
                <p className="font-mono text-white text-sm">{invoice.client}</p>
              </div>
              {invoice.clientApproved && (
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">✓ Approved</span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-sm text-gray-400">Provider (Payee) {isProvider && '(You)'}</p>
                <p className="font-mono text-white text-sm">{invoice.provider}</p>
              </div>
              {invoice.providerApproved && (
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">✓ Approved</span>
              )}
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg">
              <div>
                <p className="text-sm text-gray-400">Arbiter {isArbiter && '(You)'}</p>
                <p className="font-mono text-white text-sm">{invoice.arbiter}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-4">Actions</h3>
          
          {!isConnected ? (
            <p className="text-gray-400">Connect your wallet to take actions</p>
          ) : !isClient && !isProvider && !isArbiter ? (
            <p className="text-gray-400">You are not a party to this invoice</p>
          ) : isCompleted || isRefunded ? (
            <p className="text-gray-400">This invoice has been {isCompleted ? 'completed' : 'refunded'}.</p>
          ) : (
            <div className="space-y-4">
              {/* Provider (payee) actions: request payment by approving first */}
              {providerCanApprove && (
                <button
                  onClick={handleApproveRelease}
                  disabled={isApproving}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-all"
                >
                  {isApproving ? '⏳ Processing...' : '📝 Confirm Work Complete & Request Payment'}
                </button>
              )}

              {/* Payer (client) actions: approve to release or dispute */}
              {clientCanApprove && (
                <button
                  onClick={handleApproveRelease}
                  disabled={isApproving}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-all"
                >
                  {isApproving ? '⏳ Processing...' : '✓ Approve & Release Funds'}
                </button>
              )}

              {clientCanDispute && (
                <button
                  onClick={handleDispute}
                  disabled={isDisputing}
                  className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-3 px-6 rounded-lg border border-red-500/50 disabled:opacity-50 transition-all"
                >
                  {isDisputing ? '⏳ Processing...' : '⚠️ Raise Dispute'}
                </button>
              )}

              {/* Arbiter Actions */}
              {arbiterCanResolve && (
                <>
                  <button
                    onClick={handleResolveToProvider}
                    disabled={isResolving}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-all"
                  >
                    {isResolving ? '⏳ Processing...' : 'Release to Provider'}
                  </button>
                  <button
                    onClick={handleResolveToClient}
                    disabled={isResolving}
                    className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-lg disabled:opacity-50 transition-all"
                  >
                    {isResolving ? '⏳ Processing...' : 'Refund to Client'}
                  </button>
                </>
              )}

              {/* Status messages */}
              {isApproved && isClient && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300">
                    ✓ Provider requested payment. Review and either release funds or raise a dispute.
                  </p>
                </div>
              )}

              {isApproved && isProvider && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300">
                    ⏳ Payment requested. Waiting for payer decision (release or dispute).
                  </p>
                </div>
              )}

              {isFunded && isClient && (
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                  <p className="text-gray-300">
                    💼 Invoice funded. Waiting for provider to confirm work and request payment.
                  </p>
                </div>
              )}

              {isFunded && isProvider && (
                <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-4">
                  <p className="text-gray-300">
                    📋 Invoice funded. Complete work, then click "Confirm Work Complete" to request payment.
                  </p>
                </div>
              )}

              {/* Dispute waiting message */}
              {isDisputed && !isArbiter && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-300">
                    ⚠️ This invoice is under dispute. Waiting for arbiter decision.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contract Info */}
        <div className="bg-gray-800/30 rounded-lg border border-gray-700/50 p-4">
          <p className="text-xs text-gray-500">
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
