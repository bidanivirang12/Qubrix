import type { HealthLiveResponse, HealthReadyResponse } from '../types/health'
import type { ProblemDetails } from '../types/problem'
import type { WhoamiResponse } from '../types/auth'

export class ProblemError extends Error {
  public problem: ProblemDetails

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title || `API error ${problem.status}`)
    this.name = 'ProblemError'
    this.problem = problem
  }
}

// Generate client correlation ID for trace metadata
export function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

interface RequestOptions extends RequestInit {
  token?: string | null
  idempotencyKey?: string
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T; requestId: string | null; correlationId: string }> {
  const correlationId = generateCorrelationId()
  const headers = new Headers(options.headers || {})

  headers.set('Accept', 'application/json, application/problem+json')
  headers.set('X-Correlation-ID', correlationId)

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  if (options.idempotencyKey) {
    headers.set('Idempotency-Key', options.idempotencyKey)
  }

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  const controller = new AbortController()
  const callerSignal = options.signal
  const abortFromCaller = () => controller.abort(callerSignal?.reason)
  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), 10_000)

  try {
  const response = await fetch(path, {
    ...options,
    headers,
    signal: controller.signal,
  })

  const requestId = response.headers.get('X-Request-ID')
  const contentType = response.headers.get('content-type') || ''

  if (!response.ok) {
    if (contentType.includes('application/problem+json') || contentType.includes('application/json')) {
      const problemJson = await response.json()
      const problem: ProblemDetails = {
        type: problemJson.type || 'about:blank',
        title: problemJson.title || `Error ${response.status}`,
        status: response.status,
        detail: problemJson.detail || response.statusText,
        instance: problemJson.instance,
        code: problemJson.code || `HTTP_${response.status}`,
        request_id: problemJson.request_id || requestId || 'unknown',
        invalid_params: problemJson.invalid_params,
      }
      if (response.status === 429) problem.retry_after = response.headers.get('Retry-After') || undefined
      throw new ProblemError(problem)
    }

    const errorText = await response.text()
    const fallbackProblem: ProblemDetails = {
      type: 'about:blank',
      title: response.statusText || 'Request Failed',
      status: response.status,
      detail: errorText.slice(0, 200) || `HTTP request failed with status ${response.status}`,
      code: `HTTP_${response.status}`,
      request_id: requestId || 'unknown',
      retry_after: response.status === 429 ? response.headers.get('Retry-After') || undefined : undefined,
    }
    throw new ProblemError(fallbackProblem)
  }

  const data = (await response.json()) as T
  return { data, requestId, correlationId }
  } finally {
    clearTimeout(timeout)
    callerSignal?.removeEventListener('abort', abortFromCaller)
  }
}

// Live Backend Endpoints implemented in app/main.py

export async function checkLiveness(): Promise<{ data: HealthLiveResponse; requestId: string | null; latencyMs: number }> {
  const start = performance.now()
  const result = await apiRequest<HealthLiveResponse>('/health/live')
  const latencyMs = Math.round(performance.now() - start)
  return { data: result.data, requestId: result.requestId, latencyMs }
}

export async function checkReadiness(): Promise<{ data: HealthReadyResponse; requestId: string | null; latencyMs: number }> {
  const start = performance.now()
  const result = await apiRequest<HealthReadyResponse>('/health/ready')
  const latencyMs = Math.round(performance.now() - start)
  return { data: result.data, requestId: result.requestId, latencyMs }
}

export async function fetchWhoami(token: string): Promise<{ data: WhoamiResponse; requestId: string | null }> {
  const result = await apiRequest<WhoamiResponse>('/api/v1/whoami', { token })
  return { data: result.data, requestId: result.requestId }
}
