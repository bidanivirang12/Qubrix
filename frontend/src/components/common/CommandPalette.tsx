import React, { useState, useEffect, useRef } from 'react'
import { Search, Navigation, Shield, Key, FileText, CheckCircle2, History, User } from 'lucide-react'

interface CommandItem {
  id: string
  title: string
  subtitle: string
  category: 'Navigation' | 'Action'
  icon: React.ReactNode
  onSelect: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (route: string) => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: CommandItem[] = [
    {
      id: 'nav-overview',
      title: 'Overview & Cryptographic Posture',
      subtitle: 'View situational awareness, system health, and critical findings',
      category: 'Navigation',
      icon: <Shield size={16} />,
      onSelect: () => onNavigate('overview'),
    },
    {
      id: 'nav-inventory',
      title: 'Cryptographic Inventory & CBOM',
      subtitle: 'Inspect algorithms, protocols, PQC readiness, and generate CBOM',
      category: 'Navigation',
      icon: <FileText size={16} />,
      onSelect: () => onNavigate('inventory'),
    },
    {
      id: 'nav-keys',
      title: 'Key Management',
      subtitle: 'Provider-backed key references, key lifecycle states, and rotation',
      category: 'Navigation',
      icon: <Key size={16} />,
      onSelect: () => onNavigate('keys'),
    },
    {
      id: 'nav-events',
      title: 'Ingested Events & Verifications',
      subtitle: 'Inspect canonical JCS event payloads, nonces, and signature verification',
      category: 'Navigation',
      icon: <Navigation size={16} />,
      onSelect: () => onNavigate('events'),
    },
    {
      id: 'nav-findings',
      title: 'Security Findings',
      subtitle: 'Investigate replays, revoked keys, and security anomalies',
      category: 'Navigation',
      icon: <Shield size={16} />,
      onSelect: () => onNavigate('findings'),
    },
    {
      id: 'nav-assessments',
      title: 'Risk Assessments & Review',
      subtitle: 'TrustShield scores, decision overrides, and reason codes',
      category: 'Navigation',
      icon: <CheckCircle2 size={16} />,
      onSelect: () => onNavigate('assessments'),
    },
    {
      id: 'nav-audit',
      title: 'Tenant Audit Trail',
      subtitle: 'Inspect immutable tenant action records and actor attributions',
      category: 'Navigation',
      icon: <History size={16} />,
      onSelect: () => onNavigate('audit'),
    },
    {
      id: 'nav-whoami',
      title: 'Identity & Access (Whoami)',
      subtitle: 'Inspect JWT claims, validated principal, and role permission ceiling',
      category: 'Navigation',
      icon: <User size={16} />,
      onSelect: () => onNavigate('whoami'),
    },
  ]

  const filteredCommands = commands.filter((cmd) =>
    cmd.title.toLowerCase().includes(query.toLowerCase()) ||
    cmd.subtitle.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else onNavigate('') // trigger open
      }
      if (!isOpen) return

      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].onSelect()
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, filteredCommands, selectedIndex, onNavigate])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(9, 10, 10, 0.75)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Palette Box */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '560px',
          backgroundColor: 'var(--surface-elevated)',
          border: '1px solid var(--border-emphasis)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          zIndex: 2001,
          animation: 'fadeIn 120ms ease-out',
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-default)',
            backgroundColor: 'var(--surface-nav)',
          }}
        >
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Type a command or navigate to a module..."
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '14px',
            }}
          />
          <kbd
            style={{
              padding: '2px 6px',
              fontSize: '10px',
              color: 'var(--text-muted)',
              backgroundColor: 'var(--surface-main)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-xs)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '6px' }}>
          {filteredCommands.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No matching modules found
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = selectedIndex === idx
              return (
                <div
                  key={cmd.id}
                  onClick={() => {
                    cmd.onSelect()
                    onClose()
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: isSelected ? 'var(--surface-active)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  <span
                    style={{
                      color: isSelected ? 'var(--emerald-500)' : 'var(--text-muted)',
                      display: 'inline-flex',
                    }}
                  >
                    {cmd.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {cmd.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {cmd.subtitle}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {cmd.category}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer Hints */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-default)',
            backgroundColor: 'var(--surface-nav)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <span>Use ↑ and ↓ to navigate</span>
          <span>Press Enter to select</span>
        </div>
      </div>
    </div>
  )
}
