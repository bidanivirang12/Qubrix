import React from 'react'
import { CopyButton } from './CopyButton'

interface CryptoIdentifierProps {
  value: string
  truncateLength?: number
  showCopy?: boolean
  prefix?: string
}

export const CryptoIdentifier: React.FC<CryptoIdentifierProps> = ({
  value,
  truncateLength = 16,
  showCopy = true,
  prefix,
}) => {
  if (!value) return <span style={{ color: 'var(--text-muted)' }}>—</span>

  let displayValue = value
  if (value.length > truncateLength * 2) {
    const start = value.slice(0, truncateLength)
    const end = value.slice(-truncateLength)
    displayValue = `${start}...${end}`
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        color: 'var(--text-primary)',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: '2px 6px',
        borderRadius: 'var(--radius-xs)',
        border: '1px solid var(--border-subtle)',
      }}
      title={value}
    >
      {prefix && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{prefix}:</span>}
      <span style={{ letterSpacing: '-0.02em' }}>{displayValue}</span>
      {showCopy && <CopyButton value={value} label={`Copy ${value}`} size={13} />}
    </span>
  )
}
