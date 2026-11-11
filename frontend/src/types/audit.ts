export interface AuditRecord {
  id: string
  organization_id: string
  actor_subject: string
  action: string
  target_ref: string
  occurred_at: string
}
