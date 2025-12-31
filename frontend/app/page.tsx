'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { useReadContract, useAccount } from 'wagmi'
import { CONTRACTS, ARC_ESCROW_ABI, CONFIDENTIAL_ESCROW_ABI, InvoiceStatusLabel, type Invoice, type ConfidentialInvoice } from '@/lib/contracts'
import { formatUnits } from 'viem'

function NavLink({ href, children, external }: { href: string; children: React.ReactNode; external?: boolean }) {
  const Component = external ? 'a' : Link
  const props = external ? { href, target: "_blank", rel: "noopener noreferrer" } : { href }
  
  return (
    <Component {...props} className="nav-link text-xs uppercase tracking-wider font-medium hover:text-[var(--accent-primary)] transition-colors">
      {children}
    </Component>
  )
}

function ActionCard({ 
  title, 
  description, 
  href, 
  label,
  accent 
}: { 
  title: string
  description: string
  href: string
  label: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`group block p-6 transition-all duration-300 ${
        accent 
          ? 'card-accent hover:border-[var(--accent-primary)]' 
          : 'card-bracketed hover:bg-[var(--bg-card-hover)]'
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <span className="label">{label}</span>
        <span className="text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors">
          {'\u00BB'}
        </span>
      </div>
      <h3 className="headline text-2xl text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </Link>
  )
}

function FeatureItem({ label, description }: { label: string; description: string }) {
  return (
    <div className="py-4 border-b border-white/5 last:border-0">
      <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-1">
        <span className="text-[var(--text-muted)]">// </span>{label}
      </p>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const { address } = useAccount()
  const isUserInvolved = address && (
    invoice.payer.toLowerCase() === address.toLowerCase() ||
    invoice.payee.toLowerCase() === address.toLowerCase() ||
    invoice.arbiter.toLowerCase() === address.toLowerCase()
  )

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
    <Link
      href={`/invoice/${invoice.id}`}
      className="block card-bracketed p-5 hover:bg-[var(--bg-card-hover)] transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[var(--text-muted)] text-xs mb-1">
            // INVOICE #{invoice.id.toString()}
          </p>
          <p className="headline text-2xl text-[var(--text-primary)]">
            {formatUnits(invoice.amount, 6)} <span className="text-[var(--accent-primary)]">USDC</span>
          </p>
        </div>
        <span className={`badge ${status.class}`}>{status.label}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-[var(--text-muted)] mb-1">// PAYER</p>
          <p className="font-mono text-[var(--text-secondary)]">
            {invoice.payer.slice(0, 6)}...{invoice.payer.slice(-4)}
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] mb-1">// PAYEE</p>
          <p className="font-mono text-[var(--text-secondary)]">
            {invoice.payee.slice(0, 6)}...{invoice.payee.slice(-4)}
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {new Date(Number(invoice.createdAt) * 1000).toLocaleDateString()}
        </p>
        <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors">
          VIEW DETAILS {'\u00BB'}
        </span>
      </div>
    </Link>
  )
}

function ConfidentialInvoiceRow({ invoice }: { invoice: ConfidentialInvoice }) {
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
    <Link
      href={`/confidential/${invoice.id}`}
      className="block card-accent p-5 hover:border-[var(--accent-primary)] transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[var(--accent-primary)] text-xs mb-1">
            // CONFIDENTIAL #{invoice.id.toString()}
          </p>
          <p className="headline text-2xl text-[var(--text-primary)]">
            <span className="encrypted-text">ENCRYPTED</span>
          </p>
        </div>
        <span className={`badge ${status.class}`}>{status.label}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <p className="text-[var(--text-muted)] mb-1">// PAYER</p>
          <p className="font-mono text-[var(--text-secondary)]">
            {invoice.payer.slice(0, 6)}...{invoice.payer.slice(-4)}
          </p>
        </div>
        <div>
          <p className="text-[var(--text-muted)] mb-1">// PAYEE</p>
          <p className="font-mono text-[var(--text-secondary)]">
            {invoice.payee.slice(0, 6)}...{invoice.payee.slice(-4)}
          </p>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-[var(--accent-border)] flex items-center justify-between">
        <p className="text-xs text-[var(--text-muted)]">
          {new Date(Number(invoice.createdAt) * 1000).toLocaleDateString()}
        </p>
        <span className="text-xs text-[var(--accent-primary)] group-hover:text-[var(--text-primary)] transition-colors">
          DECRYPT {'\u00BB'}
        </span>
      </div>
    </Link>
  )
}

export default function Home() {
  const { address } = useAccount()
  
  const { data: invoiceCount } = useReadContract({
    address: CONTRACTS.ArcEscrow,
    abi: ARC_ESCROW_ABI,
    functionName: 'invoiceCount',
  })

  const { data: confInvoiceCount } = useReadContract({
    address: CONTRACTS.CONFIDENTIAL_ESCROW,
    abi: CONFIDENTIAL_ESCROW_ABI,
    functionName: 'invoiceCount',
  })

  const count = Number(invoiceCount || 0)
  const confCount = Number(confInvoiceCount || 0)

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

  const invoices = [
    invoice1.data,
    invoice2.data,
    invoice3.data,
    invoice4.data,
  ].filter((inv): inv is Invoice => inv !== undefined)

  const confInvoices = [
    confInvoice1.data,
    confInvoice2.data,
  ]
    .map((data, index) => {
      if (!data) return undefined
      const [payer, payee, arbiter, status, payerApproved, payeeApproved, metadataHash, createdAt, completedAt] = data
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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-8 h-8 border border-[var(--accent-primary)] flex items-center justify-center">
                  <span className="text-[var(--accent-primary)] text-xs font-bold">FH</span>
                </div>
                <div className="hidden sm:block">
                  <span className="text-sm font-medium tracking-wide">FHESCROW</span>
                  <span className="text-[var(--text-muted)] text-xs ml-2">// PROTOCOL</span>
                </div>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <NavLink href="/">Dashboard</NavLink>
                <span className="text-[var(--text-muted)]">|</span>
                <NavLink href="/wrap">Wrap</NavLink>
                <span className="text-[var(--text-muted)]">|</span>
                <NavLink href="https://faucet.circle.com/" external>Get USDC</NavLink>
              </nav>
            </div>
            
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-3xl">
            <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-4">
              // Confidential Escrow Protocol
            </p>
            <h1 className="headline text-5xl md:text-6xl lg:text-7xl text-[var(--text-primary)] mb-6">
              Trustless payments,<br />
              <span className="text-[var(--accent-primary)]">encrypted by default</span>
            </h1>
            <p className="text-lg text-[var(--text-secondary)] max-w-xl mb-8">
              Privacy-preserving escrow powered by Fully Homomorphic Encryption. 
              Payment amounts remain encrypted on-chain, visible only to authorized parties.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/create" className="btn-primary">
                Create Escrow <span>{'\u00BB'}</span>
              </Link>
              <Link href="/create-confidential" className="btn-secondary">
                Confidential Mode <span>{'\u00BB'}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Action Cards */}
        <section className="grid md:grid-cols-2 gap-6 mb-16">
          <ActionCard
            title="Standard Escrow"
            description="Traditional on-chain escrow with public payment amounts. Lower gas, faster transactions."
            href="/create"
            label="// Standard"
          />
          <ActionCard
            title="Confidential Escrow"
            description="FHE-encrypted payments. Only authorized parties can view transaction amounts."
            href="/create-confidential"
            label="// Encrypted"
            accent
          />
        </section>

        {/* Wrap Section */}
        <section className="mb-16">
          <Link 
            href="/wrap"
            className="block card-bracketed p-6 hover:bg-[var(--bg-card-hover)] transition-all group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 border border-[var(--accent-border)] flex items-center justify-center">
                  <span className="text-[var(--accent-primary)] text-lg">{'\u21C4'}</span>
                </div>
                <div>
                  <p className="text-[var(--text-muted)] text-xs mb-1">// TOKEN WRAPPER</p>
                  <p className="text-lg text-[var(--text-primary)]">
                    Convert USDC {'\u2194'} cUSDC for confidential transactions
                  </p>
                </div>
              </div>
              <span className="text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors text-xl">
                {'\u00BB'}
              </span>
            </div>
          </Link>
        </section>

        {/* How It Works */}
        <section className="mb-16">
          <div className="card-bracketed p-8">
            <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-6">
              // How FHEscrow Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureItem
                label="01 Sequential Approval"
                description="Payer creates and funds. Payee requests payment. Payer approves or disputes."
              />
              <FeatureItem
                label="02 Dispute Resolution"
                description="A designated arbiter reviews disputes and decides to release or refund."
              />
              <FeatureItem
                label="03 FHE Privacy"
                description="Confidential mode encrypts amounts on-chain. Only parties can decrypt."
              />
            </div>
          </div>
        </section>

        {/* Your Invoices */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wider">
              // Your Invoices
            </h2>
            {hasAnyInvoices && (
              <span className="text-xs text-[var(--text-muted)]">
                {userInvoices.length + userConfInvoices.length} total
              </span>
            )}
          </div>

          {!address ? (
            <div className="card-bracketed p-12 text-center">
              <p className="text-[var(--text-secondary)] mb-2">Connect wallet to view your invoices</p>
              <p className="text-xs text-[var(--text-muted)]">Your invoices as payer, payee, or arbiter will appear here</p>
            </div>
          ) : !hasAnyInvoices ? (
            <div className="card-bracketed p-12 text-center">
              <p className="text-[var(--text-secondary)] mb-2">No invoices found</p>
              <p className="text-xs text-[var(--text-muted)]">Create your first escrow to get started</p>
            </div>
          ) : (
            <div className="space-y-8">
              {userInvoices.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--text-muted)] mb-4">// STANDARD</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {userInvoices.map(invoice => (
                      <InvoiceRow key={`std-${invoice.id.toString()}`} invoice={invoice} />
                    ))}
                  </div>
                </div>
              )}
              {userConfInvoices.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--accent-primary)] mb-4">// CONFIDENTIAL</p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {userConfInvoices.map(invoice => (
                      <ConfidentialInvoiceRow key={`conf-${invoice.id.toString()}`} invoice={invoice} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-muted)]">
              // Deployed on Ethereum Sepolia Testnet
            </p>
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>Powered by Zama fhEVM</span>
              <span>|</span>
              <span>Circle USDC</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
