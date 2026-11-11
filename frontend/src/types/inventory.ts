export type PqcReadiness =
  | 'CLASSICAL_VULNERABLE'
  | 'TRANSITIONING'
  | 'HYBRID_CANDIDATE'
  | 'POST_QUANTUM_READY'

export interface InventoryAsset {
  id: string
  organization_id: string
  asset_ref: string
  asset_type: 'KEY' | 'CERTIFICATE' | 'ALGORITHM_PRIMITIVE' | 'CIPHER_SUITE' | 'PROTOCOL_HANDSHAKE'
  algorithm: string
  key_size_bits?: number
  curve?: string
  protocol?: string
  library?: string
  usage_context: string
  pqc_readiness: PqcReadiness
  last_scanned_at: string
}
