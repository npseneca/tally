import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { ActivitySheet } from '../components/ActivitySheet'
import { Icon, Sheet } from '../components/ui'
import { db, swapActivityOrder, updateSettings, type Activity } from '../db'
import { exportCsv, exportJson, importJson } from '../exporter'
import { useActivities, useNow, useSettings } from '../hooks'
import { signIn, signOut, signUp, syncNow, useSync } from '../sync'

function Account() {
  const sync = useSync()
  const now = useNow(10_000)
  const pending = useLiveQuery(
    async () => (await db.activities.where('dirty').equals(1).count()) + (await db.entries.where('dirty').equals(1).count()),
    [],
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmOut, setConfirmOut] = useState(false)

  if (!sync.ready) return <p className="hint">Checking your account…</p>

  if (sync.user) {
    let status = 'Synced'
    if (sync.status === 'syncing') status = 'Syncing…'
    else if (sync.status === 'error') status = sync.error === 'Offline' ? 'Offline' : `Sync problem: ${sync.error}`
    else if (sync.lastSynced) {
      const s = Math.round((now - sync.lastSynced) / 1000)
      status = s < 60 ? 'Synced just now' : `Synced ${Math.round(s / 60)} min ago`
    }
    return (
      <>
        <p className="lead">
          Signed in as <strong>{sync.user.email}</strong>
        </p>
        <p className={'hint' + (sync.status === 'error' && sync.error !== 'Offline' ? ' error' : '')}>
          {status}
          {pending ? ` · ${pending} change${pending === 1 ? '' : 's'} waiting to upload` : ''}
        </p>
        <button className="btn" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
          Sync now
        </button>
        {confirmOut ? (
          <>
            <p className="hint">
              Signing out removes the data from this device. It stays in your account.
              {pending ? ` ${pending} change${pending === 1 ? ' has' : 's have'} not uploaded yet and would be lost.` : ''}
            </p>
            <button className="btn danger" onClick={() => void signOut()}>
              Sign out and clear this device
            </button>
          </>
        ) : (
          <button className="btn quiet" onClick={() => setConfirmOut(true)}>
            Sign out
          </button>
        )}
      </>
    )
  }

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    const err = mode === 'in' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    setMessage(err)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <p className="hint">
        Sign in to back up your data and use it on your other devices. Anything already tracked on this device is kept.
      </p>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {message && <p className="error">{message}</p>}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>
      <button
        className="btn quiet"
        type="button"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setMessage(null)
        }}
      >
        {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
      </button>
    </form>
  )
}

function Activities() {
  const all = useActivities()
  const [editing, setEditing] = useState<Activity | 'new' | null>(null)
  if (!all) return null
  const active = all.filter((a) => !a.archived)
  const archived = all.filter((a) => a.archived)

  const row = (a: Activity, i: number, list: Activity[], movable: boolean) => (
    <div key={a.id} className="manage-row" style={{ '--c': a.color } as React.CSSProperties}>
      <button className="manage-name" onClick={() => setEditing(a)}>
        <i className="dot" />
        {a.name}
      </button>
      {movable && (
        <>
          <button
            className="icon-btn"
            disabled={i === 0}
            aria-label={`Move ${a.name} up`}
            onClick={() => void swapActivityOrder(a, list[i - 1])}
          >
            <Icon name="up" size={18} />
          </button>
          <button
            className="icon-btn"
            disabled={i === list.length - 1}
            aria-label={`Move ${a.name} down`}
            onClick={() => void swapActivityOrder(a, list[i + 1])}
          >
            <Icon name="down" size={18} />
          </button>
        </>
      )}
    </div>
  )

  return (
    <>
      {active.map((a, i) => row(a, i, active, true))}
      {active.length === 0 && <p className="hint">No activities yet.</p>}
      <button className="btn" onClick={() => setEditing('new')}>
        Add activity
      </button>
      {archived.length > 0 && (
        <>
          <p className="section-label">Archived</p>
          {archived.map((a, i) => row(a, i, archived, false))}
        </>
      )}
      {editing && (
        <ActivitySheet
          activity={editing === 'new' ? undefined : editing}
          usedColors={all.map((a) => a.color)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function Data() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const n = await importJson(await file.text())
      setMessage(`Imported ${n.entries} entries and ${n.activities} activities.`)
      void syncNow()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'That file could not be read.')
    }
    if (fileInput.current) fileInput.current.value = ''
  }

  return (
    <>
      <div className="btn-row">
        <button className="btn" onClick={() => void exportJson()}>
          Export backup
        </button>
        <button className="btn" onClick={() => void exportCsv()}>
          Export CSV
        </button>
      </div>
      <button className="btn quiet" onClick={() => fileInput.current?.click()}>
        Import a backup
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {message && <p className="hint">{message}</p>}
    </>
  )
}

export function Settings({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const setGuard = (h: number) => void updateSettings({ guardHours: Math.min(24, Math.max(1, h)) })

  return (
    <Sheet title="Settings" onClose={onClose}>
      <h3 className="settings-title">Account</h3>
      <Account />

      <h3 className="settings-title">Activities</h3>
      <Activities />

      <h3 className="settings-title">Forgotten timers</h3>
      <div className="stepper-row">
        <span>Ask if a timer runs longer than</span>
        <div className="stepper">
          <button onClick={() => setGuard(settings.guardHours - 1)} disabled={settings.guardHours <= 1} aria-label="Fewer hours">
            −
          </button>
          <output>
            {settings.guardHours} {settings.guardHours === 1 ? 'hour' : 'hours'}
          </output>
          <button onClick={() => setGuard(settings.guardHours + 1)} disabled={settings.guardHours >= 24} aria-label="More hours">
            +
          </button>
        </div>
      </div>

      <h3 className="settings-title">Your data</h3>
      <Data />
    </Sheet>
  )
}
