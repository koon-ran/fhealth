'use client'

import { useEffect } from 'react'

type ToastProps = {
  message: string
  type?: 'success' | 'error' | 'info' | 'warning'
  onClose: () => void
  duration?: number
  txHash?: string
}

export default function Toast({ message, type = 'info', onClose, duration = 5000, txHash }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const config = {
    success: {
      border: 'border-[var(--status-success)]',
      bg: 'bg-[rgba(62,207,178,0.1)]',
      icon: '\u2713',
    },
    error: {
      border: 'border-[var(--status-error)]',
      bg: 'bg-[rgba(229,76,76,0.1)]',
      icon: '\u2717',
    },
    info: {
      border: 'border-[var(--status-info)]',
      bg: 'bg-[rgba(76,168,229,0.1)]',
      icon: '\u2022',
    },
    warning: {
      border: 'border-[var(--status-warning)]',
      bg: 'bg-[rgba(229,184,76,0.1)]',
      icon: '!',
    },
  }[type]

  return (
    <div className={`fixed top-4 right-4 z-50 ${config.bg} ${config.border} border p-4 max-w-md animate-slide-in`}>
      <div className="flex items-start gap-3">
        <span className="text-sm font-mono">{config.icon}</span>
        <div className="flex-1">
          <p className="text-sm text-[var(--text-primary)]">{message}</p>
          {txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--accent-primary)] hover:underline mt-2 inline-flex items-center gap-1"
            >
              View transaction {'\u2197'}
            </a>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-sm"
        >
          {'\u2717'}
        </button>
      </div>
    </div>
  )
}
