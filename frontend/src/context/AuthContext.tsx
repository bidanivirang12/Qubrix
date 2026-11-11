import React, { createContext, useContext, useState, useCallback } from 'react'
import type { Principal, UserRole } from '../types/auth'
import { DEFAULT_ORG_ID } from '../services/contractStore'
import { buildMockToken } from '../services/mockToken'

export const MOCK_AUTH_ENABLED = import.meta.env.DEV
export interface PredefinedIdentity {
  name: string
  description: string
  principal: Principal
}

export const PREDEFINED_IDENTITIES: Record<string, PredefinedIdentity> = {
  SECURITY_ANALYST: {
    name: 'Security Analyst',
    description: 'Investigates findings, reviews risk assessments, initiates CBOM generation. Key management restricted.',
    principal: {
      subject: 'sub:security-analyst-1',
      organization_id: DEFAULT_ORG_ID,
      roles: ['SECURITY_ANALYST'],
      scopes: [
        'whoami:read',
        'events:read',
        'findings:read',
        'findings:write',
        'assessments:read',
        'assessments:review',
        'keys:read',
        'inventory:read',
        'cbom:read',
        'cbom:write',
        'cbom:generate',
      ],
    },
    
  },
  ADMIN: {
    name: 'Enterprise Administrator',
    description: 'Manages keys (rotate/disable), acknowledges findings, generates CBOM, inspects audit logs.',
    principal: {
      subject: 'sub:admin-operator-1',
      organization_id: DEFAULT_ORG_ID,
      roles: ['ADMIN'],
      scopes: [
        'whoami:read',
        'events:read',
        'findings:read',
        'findings:write',
        'assessments:read',
        'keys:read',
        'keys:write',
        'inventory:read',
        'cbom:read',
        'cbom:write',
        'cbom:generate',
        'audit:read',
      ],
    },
  },
  AUDITOR: {
    name: 'Compliance Auditor',
    description: 'Read-only access to all events, findings, risk assessments, inventory, CBOM, and audit records.',
    principal: {
      subject: 'sub:auditor-compliance-1',
      organization_id: DEFAULT_ORG_ID,
      roles: ['AUDITOR'],
      scopes: [
        'whoami:read',
        'events:read',
        'findings:read',
        'assessments:read',
        'keys:read',
        'inventory:read',
        'cbom:read',
        'audit:read',
      ],
    },
  },
  SERVICE: {
    name: 'Workload Service Identity',
    description: 'Workload identity for event ingestion, signature verification, and provider encryption. Read UI restricted.',
    principal: {
      subject: 'service:broker-ingestion-v1',
      organization_id: DEFAULT_ORG_ID,
      roles: ['SERVICE'],
      scopes: ['whoami:read', 'events:write', 'crypto:verify', 'crypto:encrypt'],
    },
  },
}

interface AuthContextValue {
  principal: Principal
  token: string
  activeRole: UserRole
  identityKey: keyof typeof PREDEFINED_IDENTITIES
  hasRole: (role: UserRole) => boolean
  hasScope: (scope: string) => boolean
  canManageKeys: boolean
  canReviewAssessments: boolean
  canChangeFindingStatus: boolean
  canGenerateCbom: boolean
  canReadAudit: boolean
  switchIdentity: (roleKey: keyof typeof PREDEFINED_IDENTITIES) => void
  setCustomToken: (customToken: string, customPrincipal?: Principal) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentIdentityKey, setCurrentIdentityKey] = useState<keyof typeof PREDEFINED_IDENTITIES>('SECURITY_ANALYST')
  const [token, setToken] = useState<string>(
  buildMockToken(PREDEFINED_IDENTITIES.SECURITY_ANALYST.principal),
)
  const [principal, setPrincipal] = useState<Principal>(PREDEFINED_IDENTITIES.SECURITY_ANALYST.principal)

  const switchIdentity = useCallback((roleKey: keyof typeof PREDEFINED_IDENTITIES) => {
    const ident = PREDEFINED_IDENTITIES[roleKey]
    if (ident) {
      setCurrentIdentityKey(roleKey)
      setToken(buildMockToken(ident.principal))
      setPrincipal(ident.principal)
    }
  }, [])

  const setCustomToken = useCallback((customToken: string, customPrincipal?: Principal) => {
    setToken(customToken)
    if (customPrincipal) {
      setPrincipal(customPrincipal)
    }
  }, [])

  const hasRole = useCallback((role: UserRole): boolean => {
    return principal.roles.includes(role)
  }, [principal.roles])

  const hasScope = useCallback((scope: string): boolean => {
    return principal.scopes.includes(scope)
  }, [principal.scopes])

  // Explicit capability gates based on permission matrix in docs/api-contracts.md:
  const canManageKeys = hasRole('ADMIN') && hasScope('keys:write')
  const canReviewAssessments = hasRole('SECURITY_ANALYST') && hasScope('assessments:review')
  const canChangeFindingStatus = (hasRole('ADMIN') || hasRole('SECURITY_ANALYST')) && hasScope('findings:write')
  const canGenerateCbom = (hasRole('ADMIN') || hasRole('SECURITY_ANALYST')) && hasScope('cbom:generate')
  const canReadAudit = (hasRole('ADMIN') || hasRole('AUDITOR')) && hasScope('audit:read')

  if (!MOCK_AUTH_ENABLED) {
    return (
      <div role="status" style={{ padding: '48px', color: 'var(--text-primary)' }}>
        <h1>Sign-in is not configured</h1>
        <p>This frontend has no production identity provider configured.</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider
      value={{
        principal,
        token,
        activeRole: (principal.roles[0] as UserRole) || 'SECURITY_ANALYST',
        identityKey: currentIdentityKey,
        hasRole,
        hasScope,
        canManageKeys,
        canReviewAssessments,
        canChangeFindingStatus,
        canGenerateCbom,
        canReadAudit,
        switchIdentity,
        setCustomToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
