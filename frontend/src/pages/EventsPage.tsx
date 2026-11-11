import React, { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/common/Badge'
import { DataTable } from '../components/common/DataTable'
import type { Column } from '../components/common/DataTable'
import { Drawer } from '../components/common/Drawer'
import { CryptoIdentifier } from '../components/common/CryptoIdentifier'
import { contractStore } from '../services/contractStore'
import type { EventRecord } from '../types/events'

interface EventsPageProps {
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
}

export const EventsPage: React.FC<EventsPageProps> = ({ executionMode }) => {
  const [events] = useState<EventRecord[]>(contractStore.getEvents())
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null)
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterVerification, setFilterVerification] = useState<string>('ALL')

  const filteredEvents = events.filter((ev) => {
    if (filterType !== 'ALL' && ev.event_type !== filterType) return false
    if (filterVerification !== 'ALL' && ev.verification_status !== filterVerification) return false
    return true
  })

  const getCanonicalJcsPayload = (ev: EventRecord) => {
    // Exact schema specified in docs/api-contracts.md lines 81-95
    return {
      protocol_version: 'qubrix-event-signature-v1',
      schema_version: 1,
      organization_id: ev.organization_id,
      event_id: ev.event_id,
      event_type: ev.event_type,
      occurred_at: ev.occurred_at,
      nonce: ev.nonce || null,
      subject_ref: ev.subject_ref || null,
      payload_digest: ev.payload_digest || null,
      attributes: ev.attributes,
      key_id: ev.signature?.key_id || null,
      algorithm: ev.signature?.algorithm || null,
    }
  }

  const columns: Column<EventRecord>[] = [
    {
      key: 'event_id',
      header: 'Event ID (UUID)',
      sortable: true,
      render: (row) => <CryptoIdentifier value={row.event_id} truncateLength={8} />,
    },
    {
      key: 'event_type',
      header: 'Event Type',
      width: '210px',
      sortable: true,
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600 }}>
          {row.event_type}
        </span>
      ),
    },
    {
      key: 'verification_status',
      header: 'Signature Verification',
      width: '180px',
      sortable: true,
      render: (row) => {
        let variant: 'valid' | 'invalid' | 'warning' = 'valid'
        if (row.verification_status !== 'VALID') variant = 'invalid'
        return (
          <Badge variant={variant}>
            {row.verification_status}
            {row.verification_reason ? ` (${row.verification_reason})` : ''}
          </Badge>
        )
      },
    },
    {
      key: 'risk_decision',
      header: 'Trust Score / Decision',
      width: '160px',
      sortable: true,
      render: (row) => {
        const variant =
          row.risk_decision === 'APPROVE'
            ? 'valid'
            : row.risk_decision === 'VERIFY'
            ? 'warning'
            : 'critical'
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px' }}>
              {row.risk_score}
            </span>
            <Badge variant={variant}>{row.risk_decision}</Badge>
          </div>
        )
      },
    },
    {
      key: 'actor_subject',
      header: 'Actor Subject',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
          {row.actor_subject}
        </span>
      ),
    },
    {
      key: 'occurred_at',
      header: 'Occurred (UTC)',
      width: '150px',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {row.occurred_at.replace('T', ' ').slice(0, 19)}
        </span>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="Ingested Events &amp; Canonical JCS Inspector"
        subtitle="Immutable ledger of accepted business events, nonces, canonical JCS payloads (RFC 8785), and cryptographic verification outcomes."
        breadcrumb="Cryptographic Security / Events & Ingestion"
        badgeText={executionMode === 'DIRECT_LIVE' ? 'Live API Proxy: /api/v1/events' : 'Contract Mode: ADR-0010'}
        badgeVariant={executionMode === 'DIRECT_LIVE' ? 'valid' : 'info'}
      />

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Event Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '4px 8px',
              }}
            >
              <option value="ALL">All Event Types</option>
              <option value="TRANSACTION_ATTEMPT">TRANSACTION_ATTEMPT</option>
              <option value="LOGIN_ATTEMPT">LOGIN_ATTEMPT</option>
              <option value="SIGNED_MESSAGE_RECEIVED">SIGNED_MESSAGE_RECEIVED</option>
              <option value="KEY_LIFECYCLE_CHANGE">KEY_LIFECYCLE_CHANGE</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verification:</span>
            <select
              value={filterVerification}
              onChange={(e) => setFilterVerification(e.target.value)}
              style={{
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '4px 8px',
              }}
            >
              <option value="ALL">All Outcomes</option>
              <option value="VALID">VALID (Verified)</option>
              <option value="INVALID">INVALID (Failed/Revoked)</option>
              <option value="UNKNOWN_KEY">UNKNOWN_KEY</option>
              <option value="MALFORMED_INPUT">MALFORMED_INPUT</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredEvents}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setSelectedEvent(row)}
          selectedRowKey={selectedEvent?.id}
          emptyMessage="No events found matching the criteria."
        />
      </div>

      {/* Event Details Drawer */}
      <Drawer
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.event_type || 'Event Details'}
        subtitle={`UUID: ${selectedEvent?.event_id}`}
        width="620px"
      >
        {selectedEvent && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '13px' }}>
            {/* Top metadata grid */}
            <div
              style={{
                backgroundColor: 'var(--surface-main)',
                padding: '14px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Verification Status
                </span>
                <div style={{ marginTop: '2px' }}>
                  <Badge variant={selectedEvent.verification_status === 'VALID' ? 'valid' : 'invalid'}>
                    {selectedEvent.verification_status}
                  </Badge>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Trust Decision
                </span>
                <div style={{ marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                    {selectedEvent.risk_score}/100
                  </span>
                  <Badge variant={selectedEvent.risk_decision === 'APPROVE' ? 'valid' : selectedEvent.risk_decision === 'VERIFY' ? 'warning' : 'critical'}>
                    {selectedEvent.risk_decision}
                  </Badge>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Actor Subject
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                  {selectedEvent.actor_subject}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Nonce (Base64url)
                </span>
                <div>
                  {selectedEvent.nonce ? (
                    <CryptoIdentifier value={selectedEvent.nonce} truncateLength={8} />
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>None (Unsigned event)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Signature Envelope */}
            {selectedEvent.signature && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Signature Envelope (qubrix-event-signature-v1)
                </span>
                <div
                  style={{
                    backgroundColor: 'var(--surface-nav)',
                    padding: '12px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-default)',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div>Algorithm: <span style={{ color: 'var(--emerald-500)', fontWeight: 600 }}>{selectedEvent.signature.algorithm}</span></div>
                  <div>Key ID: <span style={{ color: 'var(--text-primary)' }}>{selectedEvent.signature.key_id}</span></div>
                  <div style={{ wordBreak: 'break-all' }}>Value: <span style={{ color: 'var(--text-muted)' }}>{selectedEvent.signature.value}</span></div>
                </div>
              </div>
            )}

            {/* Canonical JCS Representation (RFC 8785) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Canonical JSON Object (RFC 8785 / ADR-0010)
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  UTF-8 Canonicalized Bytes
                </span>
              </div>
              <pre
                style={{
                  backgroundColor: 'var(--surface-nav)',
                  padding: '12px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-default)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  maxHeight: '220px',
                }}
              >
                {JSON.stringify(getCanonicalJcsPayload(selectedEvent), null, 2)}
              </pre>
            </div>

            {/* Typed Attributes JSON */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Event Attributes ({selectedEvent.event_type})
              </span>
              <pre
                style={{
                  backgroundColor: 'var(--surface-nav)',
                  padding: '12px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-default)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--emerald-500)',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(selectedEvent.attributes, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
