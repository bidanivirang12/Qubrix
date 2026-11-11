import React, { useState } from 'react'
import { Eye, CheckCheck } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { DataTable } from '../components/common/DataTable'
import type { Column } from '../components/common/DataTable'
import { Drawer } from '../components/common/Drawer'
import { Modal } from '../components/common/Modal'
import { CryptoIdentifier } from '../components/common/CryptoIdentifier'
import { ProblemAlert } from '../components/common/ProblemAlert'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { contractStore } from '../services/contractStore'
import { apiRequest, ProblemError } from '../services/api'
import type { Finding } from '../types/findings'
import type { ProblemDetails } from '../types/problem'

interface FindingsPageProps {
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
  selectedFindingId?: string | null
}

export const FindingsPage: React.FC<FindingsPageProps> = ({
  executionMode,
  selectedFindingId,
}) => {
  const { principal, canChangeFindingStatus } = useAuth()
  const { showToast } = useToast()

  const [findings, setFindings] = useState<Finding[]>(contractStore.getFindings())
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(
    selectedFindingId ? contractStore.getFindings().find((f) => f.id === selectedFindingId) || null : null
  )
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL')
  const [filterStatus, setFilterStatus] = useState<string>('ALL')

  const [resolveModalFinding, setResolveModalFinding] = useState<Finding | null>(null)
  const [resolutionRationale, setResolutionRationale] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<ProblemDetails | null>(null)

  const filteredFindings = findings.filter((f) => {
    if (filterSeverity !== 'ALL' && f.severity !== filterSeverity) return false
    if (filterStatus !== 'ALL' && f.status !== filterStatus) return false
    return true
  })

  const handleAcknowledge = async (finding: Finding) => {
    if (!canChangeFindingStatus) {
      showToast('Permission denied: ADMIN or SECURITY_ANALYST role with findings:write required', 'error')
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    if (executionMode === 'DIRECT_LIVE') {
      try {
        await apiRequest(`/api/v1/findings/${finding.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            schema_version: 1,
            correlation_id: crypto.randomUUID(),
            status: 'ACKNOWLEDGED',
            reason: 'Triage acknowledged by analyst',
          }),
        })
        showToast(`Finding ${finding.id} acknowledged live`, 'success')
      } catch (err: unknown) {
        if (err instanceof ProblemError) {
          setApiError(err.problem)
        } else {
          showToast('Failed to acknowledge finding on live backend', 'error')
        }
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setTimeout(() => {
        try {
          const updated = contractStore.updateFindingStatus(
            finding.id,
            'ACKNOWLEDGED',
            'Acknowledged in triage',
            principal.subject
          )
          setFindings(contractStore.getFindings())
          setSelectedFinding(updated)
          showToast(`Finding ${finding.id} marked ACKNOWLEDGED`, 'success')
        } catch (err: any) {
          showToast(err.message, 'error')
        } finally {
          setIsSubmitting(false)
        }
      }, 350)
    }
  }

  const handleResolveSubmit = async () => {
    if (!resolveModalFinding) return
    if (!resolutionRationale.trim()) {
      showToast('Resolution rationale is required by API contract', 'error')
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    if (executionMode === 'DIRECT_LIVE') {
      try {
        await apiRequest(`/api/v1/findings/${resolveModalFinding.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            schema_version: 1,
            correlation_id: crypto.randomUUID(),
            status: 'RESOLVED',
            reason: resolutionRationale,
          }),
        })
        showToast(`Finding ${resolveModalFinding.id} resolved live`, 'success')
        setResolveModalFinding(null)
      } catch (err: unknown) {
        if (err instanceof ProblemError) {
          setApiError(err.problem)
        } else {
          showToast('Failed to resolve finding on live backend', 'error')
        }
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setTimeout(() => {
        try {
          const updated = contractStore.updateFindingStatus(
            resolveModalFinding.id,
            'RESOLVED',
            resolutionRationale,
            principal.subject
          )
          setFindings(contractStore.getFindings())
          setSelectedFinding(updated)
          setResolveModalFinding(null)
          setResolutionRationale('')
          showToast(`Finding ${resolveModalFinding.id} marked RESOLVED`, 'success')
        } catch (err: any) {
          showToast(err.message, 'error')
        } finally {
          setIsSubmitting(false)
        }
      }, 400)
    }
  }

  const columns: Column<Finding>[] = [
    {
      key: 'severity',
      header: 'Severity',
      width: '110px',
      sortable: true,
      render: (row) => {
        let variant: 'critical' | 'high' | 'medium' | 'low' = 'low'
        if (row.severity === 'CRITICAL') variant = 'critical'
        else if (row.severity === 'HIGH') variant = 'high'
        else if (row.severity === 'MEDIUM') variant = 'medium'
        return <Badge variant={variant}>{row.severity}</Badge>
      },
    },
    {
      key: 'kind',
      header: 'Finding Kind',
      width: '180px',
      sortable: true,
      render: (row) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600 }}>
          {row.kind}
        </span>
      ),
    },
    {
      key: 'summary',
      header: 'Investigative Summary & Evidence',
      render: (row) => (
        <div style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: 1.4 }}>
          {row.summary}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '130px',
      sortable: true,
      render: (row) => {
        let variant: 'warning' | 'neutral' | 'valid' = 'neutral'
        if (row.status === 'OPEN') variant = 'warning'
        else if (row.status === 'RESOLVED') variant = 'valid'
        return <Badge variant={variant}>{row.status}</Badge>
      },
    },
    {
      key: 'created_at',
      header: 'Detected',
      width: '140px',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {row.created_at.replace('T', ' ').slice(0, 19)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      width: '100px',
      align: 'right',
      render: () => (
        <span style={{ color: 'var(--emerald-500)', fontSize: '12px', fontWeight: 600 }}>
          Inspect →
        </span>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="Security Findings &amp; Threat Investigations"
        subtitle="Primary investigative interface for cryptographic replay attacks, revoked key usage, anomalous velocity, and protocol infractions."
        breadcrumb="Operations / Security Findings"
        badgeText={executionMode === 'DIRECT_LIVE' ? 'Live API Proxy: /api/v1/findings' : 'Contract Mode: ADR-0004'}
        badgeVariant={executionMode === 'DIRECT_LIVE' ? 'valid' : 'info'}
      />

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {apiError && <ProblemAlert problem={apiError} />}

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Severity:</span>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '4px 8px',
                }}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '4px 8px',
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="OPEN">OPEN</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="RESOLVED">RESOLVED</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Showing {filteredFindings.length} of {findings.length} findings
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredFindings}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setSelectedFinding(row)}
          selectedRowKey={selectedFinding?.id}
          emptyMessage="No findings match the selected severity and status filters."
        />
      </div>

      {/* Finding Detail & Action Drawer */}
      <Drawer
        isOpen={selectedFinding !== null}
        onClose={() => setSelectedFinding(null)}
        title={`Finding: ${selectedFinding?.kind}`}
        subtitle={`ID: ${selectedFinding?.id}`}
        width="560px"
        footer={
          selectedFinding && selectedFinding.status !== 'RESOLVED' ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedFinding.status === 'OPEN' && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Eye size={13} />}
                  onClick={() => handleAcknowledge(selectedFinding)}
                  isLoading={isSubmitting}
                  disabled={!canChangeFindingStatus}
                  title={!canChangeFindingStatus ? 'Requires ADMIN or SECURITY_ANALYST role' : undefined}
                >
                  Acknowledge
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                icon={<CheckCheck size={13} />}
                onClick={() => setResolveModalFinding(selectedFinding)}
                disabled={!canChangeFindingStatus}
                title={!canChangeFindingStatus ? 'Requires ADMIN or SECURITY_ANALYST role' : undefined}
              >
                Resolve Finding
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedFinding && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Badge variant={selectedFinding.severity === 'CRITICAL' ? 'critical' : selectedFinding.severity === 'HIGH' ? 'high' : 'medium'}>
                {selectedFinding.severity} SEVERITY
              </Badge>
              <Badge variant={selectedFinding.status === 'OPEN' ? 'warning' : 'valid'}>
                {selectedFinding.status}
              </Badge>
            </div>

            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Summary &amp; Attack Vector
              </div>
              <p style={{ marginTop: '4px', fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {selectedFinding.summary}
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface-main)',
                padding: '12px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Reason Code
                </span>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: '2px' }}>
                  {selectedFinding.reason_code || 'SECURITY_POLICY_VIOLATION'}
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Associated Event UUID
                </span>
                <div style={{ marginTop: '2px' }}>
                  {selectedFinding.event_id ? (
                    <CryptoIdentifier value={selectedFinding.event_id} truncateLength={6} />
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Direct Provider Finding</span>
                  )}
                </div>
              </div>

              {selectedFinding.acknowledged_by && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Acknowledged By
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    {selectedFinding.acknowledged_by}
                  </div>
                </div>
              )}

              {selectedFinding.resolved_by && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Resolved By
                  </span>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                    {selectedFinding.resolved_by}
                  </div>
                </div>
              )}
            </div>

            {selectedFinding.resolution_rationale && (
              <div
                style={{
                  backgroundColor: 'rgba(34, 197, 94, 0.06)',
                  border: '1px solid var(--emerald-border)',
                  padding: '12px',
                  borderRadius: 'var(--radius-xs)',
                }}
              >
                <div style={{ color: 'var(--emerald-500)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                  Resolution Rationale (Audit Evidence)
                </div>
                <div style={{ marginTop: '4px', color: 'var(--text-primary)' }}>
                  {selectedFinding.resolution_rationale}
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Remediation Recommendations
              </div>
              <ul style={{ paddingLeft: '18px', marginTop: '6px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {selectedFinding.kind === 'REPLAY_DETECTED' && (
                  <>
                    <li>Verify upstream client client-side clock and nonce generation entropy.</li>
                    <li>Ensure idempotency keys are not reused across distinct payload digests.</li>
                    <li>Review edge network logs for potential Man-in-the-Middle (MitM) replay attempts.</li>
                  </>
                )}
                {selectedFinding.kind === 'KEY_REVOKED' && (
                  <>
                    <li>Block client IP or service identity attempting to sign with revoked key material.</li>
                    <li>Check key lifecycle registry for recent emergency rotations.</li>
                    <li>Update client SDK configuration with current active key reference.</li>
                  </>
                )}
                {selectedFinding.kind === 'HIGH_RISK_ANOMALY' && (
                  <>
                    <li>Enforce mandatory Multi-Factor Authentication (MFA) challenge for user account.</li>
                    <li>Inspect device fingerprint and geographical origin in TrustShield assessment.</li>
                  </>
                )}
                {selectedFinding.kind === 'UNKNOWN_KEY' && (
                  <>
                    <li>Verify tenant key provisioning state in KMS or HSM partition.</li>
                    <li>Ensure key reference ID is correctly formatted and registered in Qubrix.</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        )}
      </Drawer>

      {/* Resolve Finding Rationale Dialog */}
      <Modal
        isOpen={resolveModalFinding !== null}
        onClose={() => setResolveModalFinding(null)}
        title="Resolve Security Finding"
        subtitle={`Target: ${resolveModalFinding?.kind} (${resolveModalFinding?.id})`}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={() => setResolveModalFinding(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleResolveSubmit}
              isLoading={isSubmitting}
            >
              Commit Resolution
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            Resolving a security finding requires an explicit non-sensitive technical rationale for tenant audit compliance.
          </p>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                marginBottom: '4px',
                textTransform: 'uppercase',
              }}
            >
              Resolution Rationale *
            </label>
            <textarea
              rows={3}
              value={resolutionRationale}
              onChange={(e) => setResolutionRationale(e.target.value)}
              placeholder="e.g. Verified client SDK configuration was updated to current active key; no unauthorized egress detected."
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-nav)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                padding: '8px',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>

          <p style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
            This resolution is immutable and committed with your actor subject (<code style={{ color: 'var(--text-secondary)' }}>{principal.subject}</code>).
          </p>
        </div>
      </Modal>
    </div>
  )
}
