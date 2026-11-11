// QUBRIX Types — Security & Authentication Models

export type UserRole = 'ADMIN' | 'SECURITY_ANALYST' | 'AUDITOR' | 'SERVICE'

export type StandardScope =
  | 'whoami:read'
  | 'events:read'
  | 'events:write'
  | 'crypto:verify'
  | 'crypto:encrypt'
  | 'crypto:decrypt'
  | 'findings:read'
  | 'findings:write'
  | 'assessments:read'
  | 'assessments:review'
  | 'keys:read'
  | 'keys:write'
  | 'inventory:read'
  | 'cbom:read'
  | 'cbom:write'
  | 'cbom:generate'
  | 'audit:read'

export interface Principal {
  subject: string
  organization_id: string
  roles: UserRole[]
  scopes: string[]
}

export interface WhoamiResponse {
  request_id: string
  subject: string
  organization_id: string
  roles: string[]
  scopes: string[]
}

export interface AuthSession {
  token: string | null
  principal: Principal | null
  issuer: string
  expiresAt: number | null
}
