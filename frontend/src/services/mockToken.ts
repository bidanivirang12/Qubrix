import type { Principal } from '../types/auth'

function b64url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// Builds an UNSIGNED token for mock mode only. The real backend will reject it.
export function buildMockToken(principal: Principal): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'none-mock', typ: 'JWT', kid: 'mock' }
  const payload = {
    sub: principal.subject,
    organization_id: principal.organization_id,
    roles: principal.roles,
    scope: principal.scopes.join(' '),
    iss: 'https://idp.qubrix.local',
    aud: 'qubrix-api',
    iat: now,
    exp: now + 3600,
  }
  return `${b64url(header)}.${b64url(payload)}.mock-unsigned`
}
