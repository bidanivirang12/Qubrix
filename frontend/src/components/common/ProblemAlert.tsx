import React from 'react'
import { AlertCircle } from 'lucide-react'
import type { ProblemDetails } from '../../types/problem'
import { CopyButton } from './CopyButton'

interface ProblemAlertProps {
  problem: ProblemDetails
  onRetry?: () => void
}

export const ProblemAlert: React.FC<ProblemAlertProps> = ({ problem, onRetry }) => {
  return (
    <div
      role="alert"
      style={{
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        border: '1px solid var(--crimson-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--crimson-500)', display: 'inline-flex' }}>
            <AlertCircle size={18} />
          </span>
          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--crimson-500)' }}>
            RFC 9457 Problem: {problem.title} (HTTP {problem.status})
          </span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              fontSize: '12px',
              padding: '4px 8px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
            }}
          >
            Retry Probe
          </button>
        )}
      </div>

      <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
        {problem.detail}
      </p>

      {/* Technical Metadata */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(239, 68, 68, 0.15)',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Code: </span>
          <span style={{ color: 'var(--crimson-500)', fontWeight: 600 }}>{problem.code}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text-muted)' }}>Request ID: </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            {problem.request_id.slice(0, 18)}...
            <CopyButton value={problem.request_id} label="Copy Request ID" size={12} />
          </span>
        </div>
        {problem.instance && (
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Instance: </span>
            <span style={{ color: 'var(--text-secondary)' }}>{problem.instance}</span>
          </div>
        )}
      </div>
    </div>
  )
}
