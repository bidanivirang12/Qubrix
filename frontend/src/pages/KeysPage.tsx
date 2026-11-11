import React, { useState } from 'react'
import { RotateCcw, Ban, Lock } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { DataTable } from '../components/common/DataTable'
import type { Column } from '../components/common/DataTable'
import { Modal } from '../components/common/Modal'
import { CryptoIdentifier } from '../components/common/CryptoIdentifier'
import { ProblemAlert } from '../components/common/ProblemAlert'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { contractStore } from '../services/contractStore'
import { apiRequest, ProblemError } from '../services/api'
import type { KeyRecord } from '../types/keys'
import type { ProblemDetails } from '../types/problem'

interface KeysPageProps {
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
}

export const KeysPage: React.FC<KeysPageProps> = ({ executionMode }) => {
  const { principal, canManageKeys } = useAuth()
  const { showToast } = useToast()

  const [keys, setKeys] = useState<KeyRecord[]>(contractStore.getKeys())
  const [keyToRotate, setKeyToRotate] = useState<KeyRecord | null>(null)
  const [keyToDisable, setKeyToDisable] = useState<KeyRecord | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<ProblemDetails | null>(null)

  const handleRotateConfirm = async () => {
    if (!keyToRotate) return
    if (!canManageKeys) {
      showToast('Permission denied: ADMIN role with keys:write required', 'error')
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    if (executionMode === 'DIRECT_LIVE') {
      try {
        await apiRequest(`/api/v1/keys/${keyToRotate.key_id}/rotate`, {
          method: 'POST',
          body: JSON.stringify({
            schema_version: 1,
            correlation_id: crypto.randomUUID(),
          }),
        })
        showToast(`Rotation requested for ${keyToRotate.key_id}`, 'success')
        setKeyToRotate(null)
      } catch (err: unknown) {
        if (err instanceof ProblemError) {
          setApiError(err.problem)
        } else {
          showToast('Failed to execute live key rotation', 'error')
        }
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setTimeout(() => {
        try {
          contractStore.rotateKey(keyToRotate.key_id, principal.subject)
          setKeys(contractStore.getKeys())
          showToast(`Key ${keyToRotate.key_id} rotated successfully`, 'success')
          setKeyToRotate(null)
        } catch (err: any) {
          showToast(err.message, 'error')
        } finally {
          setIsSubmitting(false)
        }
      }, 400)
    }
  }

  const handleDisableConfirm = async () => {
    if (!keyToDisable) return
    if (!canManageKeys) {
      showToast('Permission denied: ADMIN role with keys:write required', 'error')
      return
    }

    setIsSubmitting(true)
    setApiError(null)

    if (executionMode === 'DIRECT_LIVE') {
      try {
        await apiRequest(`/api/v1/keys/${keyToDisable.key_id}/disable`, {
          method: 'POST',
          body: JSON.stringify({
            schema_version: 1,
            correlation_id: crypto.randomUUID(),
          }),
        })
        showToast(`Key disabled live: ${keyToDisable.key_id}`, 'success')
        setKeyToDisable(null)
      } catch (err: unknown) {
        if (err instanceof ProblemError) {
          setApiError(err.problem)
        } else {
          showToast('Failed to execute live key disable', 'error')
        }
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setTimeout(() => {
        try {
          contractStore.disableKey(keyToDisable.key_id, principal.subject)
          setKeys(contractStore.getKeys())
          showToast(`Key ${keyToDisable.key_id} disabled. Replays or signatures will now be rejected.`, 'warning')
          setKeyToDisable(null)
        } catch (err: any) {
          showToast(err.message, 'error')
        } finally {
          setIsSubmitting(false)
        }
      }, 400)
    }
  }

  const columns: Column<KeyRecord>[] = [
    {
      key: 'key_id',
      header: 'Key Reference ID',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
            {row.key_id}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {row.provider_ref}
          </span>
        </div>
      ),
    },
    {
      key: 'algorithm',
      header: 'Algorithm',
      width: '180px',
      sortable: true,
      render: (row) => (
        <Badge variant={row.algorithm === 'ED25519' ? 'valid' : 'neutral'}>
          {row.algorithm}
        </Badge>
      ),
    },
    {
      key: 'fingerprint',
      header: 'Public Fingerprint (SHA-256)',
      render: (row) => <CryptoIdentifier value={row.fingerprint} truncateLength={10} />,
    },
    {
      key: 'lifecycle',
      header: 'Lifecycle Status',
      width: '140px',
      sortable: true,
      render: (row) => {
        let variant: 'valid' | 'invalid' | 'warning' | 'neutral' = 'neutral'
        if (row.lifecycle === 'ACTIVE') variant = 'valid'
        else if (row.lifecycle === 'REVOKED' || row.lifecycle === 'DISABLED') variant = 'invalid'
        else if (row.lifecycle.includes('REQUESTED')) variant = 'warning'

        return <Badge variant={variant}>{row.lifecycle}</Badge>
      },
    },
    {
      key: 'created_at',
      header: 'Registered',
      width: '120px',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {row.created_at.slice(0, 10)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: '180px',
      align: 'right',
      render: (row) => {
        const isOperational = row.lifecycle === 'ACTIVE'
        return (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
            <Button
              variant="outline"
              size="sm"
              icon={<RotateCcw size={12} />}
              disabled={!isOperational || !canManageKeys}
              onClick={(e) => {
                e.stopPropagation()
                setKeyToRotate(row)
              }}
              title={
                !canManageKeys
                  ? 'ADMIN role with keys:write required'
                  : !isOperational
                  ? 'Key is not active'
                  : 'Rotate key via KMS/HSM provider'
              }
            >
              Rotate
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Ban size={12} />}
              disabled={!isOperational || !canManageKeys}
              onClick={(e) => {
                e.stopPropagation()
                setKeyToDisable(row)
              }}
              title={
                !canManageKeys
                  ? 'ADMIN role with keys:write required'
                  : !isOperational
                  ? 'Key is already disabled/revoked'
                  : 'Disable key immediately'
              }
            >
              Disable
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="Tenant Key Registry &amp; Lifecycle"
        subtitle="Provider-backed non-secret cryptographic key references. Private and secret keys are stored exclusively in approved KMS/HSM providers and never exposed."
        breadcrumb="Cryptographic Security / Key Registry"
        badgeText={executionMode === 'DIRECT_LIVE' ? 'Live API Proxy: /api/v1/keys' : 'Contract Mode: ADR-0006'}
        badgeVariant={executionMode === 'DIRECT_LIVE' ? 'valid' : 'info'}
      />

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {apiError && <ProblemAlert problem={apiError} />}

        {!canManageKeys && (
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
              Current identity (<strong style={{ color: 'var(--text-primary)' }}>{principal.roles.join(', ')}</strong>) has read-only access to key metadata. Key rotation and disable actions require the{' '}
              <strong style={{ color: 'var(--text-primary)' }}>ADMIN</strong> role with <code style={{ color: 'var(--text-secondary)' }}>keys:write</code> scope.
            </span>
          </div>
        )}

        <DataTable
          columns={columns}
          data={keys}
          keyExtractor={(row) => row.id}
          emptyMessage="No cryptographic keys registered."
        />
      </div>

      {/* Rotate Key Confirmation Dialog */}
      <Modal
        isOpen={keyToRotate !== null}
        onClose={() => setKeyToRotate(null)}
        title="Confirm Key Rotation"
        subtitle={`Target Key: ${keyToRotate?.key_id}`}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={() => setKeyToRotate(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleRotateConfirm}
              isLoading={isSubmitting}
            >
              Confirm Rotation
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>
            You are initiating a provider-backed key rotation for{' '}
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {keyToRotate?.key_id}
            </strong>.
          </p>
          <div
            style={{
              backgroundColor: 'var(--surface-main)',
              padding: '10px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-default)',
              fontSize: '12px',
              color: 'var(--text-muted)',
            }}
          >
            <div>Provider: {keyToRotate?.provider_ref}</div>
            <div>Algorithm: {keyToRotate?.algorithm}</div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            Existing signed events and nonces verified under the previous key version will remain immutable. New signatures will be bound to the rotated key reference.
          </p>
        </div>
      </Modal>

      {/* Disable Key Danger Confirmation Dialog */}
      <Modal
        isOpen={keyToDisable !== null}
        onClose={() => setKeyToDisable(null)}
        title="Disable Cryptographic Key"
        subtitle={`Target Key: ${keyToDisable?.key_id}`}
        isDanger={true}
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" onClick={() => setKeyToDisable(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDisableConfirm}
              isLoading={isSubmitting}
            >
              Disable Key Immediately
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              backgroundColor: 'var(--crimson-bg)',
              border: '1px solid var(--crimson-border)',
              borderRadius: 'var(--radius-xs)',
              padding: '12px',
              color: 'var(--crimson-500)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Warning: Disabling this key takes effect immediately. Future signature verification attempts referencing this key will fail with status KEY_DISABLED and record security findings.
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            Are you sure you want to disable{' '}
            <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              {keyToDisable?.key_id}
            </strong>?
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
            This action is recorded in the immutable tenant audit log with your actor subject attribution.
          </p>
        </div>
      </Modal>
    </div>
  )
}
