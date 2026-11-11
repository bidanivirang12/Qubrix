// QUBRIX Contract Store — Faithful to docs/api-contracts.md and docs/data-model.md
import type { KeyRecord } from '../types/keys'
import type { EventRecord } from '../types/events'
import type { Finding, FindingStatus } from '../types/findings'
import type { RiskAssessment, RiskDecision } from '../types/assessments'
import type { InventoryAsset } from '../types/inventory'
import type { CbomSnapshot } from '../types/cbom'
import type { AuditRecord } from '../types/audit'

export const DEFAULT_ORG_ID = '6a79d6d8-23d3-4c14-bca7-6621be7d1701'

const initialKeys: KeyRecord[] = [
  {
    id: '1a91e5cf-1594-4b55-a249-14a9058b8d01',
    organization_id: DEFAULT_ORG_ID,
    key_id: 'key-ed25519-prod-auth-01',
    provider_ref: 'kms://aws-us-east-1/alias/qubrix-auth-ed25519-v1',
    algorithm: 'ED25519',
    fingerprint: 'sha256:4a8f9c1b7e3d2a5f6e8c0b1d3e5f7a9b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f',
    lifecycle: 'ACTIVE',
    created_at: '2026-09-01T08:00:00Z',
    rotated_at: null,
  },
  {
    id: '2b82f6de-2605-4c66-b35a-25ba169c9e02',
    organization_id: DEFAULT_ORG_ID,
    key_id: 'key-p256-edge-signer-02',
    provider_ref: 'kms://gcp-us-central1/projects/qubrix/locations/global/keyRings/edge/cryptoKeys/p256-02',
    algorithm: 'ECDSA_P256_SHA256',
    fingerprint: 'sha256:9b1d3e5f7a9b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a8f9c1b7e3d2a5f6e8c',
    lifecycle: 'ACTIVE',
    created_at: '2026-09-15T14:30:00Z',
    rotated_at: null,
  },
  {
    id: '3c73a7ef-3716-4d77-c46b-36cb27ad0f03',
    organization_id: DEFAULT_ORG_ID,
    key_id: 'key-rsa3072-root-anchor-03',
    provider_ref: 'hsm://lunasa-cluster-01/partition-qubrix/rsa-3072-root',
    algorithm: 'RSA_PSS_SHA256_3072',
    fingerprint: 'sha256:6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a8f9c1b7e3d2a5f6e8c0b1d3e5f7a9b2c4d',
    lifecycle: 'ACTIVE',
    created_at: '2026-08-10T00:00:00Z',
    rotated_at: null,
  },
  {
    id: '4d64b8fa-4827-4e88-d57c-47dc38be1a04',
    organization_id: DEFAULT_ORG_ID,
    key_id: 'key-ed25519-revoked-test-04',
    provider_ref: 'kms://aws-us-east-1/alias/qubrix-compromised-sample',
    algorithm: 'ED25519',
    fingerprint: 'sha256:0b1d3e5f7a9b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a8f9c1b7e3d2a5f6e8c',
    lifecycle: 'REVOKED',
    created_at: '2026-07-20T11:00:00Z',
    disabled_at: '2026-10-01T09:15:00Z',
  },
]

const initialInventory: InventoryAsset[] = [
  {
    id: 'inv-01',
    organization_id: DEFAULT_ORG_ID,
    asset_ref: 'auth-service/tls-server-cert',
    asset_type: 'CERTIFICATE',
    algorithm: 'ECDSA_P256_SHA256',
    key_size_bits: 256,
    curve: 'secp256r1',
    protocol: 'TLS 1.3',
    library: 'OpenSSL 3.3.1',
    usage_context: 'Ingress Gateway TLS termination',
    pqc_readiness: 'TRANSITIONING',
    last_scanned_at: '2026-10-14T02:00:00Z',
  },
  {
    id: 'inv-02',
    organization_id: DEFAULT_ORG_ID,
    asset_ref: 'event-broker/mTLS-client',
    asset_type: 'KEY',
    algorithm: 'RSA_PSS_SHA256_3072',
    key_size_bits: 3072,
    protocol: 'mTLS',
    library: 'BoringSSL',
    usage_context: 'Internal Kafka mutual TLS publisher identity',
    pqc_readiness: 'CLASSICAL_VULNERABLE',
    last_scanned_at: '2026-10-14T02:00:00Z',
  },
  {
    id: 'inv-03',
    organization_id: DEFAULT_ORG_ID,
    asset_ref: 'crypto-engine/kem-pilot-01',
    asset_type: 'ALGORITHM_PRIMITIVE',
    algorithm: 'ML-KEM-768 (Kyber)',
    key_size_bits: 1184,
    protocol: 'Hybrid Post-Quantum Transport',
    library: 'liboqs 0.11.0 / FIPS 203',
    usage_context: 'PQC Readiness testbed for cross-zone envelope encryption',
    pqc_readiness: 'POST_QUANTUM_READY',
    last_scanned_at: '2026-10-14T02:00:00Z',
  },
  {
    id: 'inv-04',
    organization_id: DEFAULT_ORG_ID,
    asset_ref: 'signature-pipeline/dsa-pilot-02',
    asset_type: 'ALGORITHM_PRIMITIVE',
    algorithm: 'ML-DSA-65 (Dilithium)',
    key_size_bits: 1952,
    protocol: 'Digital Signature Algorithm',
    library: 'liboqs 0.11.0 / FIPS 204',
    usage_context: 'Experimental quantum-resistant transaction audit notarization',
    pqc_readiness: 'POST_QUANTUM_READY',
    last_scanned_at: '2026-10-14T02:00:00Z',
  },
  {
    id: 'inv-05',
    organization_id: DEFAULT_ORG_ID,
    asset_ref: 'session-token/jwt-signer',
    asset_type: 'KEY',
    algorithm: 'ED25519',
    key_size_bits: 256,
    curve: 'edwards25519',
    protocol: 'OIDC/JWT RFC 8037',
    library: 'cryptography 43.0.1',
    usage_context: 'Bearer token issuance for tenant principals',
    pqc_readiness: 'TRANSITIONING',
    last_scanned_at: '2026-10-14T02:00:00Z',
  },
  {
    id: 'inv-06',
    organization_id: DEFAULT_ORG_ID,
    asset_ref: 'database/data-at-rest-kek',
    asset_type: 'CIPHER_SUITE',
    algorithm: 'AES-256-GCM',
    key_size_bits: 256,
    protocol: 'PostgreSQL TDE / KMS Envelope',
    library: 'AWS KMS SDK',
    usage_context: 'Database volume and column-level encryption keys',
    pqc_readiness: 'POST_QUANTUM_READY',
    last_scanned_at: '2026-10-14T02:00:00Z',
  },
]

const initialEvents: EventRecord[] = [
  {
    id: 'ev-01',
    event_id: 'e3194a2b-f8c6-4315-a7b2-654cb048a101',
    event_type: 'TRANSACTION_ATTEMPT',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'service:payments-gateway-v2',
    occurred_at: '2026-10-15T04:12:30Z',
    received_at: '2026-10-15T04:12:31Z',
    subject_ref: 'token:user-ref-9182',
    payload_digest: 'dGVzdC1kaWdlc3QtdmFsdWUtMDEx',
    nonce: 'c2FtcGxlLW5vbmNlLXZhbHVlLTE2Ynl0ZXM=',
    attributes: {
      amount_minor: 125000,
      currency: 'USD',
      channel: 'WEB',
      country_code: 'US',
      device_ref: 'opaque-dev-tok-us-east',
      auth_method: 'MFA',
    },
    signature: {
      protocol_version: 'qubrix-event-signature-v1',
      key_id: 'key-ed25519-prod-auth-01',
      algorithm: 'ED25519',
      value: 'S35s0e4gB3Xw9K2jF1qT7yU8iO0pL...base64url',
    },
    verification_status: 'VALID',
    risk_score: 24,
    risk_decision: 'APPROVE',
  },
  {
    id: 'ev-02',
    event_id: 'b8192c3d-e7f5-4426-b8c3-765da159b202',
    event_type: 'SIGNED_MESSAGE_RECEIVED',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'service:broker-attest-v1',
    occurred_at: '2026-10-15T04:30:15Z',
    received_at: '2026-10-15T04:30:16Z',
    subject_ref: 'opaque-sender-ref-441',
    payload_digest: 'bWVzc2FnZS1zaWduZWQtZGlnZXN0LTAy',
    nonce: 'bm9uY2UtYWxnb3JpdGhtLXAyNTYtdmFsaWQ=',
    attributes: {
      message_purpose: 'TRANSACTION_AUTHORIZATION',
      payload_size_bytes: 4096,
      sender_ref: 'tenant-signer-node-9',
      content_type: 'APPLICATION_JSON',
    },
    signature: {
      protocol_version: 'qubrix-event-signature-v1',
      key_id: 'key-p256-edge-signer-02',
      algorithm: 'ECDSA_P256_SHA256',
      value: 'MEQCID6v...DER...encoded...P256',
    },
    verification_status: 'VALID',
    risk_score: 31,
    risk_decision: 'APPROVE',
  },
  {
    id: 'ev-03',
    event_id: 'c9283d4e-f8a6-4537-c9d4-876eb260c303',
    event_type: 'LOGIN_ATTEMPT',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'service:idp-bridge-v1',
    occurred_at: '2026-10-15T04:45:00Z',
    received_at: '2026-10-15T04:45:01Z',
    subject_ref: 'subject-token-9988',
    attributes: {
      auth_method: 'PASSWORD',
      outcome: 'FAILURE',
      channel: 'API',
      country_code: 'RO',
      factor_count: 1,
    },
    verification_status: 'VALID',
    risk_score: 74,
    risk_decision: 'FLAG',
  },
  {
    id: 'ev-04',
    event_id: 'd0394e5f-a9b7-4648-dae5-987fc371d404',
    event_type: 'SIGNED_MESSAGE_RECEIVED',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'service:external-partner-v1',
    occurred_at: '2026-10-15T04:55:20Z',
    received_at: '2026-10-15T04:55:21Z',
    subject_ref: 'partner-node-unknown',
    nonce: 'cmVwbGF5LW5vbmNlLWZsYWdnZWQtMDQ=',
    attributes: {
      message_purpose: 'AUTHENTICATION',
      payload_size_bytes: 2048,
    },
    signature: {
      protocol_version: 'qubrix-event-signature-v1',
      key_id: 'key-ed25519-revoked-test-04',
      algorithm: 'ED25519',
      value: 'M0Z...invalid...revoked',
    },
    verification_status: 'INVALID',
    verification_reason: 'KEY_REVOKED',
    risk_score: 86,
    risk_decision: 'FLAG',
  },
]

const initialFindings: Finding[] = [
  {
    id: 'find-01',
    organization_id: DEFAULT_ORG_ID,
    event_id: 'd0394e5f-a9b7-4648-dae5-987fc371d404',
    kind: 'KEY_REVOKED',
    severity: 'CRITICAL',
    status: 'OPEN',
    created_at: '2026-10-15T04:55:21Z',
    summary: 'Verification attempt rejected: Key "key-ed25519-revoked-test-04" is revoked in tenant key registry.',
    reason_code: 'KEY_REVOKED',
  },
  {
    id: 'find-02',
    organization_id: DEFAULT_ORG_ID,
    event_id: 'e3194a2b-f8c6-4315-a7b2-654cb048a101',
    kind: 'REPLAY_DETECTED',
    severity: 'CRITICAL',
    status: 'ACKNOWLEDGED',
    created_at: '2026-10-15T04:14:02Z',
    summary: 'Signed nonce reuse detected for tenant 6a79d6d8. Hard floor FLAG enforced, original event preserved.',
    reason_code: 'REPLAY_NONCE_REUSED',
    acknowledged_by: 'sub:security-analyst-1',
  },
  {
    id: 'find-03',
    organization_id: DEFAULT_ORG_ID,
    event_id: 'c9283d4e-f8a6-4537-c9d4-876eb260c303',
    kind: 'HIGH_RISK_ANOMALY',
    severity: 'HIGH',
    status: 'OPEN',
    created_at: '2026-10-15T04:45:01Z',
    summary: 'Anomalous velocity detected: consecutive password authentication failures from unverified country code.',
    reason_code: 'ANOMALOUS_VELOCITY',
  },
  {
    id: 'find-04',
    organization_id: DEFAULT_ORG_ID,
    event_id: null,
    kind: 'UNKNOWN_KEY',
    severity: 'MEDIUM',
    status: 'RESOLVED',
    created_at: '2026-10-14T22:10:00Z',
    summary: 'Verification requested for un-provisioned key reference "key-test-legacy-unregistered".',
    reason_code: 'KEY_NOT_FOUND',
    acknowledged_by: 'sub:admin-operator-2',
    resolved_by: 'sub:admin-operator-2',
    resolution_rationale: 'Key was a test fixture from staging load testing. Staging origin restricted.',
  },
]

const initialAssessments: RiskAssessment[] = [
  {
    assessment_id: 'ass-01',
    event_id: 'e3194a2b-f8c6-4315-a7b2-654cb048a101',
    score: 24,
    decision: 'APPROVE',
    reason_codes: ['SIGNATURE_VERIFIED', 'DEVICE_MATCH', 'NORMAL_VELOCITY'],
    model_version: 'trustshield-model-v2.4.1',
    ruleset_version: 'risk-ruleset-2026.10',
    feature_version: 'event-features-v1',
    overrides_applied: [],
    reviews: [],
    created_at: '2026-10-15T04:12:31Z',
  },
  {
    assessment_id: 'ass-02',
    event_id: 'b8192c3d-e7f5-4426-b8c3-765da159b202',
    score: 31,
    decision: 'APPROVE',
    reason_codes: ['SIGNATURE_VERIFIED', 'KNOWN_PARTNER_ORIGIN'],
    model_version: 'trustshield-model-v2.4.1',
    ruleset_version: 'risk-ruleset-2026.10',
    feature_version: 'event-features-v1',
    overrides_applied: [],
    reviews: [],
    created_at: '2026-10-15T04:30:16Z',
  },
  {
    assessment_id: 'ass-03',
    event_id: 'c9283d4e-f8a6-4537-c9d4-876eb260c303',
    score: 74,
    decision: 'FLAG',
    reason_codes: ['ANOMALOUS_VELOCITY', 'GEO_MISMATCH', 'NO_MFA'],
    model_version: 'trustshield-model-v2.4.1',
    ruleset_version: 'risk-ruleset-2026.10',
    feature_version: 'event-features-v1',
    overrides_applied: [],
    reviews: [],
    created_at: '2026-10-15T04:45:01Z',
  },
  {
    assessment_id: 'ass-04',
    event_id: 'd0394e5f-a9b7-4648-dae5-987fc371d404',
    score: 86,
    decision: 'FLAG',
    reason_codes: ['SIGNATURE_VERIFICATION_FAILED', 'KEY_REVOKED'],
    model_version: 'trustshield-model-v2.4.1',
    ruleset_version: 'risk-ruleset-2026.10',
    feature_version: 'event-features-v1',
    overrides_applied: ['HARD_FLOOR_KEY_REVOKED'],
    reviews: [],
    created_at: '2026-10-15T04:55:21Z',
  },
]

const initialCboms: CbomSnapshot[] = [
  {
    id: 'cbom-snap-01',
    organization_id: DEFAULT_ORG_ID,
    snapshot_ref: 'CBOM-20261014-001',
    format_version: 'qubrix-cbom-v1',
    inventory_version: 'inv-v2.1',
    inventory_as_of: '2026-10-14T02:00:00Z',
    digest: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    algorithm_count: 6,
    pqc_ready_count: 3,
    document: {
      $schema: 'https://qubrix.security/schemas/cbom-v1.json',
      generated_by: 'Qubrix CBOM Generator Engine v0.1.0',
      tenant_id: DEFAULT_ORG_ID,
      spec_version: '1.0-draft-spdx3-cryptography',
      cryptographic_components: [
        { name: 'ED25519 Token Signer', primitive: 'Signature', quantum_risk: 'High' },
        { name: 'RSA-3072 Root Key', primitive: 'Signature', quantum_risk: 'High' },
        { name: 'ECDSA P-256 Server Cert', primitive: 'Signature', quantum_risk: 'High' },
        { name: 'ML-KEM-768 Primitive', primitive: 'KEM', quantum_risk: 'None (PQC)' },
        { name: 'ML-DSA-65 Primitive', primitive: 'Signature', quantum_risk: 'None (PQC)' },
        { name: 'AES-256-GCM TDE', primitive: 'Symmetric Cipher', quantum_risk: 'Low' },
      ],
    },
    created_at: '2026-10-14T02:05:00Z',
  },
]

const initialAudits: AuditRecord[] = [
  {
    id: 'aud-01',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'service:idp-provisioning',
    action: 'TENANT_INITIALIZED',
    target_ref: DEFAULT_ORG_ID,
    occurred_at: '2026-08-01T00:00:00Z',
  },
  {
    id: 'aud-02',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'sub:admin-operator-1',
    action: 'KEY_REGISTERED',
    target_ref: 'key-ed25519-prod-auth-01',
    occurred_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 'aud-03',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'sub:admin-operator-1',
    action: 'KEY_REVOKED',
    target_ref: 'key-ed25519-revoked-test-04',
    occurred_at: '2026-10-01T09:15:00Z',
  },
  {
    id: 'aud-04',
    organization_id: DEFAULT_ORG_ID,
    actor_subject: 'sub:security-analyst-1',
    action: 'FINDING_ACKNOWLEDGED',
    target_ref: 'find-02',
    occurred_at: '2026-10-15T04:14:02Z',
  },
]

// In-Memory Contract Store Implementation
class ContractStore {
  private keys: KeyRecord[] = [...initialKeys]
  private inventory: InventoryAsset[] = [...initialInventory]
  private events: EventRecord[] = [...initialEvents]
  private findings: Finding[] = [...initialFindings]
  private assessments: RiskAssessment[] = [...initialAssessments]
  private cboms: CbomSnapshot[] = [...initialCboms]
  private audits: AuditRecord[] = [...initialAudits]

  // Keys
  getKeys(): KeyRecord[] {
    return [...this.keys]
  }

  rotateKey(keyId: string, actorSubject: string): KeyRecord {
    const key = this.keys.find((k) => k.key_id === keyId)
    if (!key) throw new Error(`Key ${keyId} not found`)
    key.lifecycle = 'ROTATED'
    key.rotated_at = new Date().toISOString()

    this.audits.unshift({
      id: `aud-${Date.now()}`,
      organization_id: key.organization_id,
      actor_subject: actorSubject,
      action: 'KEY_ROTATED',
      target_ref: key.key_id,
      occurred_at: new Date().toISOString(),
    })
    return { ...key }
  }

  disableKey(keyId: string, actorSubject: string): KeyRecord {
    const key = this.keys.find((k) => k.key_id === keyId)
    if (!key) throw new Error(`Key ${keyId} not found`)
    key.lifecycle = 'DISABLED'
    key.disabled_at = new Date().toISOString()

    this.audits.unshift({
      id: `aud-${Date.now()}`,
      organization_id: key.organization_id,
      actor_subject: actorSubject,
      action: 'KEY_DISABLED',
      target_ref: key.key_id,
      occurred_at: new Date().toISOString(),
    })
    return { ...key }
  }

  // Inventory
  getInventory(): InventoryAsset[] {
    return [...this.inventory]
  }

  // CBOM
  getCboms(): CbomSnapshot[] {
    return [...this.cboms]
  }

  generateCbom(actorSubject: string): CbomSnapshot {
    const now = new Date().toISOString()
    const snapRef = `CBOM-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${(this.cboms.length + 1).toString().padStart(3, '0')}`
    const pqcCount = this.inventory.filter((i) => i.pqc_readiness === 'POST_QUANTUM_READY').length

    const newSnapshot: CbomSnapshot = {
      id: `cbom-snap-${Date.now()}`,
      organization_id: DEFAULT_ORG_ID,
      snapshot_ref: snapRef,
      format_version: 'qubrix-cbom-v1',
      inventory_version: `inv-v${(this.cboms.length + 2).toFixed(1)}`,
      inventory_as_of: now,
      digest: `sha256:${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`,
      algorithm_count: this.inventory.length,
      pqc_ready_count: pqcCount,
      document: {
        $schema: 'https://qubrix.security/schemas/cbom-v1.json',
        generated_by: 'Qubrix CBOM Generator Engine v0.1.0',
        tenant_id: DEFAULT_ORG_ID,
        spec_version: '1.0-draft-spdx3-cryptography',
        components: this.inventory.map((item) => ({
          ref: item.asset_ref,
          algorithm: item.algorithm,
          type: item.asset_type,
          pqc_status: item.pqc_readiness,
        })),
      },
      created_at: now,
    }

    this.cboms.unshift(newSnapshot)
    this.audits.unshift({
      id: `aud-${Date.now()}`,
      organization_id: DEFAULT_ORG_ID,
      actor_subject: actorSubject,
      action: 'CBOM_SNAPSHOT_GENERATED',
      target_ref: snapRef,
      occurred_at: now,
    })

    return newSnapshot
  }

  // Events
  getEvents(): EventRecord[] {
    return [...this.events]
  }

  // Findings
  getFindings(): Finding[] {
    return [...this.findings]
  }

  updateFindingStatus(
    findingId: string,
    status: FindingStatus,
    rationale: string,
    actorSubject: string
  ): Finding {
    const finding = this.findings.find((f) => f.id === findingId)
    if (!finding) throw new Error(`Finding ${findingId} not found`)

    finding.status = status
    finding.updated_at = new Date().toISOString()
    if (status === 'ACKNOWLEDGED') {
      finding.acknowledged_by = actorSubject
    } else if (status === 'RESOLVED') {
      finding.resolved_by = actorSubject
      finding.resolution_rationale = rationale
    }

    this.audits.unshift({
      id: `aud-${Date.now()}`,
      organization_id: finding.organization_id,
      actor_subject: actorSubject,
      action: `FINDING_${status}`,
      target_ref: finding.id,
      occurred_at: new Date().toISOString(),
    })

    return { ...finding }
  }

  // Assessments
  getAssessments(): RiskAssessment[] {
    return [...this.assessments]
  }

  reviewAssessment(
    assessmentId: string,
    reviewStatus: 'CONFIRMED' | 'DISPUTED',
    decisionOverride: RiskDecision | null,
    reasonCode: string,
    rationale: string,
    actorSubject: string
  ): RiskAssessment {
    const assessment = this.assessments.find((a) => a.assessment_id === assessmentId)
    if (!assessment) throw new Error(`Assessment ${assessmentId} not found`)

    if (assessment.overrides_applied.includes('HARD_FLOOR_KEY_REVOKED') && decisionOverride === 'APPROVE') {
      throw new Error('Hard floor violation: Replay or Revoked/Invalid Key assessment cannot be overridden to APPROVE.')
    }

    const review = {
      id: `rev-${Date.now()}`,
      organization_id: DEFAULT_ORG_ID,
      assessment_id: assessmentId,
      actor_subject: actorSubject,
      review_status: reviewStatus,
      decision_override: decisionOverride,
      reason_code: reasonCode,
      rationale,
      created_at: new Date().toISOString(),
    }

    assessment.reviews.unshift(review)
    if (decisionOverride) {
      assessment.decision = decisionOverride
    }

    this.audits.unshift({
      id: `aud-${Date.now()}`,
      organization_id: DEFAULT_ORG_ID,
      actor_subject: actorSubject,
      action: 'ASSESSMENT_REVIEWED',
      target_ref: assessmentId,
      occurred_at: new Date().toISOString(),
    })

    return { ...assessment }
  }

  // Audits
  getAudits(): AuditRecord[] {
    return [...this.audits]
  }
}

export const contractStore = new ContractStore()
