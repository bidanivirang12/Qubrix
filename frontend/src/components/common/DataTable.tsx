import React, { useState } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  render?: (row: T, index: number) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T, index: number) => string
  onRowClick?: (row: T) => void
  selectedRowKey?: string | null
  isLoading?: boolean
  emptyMessage?: string
  emptySubtext?: string
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedRowKey,
  isLoading = false,
  emptyMessage = 'No records found',
  emptySubtext,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else {
        setSortKey(null)
        setSortDirection('asc')
      }
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data

    return [...data].sort((a, b) => {
      const valA = a[sortKey]
      const valB = b[sortKey]

      if (valA === valB) return 0
      if (valA === null || valA === undefined) return 1
      if (valB === null || valB === undefined) return -1

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA
      }

      const strA = String(valA).toLowerCase()
      const strB = String(valB).toLowerCase()
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA)
    })
  }, [data, sortKey, sortDirection])

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        backgroundColor: 'var(--surface-main)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: 'var(--surface-nav)',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            {columns.map((col) => {
              const isSorted = sortKey === col.key
              return (
                <th
                  key={col.key}
                  onClick={() => col.sortable && handleSort(col.key)}
                  style={{
                    padding: '8px 12px',
                    color: isSorted ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    width: col.width,
                    textAlign: col.align || 'left',
                    cursor: col.sortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                    }}
                  >
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span style={{ color: isSorted ? 'var(--emerald-500)' : 'var(--text-muted)' }}>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ChevronUp size={13} />
                          ) : (
                            <ChevronDown size={13} />
                          )
                        ) : (
                          <ChevronsUpDown size={12} opacity={0.6} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '12px' }}>
                    <div
                      style={{
                        height: '14px',
                        backgroundColor: 'var(--surface-elevated)',
                        borderRadius: 'var(--radius-xs)',
                        animation: 'pulseSubtle 1.5s infinite ease-in-out',
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : sortedData.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {emptyMessage}
                </div>
                {emptySubtext && (
                  <div style={{ fontSize: '12px', marginTop: '4px', color: 'var(--text-muted)' }}>
                    {emptySubtext}
                  </div>
                )}
              </td>
            </tr>
          ) : (
            sortedData.map((row, index) => {
              const rowKey = keyExtractor(row, index)
              const isSelected = selectedRowKey === rowKey

              return (
                <tr
                  key={rowKey}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    backgroundColor: isSelected
                      ? 'var(--surface-active)'
                      : index % 2 === 1
                      ? 'rgba(255, 255, 255, 0.01)'
                      : 'transparent',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected && onRowClick) {
                      e.currentTarget.style.backgroundColor = 'var(--surface-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && onRowClick) {
                      e.currentTarget.style.backgroundColor =
                        index % 2 === 1 ? 'rgba(255, 255, 255, 0.01)' : 'transparent'
                    }
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '9px 12px',
                        textAlign: col.align || 'left',
                        color: 'var(--text-primary)',
                        verticalAlign: 'middle',
                      }}
                    >
                      {col.render ? col.render(row, index) : row[col.key]}
                    </td>
                  ))}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
