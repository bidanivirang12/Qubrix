import { useState, useEffect } from 'react'
import { ToastProvider } from './context/ToastContext'
import { BackendProvider } from './context/BackendContext'
import { AuthProvider } from './context/AuthContext'
import { AppShell } from './components/layout/AppShell'
import { OverviewPage } from './pages/OverviewPage'
import { InventoryPage } from './pages/InventoryPage'
import { KeysPage } from './pages/KeysPage'
import { EventsPage } from './pages/EventsPage'
import { FindingsPage } from './pages/FindingsPage'
import { AssessmentsPage } from './pages/AssessmentsPage'
import { AuditPage } from './pages/AuditPage'
import { WhoamiPage } from './pages/WhoamiPage'
import { contractStore } from './services/contractStore'

export function AppContent() {
  const [currentRoute, setCurrentRoute] = useState<string>('overview')
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null)
  const [executionMode, setExecutionMode] = useState<'DIRECT_LIVE' | 'CONTRACT_SANDBOX'>('CONTRACT_SANDBOX')

  // URL Hash synchronization for back/forward navigation and deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '').replace('#', '')
      if (hash) {
        setCurrentRoute(hash)
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const navigateTo = (route: string) => {
    setCurrentRoute(route)
    window.location.hash = `#/${route}`
  }

  const renderCurrentPage = () => {
    switch (currentRoute) {
      case 'overview':
        return (
          <OverviewPage
            onNavigate={navigateTo}
            onSelectFinding={(id) => {
              setSelectedFindingId(id)
              navigateTo('findings')
            }}
          />
        )
      case 'inventory':
        return <InventoryPage executionMode={executionMode} />
      case 'keys':
        return <KeysPage executionMode={executionMode} />
      case 'events':
        return <EventsPage executionMode={executionMode} />
      case 'findings':
        return (
          <FindingsPage
            executionMode={executionMode}
            selectedFindingId={selectedFindingId}
          />
        )
      case 'assessments':
        return <AssessmentsPage executionMode={executionMode} />
      case 'audit':
        return <AuditPage executionMode={executionMode} />
      case 'whoami':
        return <WhoamiPage />
      default:
        return (
          <OverviewPage
            onNavigate={navigateTo}
            onSelectFinding={(id) => {
              setSelectedFindingId(id)
              navigateTo('findings')
            }}
          />
        )
    }
  }

  const findings = contractStore.getFindings()
  const assessments = contractStore.getAssessments()
  const keys = contractStore.getKeys()

  return (
    <AppShell
      currentRoute={currentRoute}
      onNavigate={navigateTo}
      executionMode={executionMode}
      onToggleExecutionMode={setExecutionMode}
      findingCount={findings.filter((f) => f.status !== 'RESOLVED').length}
      assessmentCount={assessments.length}
      keyCount={keys.length}
    >
      {renderCurrentPage()}
    </AppShell>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <BackendProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BackendProvider>
    </ToastProvider>
  )
}
