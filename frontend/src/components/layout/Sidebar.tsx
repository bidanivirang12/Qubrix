import React from 'react'
import {
  LayoutDashboard,
  Boxes,
  KeyRound,
  FileCode2,
  AlertOctagon,
  ScrollText,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  badge?: string | number
  badgeColor?: string
  requiredRole?: string
  phase?: string
}

interface SidebarProps {
  currentRoute: string
  onNavigate: (route: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  findingCount?: number
  assessmentCount?: number
  keyCount?: number
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  findingCount = 4,
  assessmentCount = 4,
  keyCount = 4,
}) => {
  const { canReadAudit } = useAuth()

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Posture Overview',
      icon: <LayoutDashboard size={17} />,
    },
    {
      id: 'inventory',
      label: 'Inventory & CBOM',
      icon: <Boxes size={17} />,
      badge: 'PQC',
      badgeColor: 'var(--purple-500)',
    },
    {
      id: 'keys',
      label: 'Key Registry',
      icon: <KeyRound size={17} />,
      badge: keyCount,
    },
    {
      id: 'events',
      label: 'Events & Nonces',
      icon: <FileCode2 size={17} />,
    },
    {
      id: 'findings',
      label: 'Security Findings',
      icon: <AlertOctagon size={17} />,
      badge: findingCount,
      badgeColor: 'var(--crimson-500)',
    },
    {
      id: 'assessments',
      label: 'Trust & Risk Reviews',
      icon: <FileCode2 size={17} />,
      badge: assessmentCount,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: <ScrollText size={17} />,
      requiredRole: 'ADMIN or AUDITOR',
    },
    {
      id: 'whoami',
      label: 'Whoami & OIDC',
      icon: <UserCheck size={17} />,
      badge: 'Live',
      badgeColor: 'var(--emerald-500)',
      phase: '3a',
    },
  ]

  return (
    <aside
      style={{
        width: isCollapsed ? '56px' : '230px',
        backgroundColor: 'var(--surface-nav)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width var(--transition-normal)',
        position: 'relative',
        zIndex: 800,
      }}
    >
      {/* Top: Nav Menu */}
      <div style={{ padding: '12px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {navItems.map((item) => {
            const isActive = currentRoute === item.id
            const isAuditorRestricted = item.id === 'audit' && !canReadAudit

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                disabled={isAuditorRestricted}
                title={isCollapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: isCollapsed ? '10px 0' : '8px 10px',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: isActive ? 'var(--surface-active)' : 'transparent',
                  color: isActive
                    ? 'var(--emerald-500)'
                    : isAuditorRestricted
                    ? 'var(--text-muted)'
                    : 'var(--text-secondary)',
                  opacity: isAuditorRestricted ? 0.45 : 1,
                  cursor: isAuditorRestricted ? 'not-allowed' : 'pointer',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '13px',
                  transition: 'all var(--transition-fast)',
                  border: isActive ? '1px solid var(--border-emphasis)' : '1px solid transparent',
                  position: 'relative',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                )}

                {!isCollapsed && item.badge !== undefined && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: 'var(--surface-elevated)',
                      color: item.badgeColor || 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom: Collapse toggle & quick spec ref */}
      <div
        style={{
          padding: '12px 8px',
          borderTop: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {!isCollapsed && (
          <div
            style={{
              padding: '8px',
              backgroundColor: 'var(--surface-main)',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid var(--border-subtle)',
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              <Database size={12} />
              <span>Contract Gateway</span>
            </div>
            <div>Phase 3a OIDC: Active</div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Docs: docs/api-contracts.md</div>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: '6px 8px',
            borderRadius: 'var(--radius-xs)',
            color: 'var(--text-muted)',
            fontSize: '12px',
          }}
        >
          {!isCollapsed && <span>Collapse Sidebar</span>}
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  )
}
