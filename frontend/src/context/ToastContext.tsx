import React, { createContext, useContext, useState, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  message: string
  type: ToastType
  durationMs?: number
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: ToastType = 'info', durationMs = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    setToasts((prev) => [...prev, { id, message, type, durationMs }])

    setTimeout(() => {
      removeToast(id)
    }, durationMs)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* Toast Region - Accessible ARIA live region */}
      <div
        role="region"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxWidth: '400px',
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 500,
              backgroundColor: 'var(--surface-elevated)',
              border: `1px solid ${
                toast.type === 'success'
                  ? 'var(--emerald-500)'
                  : toast.type === 'error'
                  ? 'var(--crimson-500)'
                  : toast.type === 'warning'
                  ? 'var(--amber-500)'
                  : 'var(--border-emphasis)'
              }`,
              color: 'var(--text-primary)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              animation: 'fadeIn 150ms ease-out',
            }}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              style={{
                color: 'var(--text-muted)',
                fontSize: '14px',
                lineHeight: 1,
                padding: '2px',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
