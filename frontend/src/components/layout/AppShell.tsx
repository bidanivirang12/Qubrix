import React, { useState } from 'react'
import { TopBar } from './TopBar'
import { Sidebar } from './Sidebar'
import { CommandPalette } from '../common/CommandPalette'

interface AppShellProps {
  children: React.ReactNode
  currentRoute: string
  onNavigate: (route: string) => void
  executionMode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX'
  onToggleExecutionMode: (mode: 'DIRECT_LIVE' | 'CONTRACT_SANDBOX') => void
  findingCount?: number
  assessmentCount?: number
  keyCount?: number
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentRoute,
  onNavigate,
  executionMode,
  onToggleExecutionMode,
  findingCount,
  assessmentCount,
  keyCount,
}) => {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-obsidian)',
      }}
    >
      {/* Persistent Global Header */}
      <TopBar
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onNavigate={onNavigate}
        currentRoute={currentRoute}
        executionMode={executionMode}
        onToggleExecutionMode={onToggleExecutionMode}
      />

      {/* Main App Layout: Sidebar + Main Content Region */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          currentRoute={currentRoute}
          onNavigate={onNavigate}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          findingCount={findingCount}
          assessmentCount={assessmentCount}
          keyCount={keyCount}
        />

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-obsidian)',
          }}
        >
          {children}
        </main>
      </div>

      {/* Cmd/Ctrl+K Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={onNavigate}
      />
    </div>
  )
}
