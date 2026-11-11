export type SupportedAlgorithm =
  | 'ED25519'
  | 'ECDSA_P256_SHA256'
  | 'RSA_PSS_SHA256_3072'

export type KeyLifecycle =
  | 'ACTIVE'
  | 'ROTATION_REQUESTED'
  | 'ROTATED'
  | 'DISABLE_REQUESTED'
  | 'DISABLED'
  | 'REVOKED'

export interface KeyRecord {
  id: string
  organization_id: string
  key_id: string
  provider_ref: string
  algorithm: SupportedAlgorithm
  fingerprint: string
  lifecycle: KeyLifecycle
  created_at: string
  rotated_at?: string | null
  disabled_at?: string | null
}
