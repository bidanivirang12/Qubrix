import { buildMockToken } from '../services/mockToken'
import React, { useState } from 'react'
import {
  Send,
  Shield,
  UserCheck,
  Terminal,
} from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { CryptoIdentifier } from '../components/common/CryptoIdentifier'
import { ProblemAlert } from '../components/common/ProblemAlert'
import { MOCK_AUTH_ENABLED, useAuth, PREDEFINED_IDENTITIES } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { fetchWhoami, ProblemError } from '../services/api'
import type { WhoamiResponse } from '../types/auth'
import type { ProblemDetails } from '../types/problem'

export const WhoamiPage: React.FC = () => {
  const { principal, token, activeRole, switchIdentity } = useAuth()
  const { showToast } = useToast()

  const [inputToken, setInputToken] = useState(token)
  const [liveResponse, setLiveResponse] = useState<WhoamiResponse | null>(null)
  const [liveRequestId, setLiveRequestId] = useState<string | null>(null)
  const [apiError, setApiError] = useState<ProblemDetails | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleTestLiveEndpoint = async (tokenToSend?: string) => {
    setIsLoading(true)
    setApiError(null)
    setLiveResponse(null)
    setLiveRequestId(null)

    const tok = tokenToSend !== undefined ? tokenToSend : inputToken

    try {
      const result = await fetchWhoami(tok)
      setLiveResponse(result.data)
      setLiveRequestId(result.requestId)
      showToast('Live /api/v1/whoami call succeeded', 'success')
    } catch (err: unknown) {
      if (err instanceof ProblemError) {
        setApiError(err.problem)
      } else {
        showToast('Live backend unreachable at /api/v1/whoami', 'error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Permission Ceiling Matrix from docs/api-contracts.md lines 171-177
  const permissionMatrix = [
    { operation: 'Read events / findings / assessments', admin: true, analyst: true, auditor: true, service: false },
    { operation: 'Read keys / inventory / CBOM / audit', admin: true, analyst: true, auditor: true, service: false },
    { operation: 'Manage keys (rotate/disable)', admin: true, analyst: false, auditor: false, service: false },
    { operation: 'Event Ingestion (POST /events)', admin: false, analyst: false, auditor: false, service: true },
    { operation: 'Crypto Verify (POST /crypto/verify)', admin: false, analyst: false, auditor: false, service: true },
    { operation: 'Crypto Encrypt (POST /crypto/encrypt)', admin: false, analyst: false, auditor: false, service: true },
    { operation: 'Crypto Decrypt (POST /crypto/decrypt)', admin: false, analyst: false, auditor: false, service: 'Explicit IdP Only' },
    { operation: 'Write CBOM (POST /cboms)', admin: true, analyst: true, auditor: false, service: false },
    { operation: 'Generate CBOM (POST /cboms/generate)', admin: true, analyst: true, auditor: false, service: false },
    { operation: 'Finding Status (PATCH /findings)', admin: true, analyst: true, auditor: false, service: false },
    { operation: 'Analyst Review & Decision Override', admin: false, analyst: true, auditor: false, service: false },
    { operation: 'Whoami (GET /api/v1/whoami)', admin: true, analyst: true, auditor: true, service: true },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="OIDC Identity, Claims &amp; Whoami Live Probe"
        subtitle="Live verification of caller principal, tenant organization mapping, and strict role/scope authorization ceilings against GET /api/v1/whoami."
        breadcrumb="Identity & Access / Whoami"
        badgeText="Backend Endpoint Active (Phase 3a)"
        badgeVariant="valid"
      />

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Live Whoami Test Box */}
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
              <Terminal size={17} style={{ color: 'var(--emerald-500)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Live Probe: GET /api/v1/whoami
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleTestLiveEndpoint('')}
                isLoading={isLoading}
                title="Send request without Authorization header to verify 401 unauthenticated response"
              >
                Test Missing Header (401)
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Send size={13} />}
                onClick={() => handleTestLiveEndpoint()}
                isLoading={isLoading}
              >
                Send Authorized Request
              </Button>
            </div>
          </div>

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
              Bearer Token (Authorization: Bearer &lt;token&gt;)
            </label>
            <textarea
              rows={2}
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-nav)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                padding: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
          </div>

          {/* Result or Error */}
          {apiError && <ProblemAlert problem={apiError} onRetry={() => handleTestLiveEndpoint()} />}

          {liveResponse && (
            <div
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                border: '1px solid var(--emerald-border)',
                borderRadius: 'var(--radius-xs)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--emerald-500)' }}>
                  HTTP 200 OK — Caller Principal Validated
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Request ID: {liveRequestId}
                </span>
              </div>
              <pre
                style={{
                  backgroundColor: 'var(--surface-nav)',
                  padding: '10px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-default)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                }}
              >
                {JSON.stringify(liveResponse, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Current Active Persona & Token Claims Breakdown */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Active Principal Context */}
          <div
            style={{
              backgroundColor: 'var(--surface-main)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} style={{ color: 'var(--emerald-500)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Active Principal Identity</h3>
              </div>
              <Badge variant="valid">{activeRole}</Badge>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Subject (`sub`): </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{principal.subject}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Tenant (`organization_id`): </span>
                <CryptoIdentifier value={principal.organization_id} truncateLength={10} />
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Roles: </span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--emerald-500)', fontWeight: 600 }}>
                  {principal.roles.join(', ')}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Granted OAuth Scopes: </span>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {principal.scopes.map((s) => (
                    <span
                      key={s}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        backgroundColor: 'var(--surface-elevated)',
                        padding: '2px 5px',
                        borderRadius: '2px',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Persona Switcher for Security Testing */}
          {MOCK_AUTH_ENABLED && <div
            style={{
              backgroundColor: 'var(--surface-main)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={16} style={{ color: 'var(--sky-500)' }} />
              <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Switch Testing Persona</h3>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Evaluate how the interface and live API enforce role ceilings and permission matrices across different enterprise roles.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {Object.entries(PREDEFINED_IDENTITIES).map(([roleKey, ident]) => {
                const isSelected = activeRole === roleKey
                return (
                  <button
                    key={roleKey}
                    onClick={() => {
                      switchIdentity(roleKey as any)
                      setInputToken(buildMockToken(ident.principal))
                      showToast(`Switched persona to ${ident.name}`, 'info')
                    }}
                    style={{
                      padding: '8px 10px',
                      backgroundColor: isSelected ? 'var(--surface-active)' : 'var(--surface-elevated)',
                      border: isSelected ? '1px solid var(--emerald-500)' : '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-xs)',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600, color: isSelected ? 'var(--emerald-500)' : 'var(--text-primary)' }}>
                      {ident.name}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {roleKey}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>}
        </div>

        {/* Permission Ceiling Matrix */}
        <div
          style={{
            backgroundColor: 'var(--surface-main)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-default)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Role Ceiling &amp; Permission Matrix (ADR-0002)</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Enforced server-side via JWT claims and OAuth scopes. Both role membership and named scope are required.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-nav)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', color: 'var(--text-secondary)' }}>Operation</th>
                  <th style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>ADMIN</th>
                  <th style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>SECURITY_ANALYST</th>
                  <th style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>AUDITOR</th>
                  <th style={{ padding: '8px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>SERVICE</th>
                </tr>
              </thead>
              <tbody>
                {permissionMatrix.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 16px', fontWeight: 500 }}>{item.operation}</td>
                    <td style={{ padding: '8px 16px', textAlign: 'center', color: item.admin ? 'var(--emerald-500)' : 'var(--text-muted)' }}>
                      {item.admin ? 'Yes' : 'No'}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'center', color: item.analyst ? 'var(--emerald-500)' : 'var(--text-muted)' }}>
                      {item.analyst ? 'Yes' : 'No'}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'center', color: item.auditor ? 'var(--emerald-500)' : 'var(--text-muted)' }}>
                      {item.auditor ? 'Yes' : 'No'}
                    </td>
                    <td style={{ padding: '8px 16px', textAlign: 'center', color: typeof item.service === 'string' ? 'var(--sky-500)' : item.service ? 'var(--emerald-500)' : 'var(--text-muted)' }}>
                      {typeof item.service === 'string' ? item.service : item.service ? 'Yes' : 'No'}
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
