export type RiskDecision = 'APPROVE' | 'VERIFY' | 'FLAG'

export type ReviewStatus = 'CONFIRMED' | 'DISPUTED'

export interface AssessmentReview {
  id: string
  organization_id: string
  assessment_id: string
  actor_subject: string
  review_status: ReviewStatus
  decision_override?: RiskDecision | null
  reason_code: string
  rationale: string
  created_at: string
}

export interface RiskAssessment {
  assessment_id: string
  event_id: string
  attempt_id?: string
  score: number // 0-100: 0-39 APPROVE, 40-69 VERIFY, 70-100 FLAG
  decision: RiskDecision
  reason_codes: string[]
  model_version: string
  ruleset_version: string
  feature_version: string
  overrides_applied: string[]
  reviews: AssessmentReview[]
  created_at: string
}
