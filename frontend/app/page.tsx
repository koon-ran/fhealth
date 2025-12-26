'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { useReadContract, useAccount } from 'wagmi'
import { CONTRACTS, ARC_ESCROW_ABI, CONFIDENTIAL_ESCROW_ABI, InvoiceStatusLabel, type Invoice, type ConfidentialInvoice } from '@/lib/contracts'
import { formatUnits } from 'viem'

type ActionCardProps = {
  title: string
  description: string
  href: string
  badge: string
}

type FeatureCardProps = {
  title: string
  description: string
}

function ActionCard({ title, description, href, badge }: ActionCardProps) {
  return (
    <Link
      href={href}
      className="flex h-full flex-col justify-between rounded-2xl border border-gray-800 bg-gray-900/60 p-6 transition hover:border-blue-500 hover:bg-gray-900"
    >
      <div>
        <span className="inline-flex items-center rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300">
          {badge}
        </span>
        <h4 className="mt-4 text-xl font-semibold">{title}</h4>
        <p className="mt-2 text-sm text-gray-400">{description}</p>
      </div>
      <span className="mt-6 text-sm font-semibold text-blue-300">Open -&gt;</span>
    </Link>
  )
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
      <h4 className="text-lg font-semibold text-white">{title}</h4>
      <p className="mt-3 text-sm text-gray-400">{description}</p>
    </div>
  )
}

function InvoiceCard({ invoice }: { invoice: Invoice }) {
  const { address } = useAccount()
  const isUserInvolved = address && (
    invoice.payer.toLowerCase() === address.toLowerCase() ||
    invoice.payee.toLowerCase() === address.toLowerCase() ||
    invoice.arbiter.toLowerCase() === address.toLowerCase()
  )

  return (
    <Link
      href={`/invoice/${invoice.id}`}
      className="block rounded-xl border border-gray-800 bg-gray-900/60 p-5 hover:border-blue-500 hover:bg-gray-900 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {invoice.title || `Invoice #${invoice.id.toString()}`}
          </span>
          <p className="mt-1 text-2xl font-bold text-white">
            {formatUnits(invoice.amount, 6)} USDC
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          invoice.status === 3 ? 'bg-green-500/20 text-green-400' :
          invoice.status === 5 ? 'bg-red-500/20 text-red-400' :
          invoice.status === 1 ? 'bg-blue-500/20 text-blue-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {InvoiceStatusLabel[invoice.status as keyof typeof InvoiceStatusLabel]}
        </span>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Payer:</span>
          <span className="font-mono text-gray-300">{invoice.payer.slice(0, 6)}...{invoice.payer.slice(-4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Payee:</span>
          <span className="font-mono text-gray-300">{invoice.payee.slice(0, 6)}...{invoice.payee.slice(-4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Created:</span>
          <span className="text-gray-300">
            {new Date(Number(invoice.createdAt) * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      {isUserInvolved && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-blue-400 flex items-center gap-2">
            <span>👤</span> You are involved in this invoice
            <span className="ml-auto">Click to manage →</span>
          </p>
        </div>
      )}
    </Link>
  )
}

function ConfidentialInvoiceCard({ invoice }: { invoice: ConfidentialInvoice }) {
  const { address } = useAccount()
  const isUserInvolved = address && (
    invoice.payer.toLowerCase() === address.toLowerCase() ||
    invoice.payee.toLowerCase() === address.toLowerCase() ||
    invoice.arbiter.toLowerCase() === address.toLowerCase()
  )

  return (
    <Link
      href={`/confidential/${invoice.id}`}
      className="block rounded-xl border border-purple-500/30 bg-purple-900/10 p-5 hover:bg-purple-900/20 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            🔐 Invoice #{invoice.id.toString()}
          </span>
          <p className="mt-1 text-2xl font-bold text-purple-400">
            🔐 Encrypted
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          invoice.status === 3 ? 'bg-green-500/20 text-green-400' :
          invoice.status === 5 ? 'bg-red-500/20 text-red-400' :
          invoice.status === 1 ? 'bg-blue-500/20 text-blue-400' :
          'bg-gray-500/20 text-gray-400'
        }`}>
          {InvoiceStatusLabel[invoice.status as keyof typeof InvoiceStatusLabel]}
        </span>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Payer:</span>
          <span className="font-mono text-gray-300">{invoice.payer.slice(0, 6)}...{invoice.payer.slice(-4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Payee:</span>
          <span className="font-mono text-gray-300">{invoice.payee.slice(0, 6)}...{invoice.payee.slice(-4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Created:</span>
          <span className="text-gray-300">
            {new Date(Number(invoice.createdAt) * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>
      
      {isUserInvolved && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-purple-400 flex items-center gap-2">
            <span>👤</span> You are involved in this invoice
            <span className="ml-auto">Click to manage →</span>
          </p>
        </div>
      )}
    </Link>
  )
}

export default function Home() {
  const { address } = useAccount()
  
  // Read standard invoice count
  const { data: invoiceCount } = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'invoiceCount',
  })

  // Read confidential invoice count
  const { data: confInvoiceCount } = useReadContract({
    address: CONTRACTS.CONFIDENTIAL_ESCROW,
    abi: CONFIDENTIAL_ESCROW_ABI,
    functionName: 'invoiceCount',
  })

  const count = Number(invoiceCount || 0)
  const confCount = Number(confInvoiceCount || 0)

  // Read last 10 invoices using fixed hooks (to comply with Rules of Hooks)
  const invoice1 = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: count >= 1 ? [BigInt(count)] : undefined,
    query: { enabled: count >= 1 },
  })
  const invoice2 = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: count >= 2 ? [BigInt(count - 1)] : undefined,
    query: { enabled: count >= 2 },
  })
  const invoice3 = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: count >= 3 ? [BigInt(count - 2)] : undefined,
    query: { enabled: count >= 3 },
  })
  const invoice4 = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: count >= 4 ? [BigInt(count - 3)] : undefined,
    query: { enabled: count >= 4 },
  })
  const invoice5 = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: count >= 5 ? [BigInt(count - 4)] : undefined,
    query: { enabled: count >= 5 },
  })
  const invoice6 = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'getInvoice',
    args: count >= 6 ? [BigInt(count - 5)] : undefined,
    query: { enabled: count >= 6 },
  })

  // Query confidential invoices
  const confInvoice1 = useReadContract({
    address: CONTRACTS.CONFIDENTIAL_ESCROW,
    abi: CONFIDENTIAL_ESCROW_ABI,
    functionName: 'getInvoice',
    args: confCount >= 1 ? [BigInt(confCount)] : undefined,
    query: { enabled: confCount >= 1 },
  })
  const confInvoice2 = useReadContract({
    address: CONTRACTS.CONFIDENTIAL_ESCROW,
    abi: CONFIDENTIAL_ESCROW_ABI,
    functionName: 'getInvoice',
    args: confCount >= 2 ? [BigInt(confCount - 1)] : undefined,
    query: { enabled: confCount >= 2 },
  })
  const confInvoice3 = useReadContract({
    address: CONTRACTS.CONFIDENTIAL_ESCROW,
    abi: CONFIDENTIAL_ESCROW_ABI,
    functionName: 'getInvoice',
    args: confCount >= 3 ? [BigInt(confCount - 2)] : undefined,
    query: { enabled: confCount >= 3 },
  })

  const invoices = [
    invoice1.data,
    invoice2.data,
    invoice3.data,
    invoice4.data,
    invoice5.data,
    invoice6.data,
  ].filter((inv): inv is Invoice => inv !== undefined)

  const confInvoices = [
    confInvoice1.data,
    confInvoice2.data,
    confInvoice3.data,
  ]
    .map((data, index) => {
      if (!data) return undefined
      // Map tuple to ConfidentialInvoice
      const [payer, payee, arbiter, status, payerApproved, payeeApproved, metadataHash, createdAt, completedAt] = data
      // Calculate ID based on confCount and index (latest invoices first)
      const id = confCount >= index + 1 ? BigInt(confCount - index) : BigInt(0)
      return {
        id,
        payer,
        payee,
        arbiter,
        status,
        payerApproved,
        payeeApproved,
        metadataHash,
        createdAt,
        completedAt,
      } as ConfidentialInvoice
    })
    .filter((inv): inv is ConfidentialInvoice => inv !== undefined && inv.id > BigInt(0))

  // Filter to only show invoices where user is involved
  const userInvoices = address ? invoices.filter(invoice => 
    invoice.payer.toLowerCase() === address.toLowerCase() ||
    invoice.payee.toLowerCase() === address.toLowerCase() ||
    invoice.arbiter.toLowerCase() === address.toLowerCase()
  ) : []

  const userConfInvoices = address ? confInvoices.filter(invoice => 
    invoice.payer.toLowerCase() === address.toLowerCase() ||
    invoice.payee.toLowerCase() === address.toLowerCase() ||
    invoice.arbiter.toLowerCase() === address.toLowerCase()
  ) : []

  const hasAnyInvoices = userInvoices.length > 0 || userConfInvoices.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <header className="border-b border-gray-800 bg-gray-900/70 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <span className="text-lg font-semibold">A</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold">FHEscrow</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg text-gray-300 hover:text-white transition-all text-sm font-medium"
            >
              <span>Dashboard</span>
            </Link>
            <Link
              href="/wrap"
              className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-all text-sm font-medium"
            >
              <span>💱 Wrap</span>
            </Link>
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
      </header>

      <main className="container mx-auto px-4 py-12">
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <ActionCard
            title="Create a  Escrow"
            description="Standard escrow with public amounts. Lower gas, faster transactions."
            href="/create"
            badge="Standard"
          />
          <Link
            href="/create-confidential"
            className="flex h-full flex-col justify-between rounded-2xl border border-purple-500/50 bg-purple-900/20 p-6 transition hover:border-purple-400 hover:bg-purple-900/30"
          >
            <div>
              <span className="inline-flex items-center rounded-full border border-purple-500/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-300">
                🔐 FHE Encrypted
              </span>
              <h4 className="mt-4 text-xl font-semibold">Confidential Escrow</h4>
              <p className="mt-2 text-sm text-gray-400">Create a confidential escrow. Only parties involved can see the payment details.</p>
            </div>
            <span className="mt-6 text-sm font-semibold text-purple-300">Create Private Invoice -&gt;</span>
          </Link>
        </section>

        <section className="mt-8">
          <Link
            href="/wrap"
            className="flex items-center justify-between rounded-2xl border border-gray-800 bg-gray-900/40 p-6 transition hover:border-blue-500"
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">💱</div>
              <div>
                <h4 className="text-lg font-semibold text-white">Token Wrapper</h4>
                <p className="text-sm text-gray-400">Convert USDC ↔ cUSDC for confidential transactions</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-blue-300">Wrap Tokens -&gt;</span>
          </Link>
        </section>

        <section className="mt-16 rounded-2xl border border-gray-800 bg-gray-900/60 p-8">
          <h3 className="text-2xl font-semibold">How FHEscrow Works</h3>
          <div className="mt-6 grid gap-6 md:grid-cols-4">
            <FeatureCard
              title="Sequential Approval"
              description="Payer creates and funds. Payee requests payment. Payer approves or disputes."
            />
            <FeatureCard
              title="Dispute Resolution"
              description="A designated arbiter reviews disputes and decides to release or refund."
            />
            <FeatureCard
              title="🔐 FHE Privacy"
              description="Confidential mode encrypts amounts on-chain. Only parties can decrypt."
            />
          </div>
        </section>

        <section className="mt-16 rounded-2xl border border-gray-800 bg-gray-900/40 p-8">
          <h3 className="text-2xl font-semibold mb-6">Your Invoices</h3>
          {!address ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-6 text-center text-gray-400">
              <p className="text-lg font-medium">Connect your wallet</p>
              <p className="mt-2 text-sm">Connect your wallet to view invoices you're involved in.</p>
            </div>
          ) : !hasAnyInvoices ? (
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-6 text-center text-gray-400">
              <p className="text-lg font-medium">No invoices found</p>
              <p className="mt-2 text-sm">You have no invoices as a payer or payee yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {userInvoices.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-300 mb-3">Standard Invoices</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {userInvoices.map(invoice => (
                      <InvoiceCard key={`std-${invoice.id.toString()}`} invoice={invoice} />
                    ))}
                  </div>
                </div>
              )}
              {userConfInvoices.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-purple-300 mb-3">🔐 Confidential Invoices</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {userConfInvoices.map(invoice => (
                      <ConfidentialInvoiceCard key={`conf-${invoice.id.toString()}`} invoice={invoice} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-gray-800 bg-gray-900/70 py-6 text-center text-sm text-gray-500">
        <p>Deployed to Sepolia testnet.</p>
      </footer>
    </div>
  )
}
