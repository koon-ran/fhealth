'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useConfidentialToken, useFhevm } from '@/lib/fhevm'

/**
 * Auto-prompts user to set Gateway as operator after connecting wallet.
 * This is required for decrypting confidential balances.
 */
export default function GatewayOperatorPrompt() {
  const { isConnected, address } = useAccount()
  const { isReady: fhevmReady } = useFhevm()
  const { isOperatorValid, setGatewayAsOperator, isSettingOperator } = useConfidentialToken()
  const [dismissed, setDismissed] = useState(false)
  const [isPrompting, setIsPrompting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset dismissed state when address changes
  useEffect(() => {
    setDismissed(false)
    setError(null)
  }, [address])

  // Show prompt when: connected, fhevm ready, operator not valid, not dismissed
  const shouldShow = isConnected && fhevmReady && !isOperatorValid && !dismissed

  const handleSetOperator = async () => {
    setIsPrompting(true)
    setError(null)
    try {
      await setGatewayAsOperator()
      setDismissed(true)
    } catch (err) {
      console.error('Failed to set gateway operator:', err)
      setError('Failed to authorize. Please try again.')
    } finally {
      setIsPrompting(false)
    }
  }

  if (!shouldShow) return null

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-gray-800 border border-purple-500/30 rounded-lg p-4 shadow-xl z-50 animate-in slide-in-from-right">
      <div className="flex items-start gap-3">
        <span className="text-2xl">🔐</span>
        <div className="flex-1">
          <h4 className="font-semibold text-white text-sm">Enable Encryption</h4>
          <p className="text-xs text-gray-400 mt-1">
            Authorize the Gateway to decrypt your confidential balances.
          </p>
          {error && (
            <p className="text-xs text-red-400 mt-1">{error}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSetOperator}
              disabled={isSettingOperator || isPrompting}
              className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium rounded disabled:opacity-50"
            >
              {isSettingOperator || isPrompting ? 'Authorizing...' : 'Authorize'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-gray-400 hover:text-white text-xs"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
