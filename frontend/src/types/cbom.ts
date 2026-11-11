export interface CbomSnapshot {
  id: string
  organization_id: string
  snapshot_ref: string
  format_version: 'qubrix-cbom-v1'
  inventory_version: string
  inventory_as_of: string
  digest: string
  algorithm_count: number
  pqc_ready_count: number
  document: Record<string, unknown>
  created_at: string
}
