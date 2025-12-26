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

  const bgColor = {
    success: 'bg-green-500/20 border-green-500',
    error: 'bg-red-500/20 border-red-500',
    info: 'bg-blue-500/20 border-blue-500',
    warning: 'bg-yellow-500/20 border-yellow-500',
  }[type]

  const icon = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  }[type]

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} border rounded-lg p-4 shadow-lg backdrop-blur-sm animate-slide-in max-w-md`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <p className="text-white text-sm">{message}</p>
          {txHash && (
            <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-xs mt-2 inline-flex items-center gap-1 underline"
            >
              View transaction
              <span>↗</span>
            </a>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
