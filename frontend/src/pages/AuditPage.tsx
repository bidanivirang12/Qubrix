import React, { useState } from 'react'
import { Lock, Search } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/common/Badge'
import { DataTable } from '../components/common/DataTable'
import type { Column } from '../components/common/DataTable'
import { useAuth } from '../context/AuthContext'
import { contractStore } from '../services/contractStore'
import type { AuditRecord } from '../types/audit'

interface AuditPageProps {
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
}

export const AuditPage: React.FC<AuditPageProps> = ({ executionMode }) => {
  const { principal, canReadAudit } = useAuth()
  const [audits] = useState<AuditRecord[]>(contractStore.getAudits())
  const [searchQuery, setSearchQuery] = useState('')

  if (!canReadAudit) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        <PageHeader
          title="Tenant Audit Trail (Tamper-Evident)"
          subtitle="Redacted immutable record of tenant security operations and key lifecycle transitions."
          breadcrumb="Compliance / Audit Trail"
        />
        <div style={{ padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              maxWidth: '500px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <Lock size={32} style={{ color: 'var(--amber-500)' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Access Restricted: Audit Log</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Your current role (<strong style={{ color: 'var(--text-primary)' }}>{principal.roles.join(', ')}</strong>) lacks the <code style={{ color: 'var(--text-primary)' }}>audit:read</code> authorization scope. Audit logs are restricted to identities holding the <strong style={{ color: 'var(--text-primary)' }}>ADMIN</strong> or <strong style={{ color: 'var(--text-primary)' }}>AUDITOR</strong> role ceiling.
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Use the top-right identity switcher to simulate an Auditor or Administrator persona.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const filteredAudits = audits.filter(
    (a) =>
      a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.actor_subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.target_ref.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const columns: Column<AuditRecord>[] = [
    {
      key: 'occurred_at',
      header: 'Timestamp (UTC)',
      width: '180px',
      sortable: true,
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {row.occurred_at.replace('T', ' ').slice(0, 19)}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Audit Action',
      width: '220px',
      sortable: true,
      render: (row) => (
        <Badge variant={row.action.includes('REVOKED') || row.action.includes('DISABLED') ? 'invalid' : row.action.includes('RESOLVED') ? 'valid' : 'neutral'}>
          {row.action}
        </Badge>
      ),
    },
    {
      key: 'actor_subject',
      header: 'Actor Principal (Attribution)',
      sortable: true,
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
          {row.actor_subject}
        </span>
      ),
    },
    {
      key: 'target_ref',
      header: 'Target Reference',
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
          {row.target_ref}
        </span>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="Tenant Audit Trail (Tamper-Evident)"
        subtitle="Redacted immutable record of tenant security operations, key lifecycle transitions, and analyst decision overrides."
        breadcrumb="Compliance / Audit Records"
        badgeText={executionMode === 'DIRECT_LIVE' ? 'Live API Proxy: /api/v1/audit-records' : 'Contract Mode: ADR-0005'}
        badgeVariant={executionMode === 'DIRECT_LIVE' ? 'valid' : 'info'}
      />

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '360px', width: '100%' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by action, actor, or target..."
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '6px 10px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Showing {filteredAudits.length} of {audits.length} events
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredAudits}
          keyExtractor={(row) => row.id}
          emptyMessage="No audit records match your query."
        />
      </div>
    </div>
  )
}
