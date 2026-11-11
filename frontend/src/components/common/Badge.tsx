import React from 'react'

export type BadgeVariant =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'valid'
  | 'invalid'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'pqc'
  | 'pqc-trans'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
}) => {
  const getStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'critical':
      case 'invalid':
        return {
          backgroundColor: 'var(--crimson-bg)',
          color: 'var(--crimson-500)',
          borderColor: 'var(--crimson-border)',
        }
      case 'high':
      case 'warning':
        return {
          backgroundColor: 'var(--amber-bg)',
          color: 'var(--amber-500)',
          borderColor: 'var(--amber-border)',
        }
      case 'valid':
        return {
          backgroundColor: 'var(--emerald-bg)',
          color: 'var(--emerald-500)',
          borderColor: 'var(--emerald-border)',
        }
      case 'pqc':
        return {
          backgroundColor: 'rgba(168, 85, 247, 0.12)',
          color: 'var(--purple-500)',
          borderColor: 'var(--purple-border)',
        }
      case 'pqc-trans':
      case 'info':
        return {
          backgroundColor: 'var(--sky-bg)',
          color: 'var(--sky-500)',
          borderColor: 'var(--sky-border)',
        }
      case 'low':
      case 'medium':
      case 'neutral':
      default:
        return {
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-default)',
        }
    }
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: size === 'sm' ? '2px 6px' : '3px 8px',
        borderRadius: 'var(--radius-xs)',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.02em',
        border: '1px solid transparent',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...getStyles(),
      }}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  )
}
