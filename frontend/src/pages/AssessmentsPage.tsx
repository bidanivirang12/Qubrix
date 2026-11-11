import React, { useState } from 'react'
import { UserCheck, Lock } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { DataTable } from '../components/common/DataTable'
import type { Column } from '../components/common/DataTable'
import { Drawer } from '../components/common/Drawer'
import { Modal } from '../components/common/Modal'
import { CryptoIdentifier } from '../components/common/CryptoIdentifier'
import { ProblemAlert } from '../components/common/ProblemAlert'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { contractStore } from '../services/contractStore'
import { apiRequest, ProblemError } from '../services/api'
import type { RiskAssessment, RiskDecision, ReviewStatus } from '../types/assessments'
import type { ProblemDetails } from '../types/problem'

interface AssessmentsPageProps {
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
}

export const AssessmentsPage: React.FC<AssessmentsPageProps> = ({ executionMode }) => {
  const { principal, canReviewAssessments } = useAuth()
  const { showToast } = useToast()

  const [assessments, setAssessments] = useState<RiskAssessment[]>(contractStore.getAssessments())
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null)

  // Review modal state
  const [reviewModalAssessment, setReviewModalAssessment] = useState<RiskAssessment | null>(null)
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('CONFIRMED')
  const [decisionOverride, setDecisionOverride] = useState<string>('NONE')
  const [reviewReasonCode] = useState('ANALYST_VALIDATION')
  const [reviewRationale, setReviewRationale] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<ProblemDetails | null>(null)

  const handleReviewSubmit = async () => {
    if (!reviewModalAssessment) return
    if (!reviewRationale.trim()) {
      showToast('Review rationale is required by API contract', 'error')
      return
    }

    const overrideVal: RiskDecision | null =
      decisionOverride === 'NONE' ? null : (decisionOverride as RiskDecision)

    if (
      reviewModalAssessment.overrides_applied.includes('HARD_FLOOR_KEY_REVOKED') &&
      overrideVal === 'APPROVE'
    ) {
      showToast('Hard floor violation: Replay or Revoked/Invalid Key assessment cannot be overridden to APPROVE.', 'error')
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    if (executionMode === 'DIRECT_LIVE') {
      try {
        await apiRequest(`/api/v1/assessments/${reviewModalAssessment.assessment_id}/review`, {
          method: 'POST',
          body: JSON.stringify({
            schema_version: 1,
            correlation_id: crypto.randomUUID(),
            review_status: reviewStatus,
            decision_override: overrideVal,
            reason_code: reviewReasonCode,
            rationale: reviewRationale,
          }),
        })
        showToast(`Review committed on live backend for ${reviewModalAssessment.assessment_id}`, 'success')
        setReviewModalAssessment(null)
      } catch (err: unknown) {
        if (err instanceof ProblemError) {
          setApiError(err.problem)
        } else {
          showToast('Failed to commit review on live backend', 'error')
        }
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setTimeout(() => {
        try {
          const updated = contractStore.reviewAssessment(
            reviewModalAssessment.assessment_id,
            reviewStatus,
            overrideVal,
            reviewReasonCode,
            reviewRationale,
            principal.subject
          )
          setAssessments(contractStore.getAssessments())
          setSelectedAssessment(updated)
          setReviewModalAssessment(null)
          setReviewRationale('')
          showToast(`Analyst review appended to ${reviewModalAssessment.assessment_id}`, 'success')
        } catch (err: any) {
          showToast(err.message, 'error')
        } finally {
          setIsSubmitting(false)
        }
      }, 400)
    }
  }

  const columns: Column<RiskAssessment>[] = [
    {
      key: 'assessment_id',
      header: 'Assessment ID',
      width: '140px',
      sortable: true,
      render: (row) => <CryptoIdentifier value={row.assessment_id} truncateLength={8} />,
    },
    {
      key: 'score',
      header: 'Trust Score (0-100)',
      width: '180px',
      sortable: true,
      render: (row) => {
        let variant: 'valid' | 'warning' | 'critical' = 'valid'
        if (row.score >= 70) variant = 'critical'
        else if (row.score >= 40) variant = 'warning'

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '14px', fontWeight: 700 }}>
              {row.score}
            </span>
            <Badge variant={variant}>{row.decision}</Badge>
          </div>
        )
      },
    },
    {
      key: 'event_id',
      header: 'Event Reference (UUID)',
      render: (row) => <CryptoIdentifier value={row.event_id} truncateLength={8} />,
    },
    {
      key: 'reason_codes',
      header: 'Model Reason Codes',
      render: (row) => (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {row.reason_codes.slice(0, 2).map((code) => (
            <span
              key={code}
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'var(--surface-elevated)',
                padding: '2px 5px',
                borderRadius: '2px',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {code}
            </span>
          ))}
          {row.reason_codes.length > 2 && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              +{row.reason_codes.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'reviews',
      header: 'Analyst Reviews',
      width: '140px',
      render: (row) => (
        <span style={{ fontSize: '12px', color: row.reviews.length > 0 ? 'var(--emerald-500)' : 'var(--text-muted)' }}>
          {row.reviews.length > 0 ? `${row.reviews.length} reviewed` : 'No reviews'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Evaluated (UTC)',
      width: '150px',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {row.created_at.replace('T', ' ').slice(0, 19)}
        </span>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="TrustShield Risk Assessments &amp; Analyst Review"
        subtitle="Probabilistic trust scores (0-39 APPROVE, 40-69 VERIFY, 70-100 FLAG) with hard security floor enforcement and attributable analyst review."
        breadcrumb="Risk & Trust / Assessments"
        badgeText={executionMode === 'DIRECT_LIVE' ? 'Live API Proxy: /api/v1/assessments' : 'Contract Mode: ADR-0003'}
        badgeVariant={executionMode === 'DIRECT_LIVE' ? 'valid' : 'info'}
      />

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {apiError && <ProblemAlert problem={apiError} />}

        {!canReviewAssessments && (
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Lock size={14} style={{ color: 'var(--amber-500)' }} />
            <span>
              Current role (<strong style={{ color: 'var(--text-primary)' }}>{principal.roles.join(', ')}</strong>) is read-only. Appending reviews and decision overrides requires the{' '}
              <strong style={{ color: 'var(--text-primary)' }}>SECURITY_ANALYST</strong> role with <code style={{ color: 'var(--text-secondary)' }}>assessments:review</code> scope.
            </span>
          </div>
        )}

        <DataTable
          columns={columns}
          data={assessments}
          keyExtractor={(row) => row.assessment_id}
          onRowClick={(row) => setSelectedAssessment(row)}
          selectedRowKey={selectedAssessment?.assessment_id}
          emptyMessage="No risk assessments recorded."
        />
      </div>

      {/* Assessment Inspection & Review Drawer */}
      <Drawer
        isOpen={selectedAssessment !== null}
        onClose={() => setSelectedAssessment(null)}
        title="Risk Assessment Evaluation"
        subtitle={`Assessment ID: ${selectedAssessment?.assessment_id}`}
        width="560px"
        footer={
          selectedAssessment ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="primary"
                size="sm"
                icon={<UserCheck size={14} />}
                onClick={() => setReviewModalAssessment(selectedAssessment)}
                disabled={!canReviewAssessments}
                title={!canReviewAssessments ? 'Requires SECURITY_ANALYST role' : undefined}
              >
                Append Analyst Review
              </Button>
            </div>
          ) : undefined
        }
      >
        {selectedAssessment && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            {/* Score & Decision Overview */}
            <div
              style={{
                backgroundColor: 'var(--surface-main)',
                padding: '14px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Risk Score
                </span>
                <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {selectedAssessment.score}{' '}
                  <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>/ 100</span>
                </div>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Effective Decision
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={selectedAssessment.decision === 'APPROVE' ? 'valid' : selectedAssessment.decision === 'VERIFY' ? 'warning' : 'critical'}>
                    {selectedAssessment.decision}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Model & Version Provenance */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                backgroundColor: 'var(--surface-nav)',
                padding: '10px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Model: </span>
                <span>{selectedAssessment.model_version}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Ruleset: </span>
                <span>{selectedAssessment.ruleset_version}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Feature Set: </span>
                <span>{selectedAssessment.feature_version}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Hard Overrides: </span>
                <span style={{ color: selectedAssessment.overrides_applied.length > 0 ? 'var(--amber-500)' : 'var(--text-secondary)' }}>
                  {selectedAssessment.overrides_applied.join(', ') || 'None'}
                </span>
              </div>
            </div>

            {/* Reason Codes */}
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '6px' }}>
                Extracted Reason Codes
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {selectedAssessment.reason_codes.map((code) => (
                  <Badge key={code} variant="neutral">
                    {code}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Append-Only Analyst Reviews */}
            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '14px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Analyst Review History ({selectedAssessment.reviews.length})
              </div>

              {selectedAssessment.reviews.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No manual review recorded for this assessment yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedAssessment.reviews.map((rev) => (
                    <div
                      key={rev.id}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: 'var(--surface-main)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-default)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {rev.review_status} {rev.decision_override ? `→ ${rev.decision_override}` : ''}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {rev.created_at.slice(0, 19).replace('T', ' ')}
                        </span>
                      </div>
                      <p style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                        {rev.rationale}
                      </p>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        By: {rev.actor_subject}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Review Dialog */}
      <Modal
        isOpen={reviewModalAssessment !== null}
        onClose={() => setReviewModalAssessment(null)}
        title="Append Analyst Review &amp; Decision"
        subtitle={`Assessment: ${reviewModalAssessment?.assessment_id}`}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={() => setReviewModalAssessment(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleReviewSubmit}
              isLoading={isSubmitting}
            >
              Commit Review
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Review Confirmation Status *
            </label>
            <select
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value as ReviewStatus)}
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-nav)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                padding: '8px',
                fontSize: '12px',
              }}
            >
              <option value="CONFIRMED">CONFIRMED (Agree with automated decision)</option>
              <option value="DISPUTED">DISPUTED (Contest automated decision)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Optional Decision Override
            </label>
            <select
              value={decisionOverride}
              onChange={(e) => setDecisionOverride(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-nav)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                padding: '8px',
                fontSize: '12px',
              }}
            >
              <option value="NONE">No Decision Override (Preserve {reviewModalAssessment?.decision})</option>
              <option value="APPROVE">APPROVE (Permitted only if no hard replay/revocation floor exists)</option>
              <option value="VERIFY">VERIFY (Escalate for manual identity verification)</option>
              <option value="FLAG">FLAG (Flag as confirmed malicious or replayed)</option>
            </select>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Floor rule: Replays require FLAG; revoked or unknown keys require at least VERIFY.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
              Analyst Rationale *
            </label>
            <textarea
              rows={3}
              value={reviewRationale}
              onChange={(e) => setReviewRationale(e.target.value)}
              placeholder="Provide verifiable non-sensitive technical reasoning for audit trail..."
              style={{
                width: '100%',
                backgroundColor: 'var(--surface-nav)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                padding: '8px',
                fontSize: '12px',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
