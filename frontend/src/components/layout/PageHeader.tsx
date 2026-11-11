import React from 'react'
import { Badge } from '../common/Badge'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badgeText?: string
  badgeVariant?: 'valid' | 'info' | 'warning' | 'pqc' | 'neutral'
  actions?: React.ReactNode
  breadcrumb?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badgeText,
  badgeVariant = 'neutral',
  actions,
  breadcrumb,
}) => {
  return (
    <div
      style={{
        padding: '16px 24px',
        backgroundColor: 'var(--surface-main)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {breadcrumb && (
        <div
          style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {breadcrumb}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h1>
          {badgeText && <Badge variant={badgeVariant}>{badgeText}</Badge>}
        </div>

        {actions && <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>{actions}</div>}
      </div>

      {subtitle && (
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '900px' }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
