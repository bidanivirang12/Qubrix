import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { BackendHealthState } from '../types/health'
import { checkLiveness, checkReadiness, ProblemError } from '../services/api'

interface BackendContextValue {
  health: BackendHealthState
  refreshHealth: () => Promise<void>
}

const BackendContext = createContext<BackendContextValue | undefined>(undefined)

export const BackendProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [health, setHealth] = useState<BackendHealthState>({
    isLive: false,
    isReady: false,
    liveRequestId: null,
    readyRequestId: null,
    lastChecked: null,
    latencyMs: null,
    readyError: null,
    isChecking: false,
  })

  const refreshHealth = useCallback(async () => {
    setHealth((prev) => ({ ...prev, isChecking: true }))
    try {
      // 1. Check Liveness
      let isLive = false
      let liveRequestId: string | null = null
      let latencyMs = 0

      try {
        const liveResult = await checkLiveness()
        isLive = liveResult.data.status === 'ok'
        liveRequestId = liveResult.requestId
        latencyMs = liveResult.latencyMs
      } catch {
        isLive = false
      }

      // 2. Check Readiness
      let isReady = false
      let readyRequestId: string | null = null
      let readyError = null

      try {
        const readyResult = await checkReadiness()
        isReady = readyResult.data.status === 'ready'
        readyRequestId = readyResult.requestId
      } catch (err: unknown) {
        isReady = false
        if (err instanceof ProblemError) {
          readyError = err.problem
          readyRequestId = err.problem.request_id
        }
      }

      setHealth({
        isLive,
        isReady,
        liveRequestId,
        readyRequestId,
        lastChecked: new Date().toISOString(),
        latencyMs,
        readyError,
        isChecking: false,
      })
    } catch {
      setHealth((prev) => ({ ...prev, isChecking: false, isLive: false, isReady: false }))
    }
  }, [])

  useEffect(() => {
    refreshHealth()
    const interval = setInterval(refreshHealth, 15000)
    return () => clearInterval(interval)
  }, [refreshHealth])

  return (
    <BackendContext.Provider value={{ health, refreshHealth }}>
      {children}
    </BackendContext.Provider>
  )
}

export const useBackend = (): BackendContextValue => {
  const context = useContext(BackendContext)
  if (!context) {
    throw new Error('useBackend must be used within a BackendProvider')
  }
  return context
}
