'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { useConfidentialToken, useFhevm } from '@/lib/fhevm'

export default function GatewayOperatorPrompt() {
  const { isConnected, address } = useAccount()
  const { isReady: fhevmReady } = useFhevm()
  const { isOperatorValid, setGatewayAsOperator, isSettingOperator } = useConfidentialToken()
  const [dismissed, setDismissed] = useState(false)
  const [isPrompting, setIsPrompting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setDismissed(false)
    setError(null)
  }, [address])

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
    <div className="fixed bottom-4 right-4 max-w-sm card-accent p-4 z-50 animate-slide-in">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 border border-[var(--accent-primary)] flex items-center justify-center shrink-0">
          <span className="text-[var(--accent-primary)] text-xs">FH</span>
        </div>
        <div className="flex-1">
          <p className="text-xs text-[var(--accent-primary)] uppercase tracking-wider mb-1">
            // Enable Encryption
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Authorize the Gateway to decrypt your confidential balances.
          </p>
          {error && (
            <p className="text-xs text-[var(--status-error)] mt-1">{error}</p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSetOperator}
              disabled={isSettingOperator || isPrompting}
              className="px-3 py-2 bg-[var(--accent-primary)] text-[var(--bg-primary)] text-xs font-medium uppercase tracking-wider disabled:opacity-50"
            >
              {isSettingOperator || isPrompting ? 'Authorizing...' : 'Authorize'}
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs uppercase tracking-wider"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
