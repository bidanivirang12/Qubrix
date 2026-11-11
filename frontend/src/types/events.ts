import type { SupportedAlgorithm } from './keys'

export type EventType =
  | 'TRANSACTION_ATTEMPT'
  | 'LOGIN_ATTEMPT'
  | 'SIGNED_MESSAGE_RECEIVED'
  | 'KEY_LIFECYCLE_CHANGE'

export type VerificationStatus =
  | 'VALID'
  | 'INVALID'
  | 'UNKNOWN_KEY'
  | 'MALFORMED_INPUT'
  | 'VERIFIER_UNAVAILABLE'

export interface EventSignature {
  protocol_version: 'qubrix-event-signature-v1'
  key_id: string
  algorithm: SupportedAlgorithm
  value: string
}

export interface TransactionAttributes {
  amount_minor: number
  currency: string
  channel: 'WEB' | 'MOBILE' | 'POS' | 'API' | 'OTHER'
  country_code?: string
  device_ref?: string
  auth_method?: 'PASSWORD' | 'PASSKEY' | 'MFA' | 'API_KEY' | 'NONE' | 'OTHER'
}

export interface LoginAttributes {
  auth_method: 'PASSWORD' | 'PASSKEY' | 'MFA' | 'API_KEY' | 'NONE' | 'OTHER'
  outcome: 'SUCCESS' | 'FAILURE' | 'CHALLENGE'
  channel: 'WEB' | 'MOBILE' | 'POS' | 'API' | 'OTHER'
  country_code?: string
  device_ref?: string
  factor_count?: number
}

export interface SignedMessageAttributes {
  message_purpose: 'TRANSACTION_AUTHORIZATION' | 'AUTHENTICATION' | 'KEY_ATTESTATION' | 'OTHER'
  payload_size_bytes: number
  sender_ref?: string
  content_type?: 'APPLICATION_JSON' | 'APPLICATION_CBOR' | 'OTHER'
}

export interface KeyLifecycleAttributes {
  key_ref: string
  action: 'REGISTERED' | 'ROTATION_REQUESTED' | 'ROTATED' | 'DISABLE_REQUESTED' | 'DISABLED' | 'REVOKED'
  reported_status: 'REQUESTED' | 'SUCCEEDED' | 'FAILED'
  change_source: 'ADMIN' | 'PROVIDER' | 'AUTOMATION' | 'OTHER'
  reason_code?: string
}

export type EventAttributes =
  | TransactionAttributes
  | LoginAttributes
  | SignedMessageAttributes
  | KeyLifecycleAttributes

export interface EventRecord {
  id: string
  event_id: string
  event_type: EventType
  organization_id: string
  actor_subject: string
  occurred_at: string
  received_at: string
  subject_ref?: string | null
  payload_digest?: string | null
  nonce?: string | null
  attributes: EventAttributes
  signature?: EventSignature
  verification_status: VerificationStatus
  verification_reason?: string | null
  risk_score: number
  risk_decision: 'APPROVE' | 'VERIFY' | 'FLAG'
}
