// RFC 9457 Problem Details for HTTP APIs

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  instance?: string
  code: string
  request_id: string
  retry_after?: string
  invalid_params?: Array<{
    name: string
    reason: string
  }>
}
