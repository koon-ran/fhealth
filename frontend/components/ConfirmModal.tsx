'use client'

type ConfirmModalProps = {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export default function ConfirmModal({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info',
}: ConfirmModalProps) {
  const config = {
    danger: {
      confirmClass: 'bg-[var(--status-error)] hover:bg-[#c43c3c]',
      border: 'border-[var(--status-error)]/30',
    },
    warning: {
      confirmClass: 'bg-[var(--status-warning)] hover:bg-[#c9a343] text-black',
      border: 'border-[var(--status-warning)]/30',
    },
    info: {
      confirmClass: 'bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)]',
      border: 'border-[var(--accent-primary)]/30',
    },
  }[type]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`bg-[var(--bg-card)] border ${config.border} p-6 max-w-md w-full mx-4 animate-fade-in`}>
        <div className="mb-4">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">// {title}</p>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-white/20 transition-all text-xs uppercase tracking-wider"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-3 text-[var(--bg-primary)] font-semibold transition-all text-xs uppercase tracking-wider ${config.confirmClass}`}
          >
            {confirmText} {'\u00BB'}
          </button>
        </div>
      </div>
    </div>
  )
}
