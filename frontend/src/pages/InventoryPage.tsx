import React, { useState } from 'react'
import { FileCode, Download, Filter } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/common/Button'
import { Badge } from '../components/common/Badge'
import { DataTable } from '../components/common/DataTable'
import type { Column } from '../components/common/DataTable'
import { Drawer } from '../components/common/Drawer'
import { CryptoIdentifier } from '../components/common/CryptoIdentifier'
import { ProblemAlert } from '../components/common/ProblemAlert'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { contractStore } from '../services/contractStore'
import { apiRequest, ProblemError } from '../services/api'
import type { InventoryAsset } from '../types/inventory'
import type { CbomSnapshot } from '../types/cbom'
import type { ProblemDetails } from '../types/problem'

interface InventoryPageProps {
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ executionMode }) => {
  const { principal, canGenerateCbom } = useAuth()
  const { showToast } = useToast()

  const [inventory] = useState<InventoryAsset[]>(contractStore.getInventory())
  const [cboms, setCboms] = useState<CbomSnapshot[]>(contractStore.getCboms())
  const [selectedAsset, setSelectedAsset] = useState<InventoryAsset | null>(null)
  const [selectedCbom, setSelectedCbom] = useState<CbomSnapshot | null>(null)
  const [filterReadiness, setFilterReadiness] = useState<string>('ALL')
  const [isGenerating, setIsGenerating] = useState(false)
  const [apiError, setApiError] = useState<ProblemDetails | null>(null)
  const [activeTab, setActiveTab] = useState<'inventory' | 'cbom'>('inventory')

  const filteredAssets = inventory.filter((asset) => {
    if (filterReadiness === 'ALL') return true
    return asset.pqc_readiness === filterReadiness
  })

  const handleGenerateCbom = async () => {
    if (!canGenerateCbom) {
      showToast('Permission denied: cbom:generate scope required', 'error')
      return
    }

    setIsGenerating(true)
    setApiError(null)

    if (executionMode === 'DIRECT_LIVE') {
      try {
        const result = await apiRequest<any>('/api/v1/cboms/generate', {
          method: 'POST',
          body: JSON.stringify({
            schema_version: 1,
            correlation_id: crypto.randomUUID(),
          }),
        })
        showToast(`CBOM generated live: ${result.data.snapshot_ref}`, 'success')
      } catch (err: unknown) {
        if (err instanceof ProblemError) {
          setApiError(err.problem)
        } else {
          showToast('Failed to call live backend /api/v1/cboms/generate', 'error')
        }
      } finally {
        setIsGenerating(false)
      }
    } else {
      setTimeout(() => {
        try {
          const snapshot = contractStore.generateCbom(principal.subject)
          setCboms(contractStore.getCboms())
          setSelectedCbom(snapshot)
          setActiveTab('cbom')
          showToast(`Generated snapshot ${snapshot.snapshot_ref}`, 'success')
        } catch (err: any) {
          showToast(err.message, 'error')
        } finally {
          setIsGenerating(false)
        }
      }, 500)
    }
  }

  const columns: Column<InventoryAsset>[] = [
    {
      key: 'asset_ref',
      header: 'Asset Reference',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {row.asset_ref}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.usage_context}</span>
        </div>
      ),
    },
    {
      key: 'asset_type',
      header: 'Type',
      width: '130px',
      sortable: true,
      render: (row) => (
        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
          {row.asset_type}
        </span>
      ),
    },
    {
      key: 'algorithm',
      header: 'Algorithm & Parameters',
      sortable: true,
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            {row.algorithm}
          </span>
          {row.key_size_bits && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              ({row.key_size_bits}b)
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'protocol',
      header: 'Protocol & Library',
      render: (row) => (
        <div style={{ fontSize: '12px' }}>
          <div>{row.protocol || '—'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {row.library || 'Native Provider'}
          </div>
        </div>
      ),
    },
    {
      key: 'pqc_readiness',
      header: 'PQC Readiness',
      width: '180px',
      sortable: true,
      render: (row) => {
        let variant: 'pqc' | 'pqc-trans' | 'warning' | 'neutral' = 'neutral'
        let label = 'Classical Vulnerable'

        if (row.pqc_readiness === 'POST_QUANTUM_READY') {
          variant = 'pqc'
          label = 'PQC Ready (FIPS 203/204)'
        } else if (row.pqc_readiness === 'TRANSITIONING') {
          variant = 'pqc-trans'
          label = 'Transitioning'
        } else if (row.pqc_readiness === 'CLASSICAL_VULNERABLE') {
          variant = 'warning'
          label = 'Classical Vulnerable'
        }

        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      key: 'last_scanned_at',
      header: 'Scanned',
      width: '110px',
      render: (row) => (
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {row.last_scanned_at.slice(0, 10)}
        </span>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title="Cryptographic Asset Inventory & CBOM"
        subtitle="Catalog of active cryptographic algorithms, key lengths, certificates, and Cryptographic Bill of Materials (CBOM) snapshots."
        breadcrumb="Inventory / Cryptographic Assets"
        badgeText={executionMode === 'DIRECT_LIVE' ? 'Live API Proxy: /api/v1/cboms' : 'Contract Mode: ADR-0007'}
        badgeVariant={executionMode === 'DIRECT_LIVE' ? 'valid' : 'info'}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="primary"
              size="sm"
              icon={<FileCode size={14} />}
              onClick={handleGenerateCbom}
              isLoading={isGenerating}
              disabled={!canGenerateCbom}
              title={canGenerateCbom ? 'Generate versioned CBOM snapshot' : 'Requires ADMIN or SECURITY_ANALYST role'}
            >
              Generate CBOM Snapshot
            </Button>
          </div>
        }
      />

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {apiError && <ProblemAlert problem={apiError} onRetry={handleGenerateCbom} />}

        {/* View Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', paddingBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setActiveTab('inventory')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === 'inventory' ? 'var(--emerald-500)' : 'var(--text-muted)',
                backgroundColor: activeTab === 'inventory' ? 'var(--surface-elevated)' : 'transparent',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'inventory' ? '1px solid var(--border-emphasis)' : '1px solid transparent',
              }}
            >
              Cryptographic Primitives ({inventory.length})
            </button>
            <button
              onClick={() => setActiveTab('cbom')}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: activeTab === 'cbom' ? 'var(--emerald-500)' : 'var(--text-muted)',
                backgroundColor: activeTab === 'cbom' ? 'var(--surface-elevated)' : 'transparent',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'cbom' ? '1px solid var(--border-emphasis)' : '1px solid transparent',
              }}
            >
              CBOM Snapshots ({cboms.length})
            </button>
          </div>

          {activeTab === 'inventory' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={13} style={{ color: 'var(--text-muted)' }} />
              <select
                value={filterReadiness}
                onChange={(e) => setFilterReadiness(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-elevated)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  padding: '4px 8px',
                  outline: 'none',
                }}
              >
                <option value="ALL">All Readiness Classes</option>
                <option value="POST_QUANTUM_READY">Post-Quantum Ready (ML-KEM / ML-DSA)</option>
                <option value="TRANSITIONING">Transitioning</option>
                <option value="CLASSICAL_VULNERABLE">Classical Vulnerable (RSA / ECDSA)</option>
              </select>
            </div>
          )}
        </div>

        {activeTab === 'inventory' ? (
          <DataTable
            columns={columns}
            data={filteredAssets}
            keyExtractor={(row) => row.id}
            onRowClick={(row) => setSelectedAsset(row)}
            selectedRowKey={selectedAsset?.id}
            emptyMessage="No cryptographic assets match the selected filter."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {cboms.map((snap) => (
              <div
                key={snap.id}
                onClick={() => setSelectedCbom(snap)}
                style={{
                  backgroundColor: 'var(--surface-main)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'background-color var(--transition-fast)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-main)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <FileCode size={20} style={{ color: 'var(--purple-500)' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                        {snap.snapshot_ref}
                      </span>
                      <Badge variant="pqc">{snap.format_version}</Badge>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                      Digest: {snap.digest.slice(0, 32)}... • Components: {snap.algorithm_count} • PQC Ready: {snap.pqc_ready_count}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    As-of: {snap.inventory_as_of.replace('T', ' ').slice(0, 19)} UTC
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--emerald-500)', fontWeight: 600 }}>
                    Inspect JSON →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asset Inspection Drawer */}
      <Drawer
        isOpen={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        title={selectedAsset?.asset_ref || 'Asset Details'}
        subtitle={`Cryptographic Asset: ${selectedAsset?.asset_type}`}
        width="480px"
      >
        {selectedAsset && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Algorithm Primitive
              </div>
              <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                {selectedAsset.algorithm}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Key Length
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {selectedAsset.key_size_bits ? `${selectedAsset.key_size_bits} bits` : 'Not Applicable'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Curve / Mode
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                  {selectedAsset.curve || 'None'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Transport Protocol
                </div>
                <div>{selectedAsset.protocol || 'Direct Cryptographic Primitive'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                  Underlying Library
                </div>
                <div style={{ fontFamily: 'var(--font-mono)' }}>{selectedAsset.library || 'Native Provider'}</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Post-Quantum Security Assessment
              </div>
              <div style={{ marginTop: '4px' }}>
                <Badge variant={selectedAsset.pqc_readiness === 'POST_QUANTUM_READY' ? 'pqc' : selectedAsset.pqc_readiness === 'TRANSITIONING' ? 'pqc-trans' : 'warning'}>
                  {selectedAsset.pqc_readiness}
                </Badge>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                {selectedAsset.pqc_readiness === 'POST_QUANTUM_READY'
                  ? 'Compliant with FIPS 203 / FIPS 204 post-quantum standards. Not vulnerable to Shor’s algorithm factorization.'
                  : selectedAsset.pqc_readiness === 'TRANSITIONING'
                  ? 'Hybrid candidate. Classical parameters deployed with PQC transition timeline scheduled.'
                  : 'Vulnerable to cryptanalytically relevant quantum computers (CRQC). Prioritize replacement with ML-KEM / ML-DSA.'}
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                Operational Usage Context
              </div>
              <div style={{ marginTop: '4px', color: 'var(--text-primary)' }}>
                {selectedAsset.usage_context}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* CBOM JSON Document Drawer */}
      <Drawer
        isOpen={selectedCbom !== null}
        onClose={() => setSelectedCbom(null)}
        title={selectedCbom?.snapshot_ref || 'CBOM Snapshot'}
        subtitle={`Format Version: ${selectedCbom?.format_version}`}
        width="600px"
        footer={
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => {
              const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(selectedCbom?.document, null, 2))
              const downloadAnchor = document.createElement('a')
              downloadAnchor.setAttribute('href', dataStr)
              downloadAnchor.setAttribute('download', `${selectedCbom?.snapshot_ref}.json`)
              document.body.appendChild(downloadAnchor)
              downloadAnchor.click()
              downloadAnchor.remove()
              showToast('Exported CBOM document', 'success')
            }}
          >
            Export JSON
          </Button>
        }
      >
        {selectedCbom && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                backgroundColor: 'var(--surface-main)',
                padding: '12px',
                borderRadius: 'var(--radius-xs)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Inventory Version: </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{selectedCbom.inventory_version}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>SHA-256 Digest: </span>
                <CryptoIdentifier value={selectedCbom.digest} truncateLength={14} />
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                SPDX 3.0 / CycloneDX Compatible Manifest
              </div>
              <pre
                style={{
                  backgroundColor: 'var(--surface-nav)',
                  padding: '14px',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border-default)',
                  fontSize: '11px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  maxHeight: '400px',
                }}
              >
                {JSON.stringify(selectedCbom.document, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
