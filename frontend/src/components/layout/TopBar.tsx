import React, { useState } from 'react'
import {
  Search,
  User,
  ChevronDown,
  RefreshCw,
  Server,
  Layers,
} from 'lucide-react'
import { MOCK_AUTH_ENABLED, useAuth, PREDEFINED_IDENTITIES } from '../../context/AuthContext'
import { useBackend } from '../../context/BackendContext'
import { CopyButton } from '../common/CopyButton'

interface TopBarProps {
  onOpenCommandPalette: () => void
  onNavigate: (route: string) => void
  currentRoute: string
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
  onToggleExecutionMode: (mode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX') => void
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenCommandPalette,
  onNavigate,
  executionMode,
  currentRoute,
  onToggleExecutionMode,
}) => {
  const { principal, activeRole, switchIdentity } = useAuth()
  const { health, refreshHealth } = useBackend()
  const [isIdentityDropdownOpen, setIsIdentityDropdownOpen] = useState(false)
  const [isHealthDropdownOpen, setIsHealthDropdownOpen] = useState(false)

  return (
    <header
      style={{
        height: '48px',
        backgroundColor: 'var(--surface-nav)',
        borderBottom: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 900,
      }}
    >
      {/* Left: Brand & Organization */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {currentRoute !== 'whoami' && (
          <span aria-label="Mock data" style={{ color: 'var(--amber-500)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>
            MOCK DATA
          </span>
        )}
        <button
          onClick={() => onNavigate('overview')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-primary)',
          }}
        >
          {/* Tactical Hex Shield Logo */}
          <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
            <path
              d="M32 10 L52 21.5 V42.5 L32 54 L12 42.5 V21.5 Z"
              fill="#101211"
              stroke="#22C55E"
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <path d="M32 10 L32 32 L52 21.5" stroke="#22C55E" strokeWidth="3" />
            <path d="M32 32 L12 21.5" stroke="#22C55E" strokeWidth="3" />
            <path d="M32 32 L32 54" stroke="#22C55E" strokeWidth="3" />
            <circle cx="32" cy="32" r="5" fill="#22C55E" />
          </svg>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 700,
              fontSize: '15px',
              letterSpacing: '0.04em',
              color: 'var(--text-primary)',
            }}
          >
            QUBRIX
          </span>
          <span
            style={{
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              padding: '1px 5px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              color: 'var(--emerald-500)',
              border: '1px solid var(--emerald-border)',
              fontWeight: 600,
            }}
          >
            PHASE 3A
          </span>
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-default)' }} />

        {/* Tenant Organization Context */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-muted)' }}>Tenant Org:</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--surface-elevated)',
              padding: '2px 6px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {principal.organization_id.slice(0, 8)}...
            <CopyButton value={principal.organization_id} label="Copy Organization UUID" size={11} />
          </span>
        </div>
      </div>

      {/* Middle: Command Palette Trigger */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onOpenCommandPalette}
          aria-label="Open command palette"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px',
            backgroundColor: 'var(--surface-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            width: '240px',
            cursor: 'pointer',
          }}
        >
          <Search size={14} />
          <span style={{ flex: 1, textAlign: 'left' }}>Quick jump...</span>
          <kbd
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              padding: '1px 4px',
              backgroundColor: 'var(--surface-main)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xs)',
            }}
          >
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Execution Mode, Backend Status & Principal Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Backend Execution Mode Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--surface-main)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xs)',
            padding: '2px',
          }}
          title="Toggle execution between Direct Live FastAPI Calls and Validated Contract Sandbox"
        >
          <button
            onClick={() => onToggleExecutionMode('DIRECT_LIVE')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              borderRadius: 'var(--radius-xs)',
              color: executionMode === 'DIRECT_LIVE' ? 'var(--emerald-500)' : 'var(--text-muted)',
              backgroundColor: executionMode === 'DIRECT_LIVE' ? 'var(--surface-elevated)' : 'transparent',
              border: executionMode === 'DIRECT_LIVE' ? '1px solid var(--emerald-border)' : '1px solid transparent',
            }}
          >
            <Server size={12} />
            Live Backend
          </button>
          <button
            onClick={() => onToggleExecutionMode('CONTRACT_SANDBOX')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              borderRadius: 'var(--radius-xs)',
              color: executionMode === 'CONTRACT_SANDBOX' ? 'var(--sky-500)' : 'var(--text-muted)',
              backgroundColor: executionMode === 'CONTRACT_SANDBOX' ? 'var(--surface-elevated)' : 'transparent',
              border: executionMode === 'CONTRACT_SANDBOX' ? '1px solid var(--sky-border)' : '1px solid transparent',
            }}
          >
            <Layers size={12} />
            Contract Sandbox
          </button>
        </div>

        {/* Live Backend Health Probe Dropdown */}
        {MOCK_AUTH_ENABLED && <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsHealthDropdownOpen(!isHealthDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              backgroundColor: 'var(--surface-elevated)',
              border: `1px solid ${
                health.isLive
                  ? health.isReady
                    ? 'var(--emerald-border)'
                    : 'var(--amber-border)'
                  : 'var(--crimson-border)'
              }`,
              borderRadius: 'var(--radius-xs)',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: health.isLive
                ? health.isReady
                  ? 'var(--emerald-500)'
                  : 'var(--amber-500)'
                : 'var(--crimson-500)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: health.isLive
                  ? health.isReady
                    ? 'var(--emerald-500)'
                    : 'var(--amber-500)'
                  : 'var(--crimson-500)',
              }}
            />
            <span>
              {health.isLive
                ? health.isReady
                  ? 'BACKEND: READY'
                  : 'BACKEND: DB UNAVAIL'
                : 'BACKEND: OFFLINE'}
            </span>
            <ChevronDown size={12} />
          </button>

          {isHealthDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '320px',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-emphasis)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                padding: '12px',
                zIndex: 1000,
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '8px',
                  borderBottom: '1px solid var(--border-default)',
                  fontWeight: 600,
                }}
              >
                <span>Live Backend Diagnostics</span>
                <button
                  onClick={() => refreshHealth()}
                  style={{
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                  }}
                >
                  <RefreshCw size={11} className={health.isChecking ? 'spin' : ''} />
                  Probe
                </button>
              </div>

              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Liveness (/health/live):</span>
                  <span
                    style={{
                      color: health.isLive ? 'var(--emerald-500)' : 'var(--crimson-500)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                    }}
                  >
                    {health.isLive ? 'HTTP 200 OK' : 'FAILED'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Readiness (/health/ready):</span>
                  <span
                    style={{
                      color: health.isReady ? 'var(--emerald-500)' : 'var(--amber-500)',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                    }}
                  >
                    {health.isReady ? 'HTTP 200 READY' : 'HTTP 503 (DB Check Failed)'}
                  </span>
                </div>
                {health.latencyMs !== null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Roundtrip Latency:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{health.latencyMs} ms</span>
                  </div>
                )}
                {health.liveRequestId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Request ID:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                      {health.liveRequestId.slice(0, 14)}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>}

        {/* Identity & Role Switcher */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsIdentityDropdownOpen(!isIdentityDropdownOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
            }}
          >
            <User size={13} style={{ color: 'var(--emerald-500)' }} />
            <span style={{ fontWeight: 500 }}>{activeRole}</span>
            <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
          </button>

          {isIdentityDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                width: '280px',
                backgroundColor: 'var(--surface-elevated)',
                border: '1px solid var(--border-emphasis)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                padding: '8px',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  padding: '6px 8px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                Switch Principal Identity
              </div>
              {Object.entries(PREDEFINED_IDENTITIES).map(([roleKey, ident]) => {
                const isActive = activeRole === roleKey
                return (
                  <button
                    key={roleKey}
                    onClick={() => {
                      switchIdentity(roleKey as any)
                      setIsIdentityDropdownOpen(false)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: isActive ? 'var(--surface-active)' : 'transparent',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: isActive ? 'var(--emerald-500)' : 'var(--text-primary)',
                        }}
                      >
                        {ident.name}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {roleKey}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {ident.description}
                    </span>
                  </button>
                )
              })}

              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px solid var(--border-default)',
                }}
              >
                <button
                  onClick={() => {
                    setIsIdentityDropdownOpen(false)
                    onNavigate('whoami')
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'center',
                    padding: '6px',
                    fontSize: '11px',
                    color: 'var(--emerald-500)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  View Whoami Claims &amp; Perms →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
