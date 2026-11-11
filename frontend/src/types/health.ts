import type { ProblemDetails } from './problem'

export interface HealthLiveResponse {
  status: 'ok'
  request_id: string
  correlation_id?: string
}

export interface HealthReadyResponse {
  status: 'ready'
  request_id: string
  correlation_id?: string
}

export interface BackendHealthState {
  isLive: boolean
  isReady: boolean
  liveRequestId: string | null
  readyRequestId: string | null
  lastChecked: string | null
  latencyMs: number | null
  readyError: ProblemDetails | null
  isChecking: boolean
}
