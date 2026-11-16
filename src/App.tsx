import { useState } from 'react'
import { TimerGuard } from './components/TimerGuard'
import { Icon } from './components/ui'
import { useRunning } from './hooks'
import { Entries } from './screens/Entries'
import { Month } from './screens/Month'
import { Settings } from './screens/Settings'
import { Today } from './screens/Today'
import { Week } from './screens/Week'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'entries', label: 'Entries' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
] as const

type Tab = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const running = useRunning()

  return (
    <>
      <main>
        {tab === 'today' && <Today onOpenSettings={() => setSettingsOpen(true)} />}
        {tab === 'entries' && <Entries />}
        {tab === 'week' && <Week />}
        {tab === 'month' && <Month />}
      </main>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'tab' + (tab === t.id ? ' on' : '')}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id)
              window.scrollTo(0, 0)
            }}
          >
            <span className="tab-icon">
              <Icon name={t.id} />
              {t.id === 'today' && running && <i className="tab-badge" />}
            </span>
            {t.label}
          </button>
        ))}
      </nav>

      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      <TimerGuard />
    </>
  )
}
