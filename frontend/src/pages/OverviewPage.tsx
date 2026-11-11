import React from 'react'
import {
  ShieldAlert,
  Cpu,
  ArrowRight,
  Server,
  FileText,
  Key,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { ProblemAlert } from '../components/common/ProblemAlert'
import { useBackend } from '../context/BackendContext'
import { contractStore } from '../services/contractStore'

interface OverviewPageProps {
  onNavigate: (route: string) => void
  onSelectFinding: (findingId: string) => void
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  onNavigate,
  onSelectFinding,
}) => {
  const { health, refreshHealth } = useBackend()
  const findings = contractStore.getFindings()
  const keys = contractStore.getKeys()
  const inventory = contractStore.getInventory()
  const events = contractStore.getEvents()

  const criticalAndHighFindings = findings.filter(
    (f) => (f.severity === 'CRITICAL' || f.severity === 'HIGH') && f.status !== 'RESOLVED'
  )

  const pqcReadyCount = inventory.filter((i) => i.pqc_readiness === 'POST_QUANTUM_READY').length
  const transitioningCount = inventory.filter((i) => i.pqc_readiness === 'TRANSITIONING').length
  const classicalCount = inventory.filter((i) => i.pqc_readiness === 'CLASSICAL_VULNERABLE').length

  const validVerifications = events.filter((e) => e.verification_status === 'VALID').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="Cryptographic Posture & Operational Awareness"
        subtitle="Real-time security telemetry, cryptographic asset readiness, and active threat findings."
        breadcrumb="Operations / Posture Overview"
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={<FileText size={14} />}
              onClick={() => onNavigate('inventory')}
            >
              Inspect CBOM
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<ShieldAlert size={14} />}
              onClick={() => onNavigate('findings')}
            >
              Investigate Findings ({criticalAndHighFindings.length})
            </Button>
          </div>
        }
      />

      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Backend Heartbeat Banner */}
        {health.readyError ? (
          <ProblemAlert problem={health.readyError} onRetry={refreshHealth} />
        ) : !health.isLive ? (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid var(--crimson-border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Server size={18} style={{ color: 'var(--crimson-500)' }} />
              <div>
                <span style={{ fontWeight: 600, color: 'var(--crimson-500)' }}>
                  Local FastAPI Backend Not Detected on localhost:8000
                </span>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                  The frontend is currently operating with validated tenant contract state. Start the backend with{' '}
                  <code style={{ color: 'var(--text-primary)' }}>uv run uvicorn app.main:app</code> to test live endpoints.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={refreshHealth}>
              Probe Connection
            </Button>
          </div>
        ) : (
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid var(--emerald-border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--emerald-500)',
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--emerald-500)' }}>
                FastAPI Gateway Connected
              </span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Liveness: 200 OK | Latency: {health.latencyMs}ms | Request ID: {health.liveRequestId?.slice(0, 8)}...
              </span>
            </div>
            <button
              onClick={() => onNavigate('whoami')}
              style={{
                color: 'var(--emerald-500)',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
              }}
            >
              Test JWT Whoami →
            </button>
          </div>
        )}

        {/* Tactical Posture Split: Left Panel (PQC & Algorithm Posture) | Right Panel (Key Lifecycle) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Cryptographic Bill of Materials & PQC Readiness */}
          <div
            style={{
              backgroundColor: 'var(--surface-main)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} style={{ color: 'var(--purple-500)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Post-Quantum Cryptography (PQC) Readiness
                </h3>
              </div>
              <button
                onClick={() => onNavigate('inventory')}
                style={{ fontSize: '11px', color: 'var(--purple-500)', fontFamily: 'var(--font-mono)' }}
              >
                View Inventory →
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Tracking algorithmic vulnerability to Shor’s and Grover’s algorithms under NIST FIPS 203 (ML-KEM) &amp; FIPS 204 (ML-DSA) standards.
            </p>

            {/* PQC Progress Bar */}
            <div>
              <div
                style={{
                  height: '8px',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--surface-elevated)',
                  display: 'flex',
                  overflow: 'hidden',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{
                    width: `${(pqcReadyCount / inventory.length) * 100}%`,
                    backgroundColor: 'var(--purple-500)',
                  }}
                  title={`Post-Quantum Ready: ${pqcReadyCount}`}
                />
                <div
                  style={{
                    width: `${(transitioningCount / inventory.length) * 100}%`,
                    backgroundColor: 'var(--sky-500)',
                  }}
                  title={`Transitioning: ${transitioningCount}`}
                />
                <div
                  style={{
                    width: `${(classicalCount / inventory.length) * 100}%`,
                    backgroundColor: 'var(--amber-500)',
                  }}
                  title={`Classical Vulnerable: ${classicalCount}`}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '10px',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--purple-500)', borderRadius: '2px' }} />
                  <span>{pqcReadyCount} PQC Ready</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--sky-500)', borderRadius: '2px' }} />
                  <span>{transitioningCount} Transitioning</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--amber-500)', borderRadius: '2px' }} />
                  <span>{classicalCount} Classical</span>
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface-elevated)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-subtle)',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Latest CBOM Snapshot:</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                CBOM-20261014-001 (6 primitives)
              </span>
            </div>
          </div>

          {/* Key Registry & Verification Integrity */}
          <div
            style={{
              backgroundColor: 'var(--surface-main)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={16} style={{ color: 'var(--emerald-500)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Tenant Key Registry &amp; Signature Ingestion
                </h3>
              </div>
              <button
                onClick={() => onNavigate('keys')}
                style={{ fontSize: '11px', color: 'var(--emerald-500)', fontFamily: 'var(--font-mono)' }}
              >
                Manage Keys →
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Strict v1 signature allowlist: ED25519, ECDSA P-256 (SHA-256 DER), and RSA-PSS (SHA-256 3072+ bits).
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--emerald-500)' }}>
                  {keys.filter((k) => k.lifecycle === 'ACTIVE').length}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                  Active Keys
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--crimson-500)' }}>
                  {keys.filter((k) => k.lifecycle === 'REVOKED' || k.lifecycle === 'DISABLED').length}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                  Revoked / Off
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--sky-500)' }}>
                  {validVerifications} / {events.length}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                  Valid Signatures
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                padding: '8px 10px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--amber-border)',
              }}
            >
              <strong style={{ color: 'var(--amber-500)' }}>Hard Invariant:</strong> Revoked keys force an immediate non-VALID verification outcome and persist an attributable security finding.
            </div>
          </div>
        </div>

        {/* Priority Security Findings Table */}
        <div
          style={{
            backgroundColor: 'var(--surface-main)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Active Prioritized Security Findings
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Unresolved security events requiring cryptographic or operational intervention.
              </p>
            </div>
            <button
              onClick={() => onNavigate('findings')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: 'var(--emerald-500)',
                fontWeight: 600,
              }}
            >
              <span>View All ({findings.length})</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-nav)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Severity
                  </th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Finding Kind
                  </th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Summary
                  </th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Status
                  </th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {criticalAndHighFindings.map((finding) => (
                  <tr
                    key={finding.id}
                    onClick={() => {
                      onSelectFinding(finding.id)
                      onNavigate('findings')
                    }}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant={finding.severity === 'CRITICAL' ? 'critical' : 'high'}>
                        {finding.severity}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      {finding.kind}
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-primary)', maxWidth: '400px' }}>
                      {finding.summary}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge variant={finding.status === 'OPEN' ? 'warning' : 'neutral'}>
                        {finding.status}
                      </Badge>
                    </td>
                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: 'var(--emerald-500)', fontWeight: 600 }}>
                        Inspect →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
