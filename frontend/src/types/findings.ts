export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export type FindingStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'

export type FindingKind =
  | 'REPLAY_DETECTED'
  | 'EVENT_ID_CONFLICT'
  | 'INVALID_SIGNATURE'
  | 'UNKNOWN_KEY'
  | 'KEY_DISABLED'
  | 'KEY_REVOKED'
  | 'MALFORMED_INPUT'
  | 'VERIFIER_UNAVAILABLE'
  | 'HIGH_RISK_ANOMALY'

export interface Finding {
  id: string
  organization_id: string
  event_id?: string | null
  kind: FindingKind
  severity: FindingSeverity
  status: FindingStatus
  created_at: string
  updated_at?: string
  summary: string
  reason_code?: string
  acknowledged_by?: string | null
  resolved_by?: string | null
  resolution_rationale?: string | null
}
