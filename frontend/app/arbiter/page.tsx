'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'

export default function ArbiterDashboard() {
  const { address, isConnected } = useAccount()

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
                  <span className="text-[var(--text-muted)] text-xs ml-2">// ARBITER</span>
                </div>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="nav-link text-xs uppercase tracking-wider">Dashboard</Link>
                <span className="text-[var(--text-muted)]">|</span>
                <span className="text-xs uppercase tracking-wider text-[var(--text-primary)]">Arbiter</span>
              </nav>
            </div>
            
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12">
          <p className="text-[var(--accent-primary)] text-xs uppercase tracking-wider mb-2">
            // Arbiter Dashboard
          </p>
          <h1 className="headline text-4xl text-[var(--text-primary)] mb-2">
            Dispute Resolution
          </h1>
          <p className="text-[var(--text-secondary)]">
            Review and resolve disputed invoices
          </p>
        </div>

        {!isConnected ? (
          <div className="card-bracketed p-12 text-center">
            <p className="text-[var(--text-secondary)] mb-4">Connect your wallet to view disputes</p>
            <ConnectButton />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="card-bracketed p-6">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">
                  // Pending Disputes
                </p>
                <p className="headline text-4xl text-[var(--status-warning)]">0</p>
              </div>
              <div className="card-bracketed p-6">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">
                  // Resolved
                </p>
                <p className="headline text-4xl text-[var(--accent-primary)]">0</p>
              </div>
              <div className="card-bracketed p-6">
                <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">
                  // Fees Earned
                </p>
                <p className="headline text-4xl text-[var(--text-primary)]">
                  0 <span className="text-[var(--accent-primary)] text-2xl">USDC</span>
                </p>
              </div>
            </div>

            {/* Disputes List */}
            <div className="card-bracketed p-6">
              <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-6">
                // Active Disputes
              </p>
              <div className="text-center py-12">
                <p className="text-[var(--text-secondary)] mb-2">No active disputes</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Disputed invoices will appear here for arbitration
                </p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
