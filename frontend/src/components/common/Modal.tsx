import React, { useEffect } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  isDanger?: boolean
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  isDanger = false,
  children,
  footer,
  maxWidth = '480px',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(9, 10, 10, 0.75)',
          backdropFilter: 'blur(3px)',
          animation: 'fadeIn 120ms ease-out',
        }}
      />

      {/* Dialog Surface */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth,
          backgroundColor: 'var(--surface-elevated)',
          border: `1px solid ${isDanger ? 'var(--crimson-border)' : 'var(--border-emphasis)'}`,
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.7)',
          zIndex: 1101,
          animation: 'fadeIn 150ms ease-out',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isDanger && (
              <span
                style={{
                  color: 'var(--crimson-500)',
                  backgroundColor: 'var(--crimson-bg)',
                  padding: '6px',
                  borderRadius: 'var(--radius-xs)',
                  display: 'inline-flex',
                }}
              >
                <AlertTriangle size={16} />
              </span>
            )}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {title}
              </h3>
              {subtitle && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: 'var(--radius-xs)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px' }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-default)',
              backgroundColor: 'var(--surface-nav)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
