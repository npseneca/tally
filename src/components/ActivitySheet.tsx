import { useState } from 'react'
import { addActivity, updateActivity, type Activity } from '../db'
import { nextColor } from '../palette'
import { Sheet, Swatches } from './ui'

/** Create a new activity, or edit an existing one when `activity` is given. */
export function ActivitySheet({
  activity,
  usedColors,
  onClose,
}: {
  activity?: Activity
  usedColors: string[]
  onClose: () => void
}) {
  const [name, setName] = useState(activity?.name ?? '')
  const [color, setColor] = useState(activity?.color ?? nextColor(usedColors))

  const save = async () => {
    if (!name.trim()) return
    if (activity) await updateActivity(activity.id, { name: name.trim(), color })
    else await addActivity(name, color)
    onClose()
  }

  return (
    <Sheet title={activity ? 'Edit activity' : 'New activity'} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Reading"
            maxLength={40}
            autoFocus={!activity}
            enterKeyHint="done"
          />
        </label>
        <div className="field">
          <span>Color</span>
          <Swatches value={color} onChange={setColor} />
        </div>
        <button className="btn primary" type="submit" disabled={!name.trim()}>
          {activity ? 'Save' : 'Add activity'}
        </button>
        {activity && (
          <button
            className="btn quiet"
            type="button"
            onClick={async () => {
              await updateActivity(activity.id, { archived: !activity.archived })
              onClose()
            }}
          >
            {activity.archived ? 'Restore activity' : 'Archive activity'}
          </button>
        )}
        {activity && !activity.archived && (
          <p className="hint">Archiving hides it from the Today screen. Its history stays in your charts.</p>
        )}
      </form>
    </Sheet>
  )
}
