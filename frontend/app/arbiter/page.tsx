'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import Link from 'next/link'

export default function ArbiterDashboard() {
  const { address, isConnected } = useAccount()

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-xl">⚖️</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Arbiter Dashboard</h1>
                <p className="text-xs text-gray-400">Dispute Resolution</p>
              </div>
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Dispute Queue</h2>
          <p className="text-gray-400">Review and resolve disputed invoices</p>
        </div>

        {!isConnected ? (
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-12 text-center">
            <p className="text-gray-400 mb-4">Connect your wallet to view disputes</p>
            <ConnectButton />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
                <p className="text-gray-400 text-sm mb-2">Pending Disputes</p>
                <p className="text-3xl font-bold text-yellow-400">0</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
                <p className="text-gray-400 text-sm mb-2">Resolved</p>
                <p className="text-3xl font-bold text-green-400">0</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
                <p className="text-gray-400 text-sm mb-2">Fees Earned</p>
                <p className="text-3xl font-bold text-blue-400">0 USDC</p>
              </div>
            </div>

            {/* Disputes List */}
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
              <h3 className="text-xl font-bold text-white mb-4">Active Disputes</h3>
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">No active disputes</p>
                <p className="text-sm">Disputed invoices will appear here for arbitration</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
