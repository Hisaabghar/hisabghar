import { useState } from 'react'
import { deleteField } from 'firebase/firestore'
import type { Note, Repeat } from '../types'
import { notesCol } from '../lib/paths'
import { addItem, patchItem, removeItem, type LiveQuery } from '../hooks/useData'
import { askNotifyPermission, calendarLink, nowMs } from '../lib/noteAlarms'
import { registerPeriodic } from '../lib/bills'
import { ConfirmDelete, Field, Segmented } from './ui/kit'
import { Sheet } from './ui/Sheet'

const COLORS = ['', '#FEF3C7', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#EDE9FE', '#FFE4E6']
const REPEAT_LABEL: Record<Repeat, string> = { none: 'Once', daily: 'Every day', weekly: 'Every week', monthly: 'Every month' }

const pad = (n: number) => String(n).padStart(2, '0')
const toDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const toTime = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export const whenText = (ms: number) =>
  new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })

export function NotesPage({ uid, notes }: { uid: string; notes: LiveQuery<Note> }) {
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Note | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Note | null>(null)
  const now = nowMs()
  const match = (n: Note) => !q.trim() || `${n.title} ${n.text}`.toLowerCase().includes(q.trim().toLowerCase())
  const all = notes.items.filter(match).sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  const upcoming = all.filter((n) => n.remindAt && !n.notified).sort((a, b) => a.remindAt! - b.remindAt!)
  const pinned = all.filter((n) => n.pinned && !upcoming.includes(n))
  const rest = all.filter((n) => !n.pinned && !upcoming.includes(n))

  const grid = (list: Note[]) => (
    <div className="noteGrid">
      {list.map((n) => (
        <div
          key={n.id}
          role="button"
          className="noteCard"
          style={n.color ? { background: n.color, color: '#1f2937' } : undefined}
          onClick={() => setEditing(n)}
        >
          {n.pinned && <span className="notePin">📌</span>}
          {n.title && <div className="noteTitle">{n.title}</div>}
          {n.text && <div className="noteText">{n.text}</div>}
          {n.remindAt && (
            <div className={`noteWhen ${!n.notified && n.remindAt < now ? 'late' : ''} ${n.notified ? 'done' : ''}`}>
              ⏰ {whenText(n.remindAt)}
              {n.repeat && n.repeat !== 'none' ? ` · ${REPEAT_LABEL[n.repeat].toLowerCase()}` : ''}
              {n.notified ? ' · done' : ''}
            </div>
          )}
          <div className="noteActions">
            <button
              className="noteAct"
              onClick={(e) => {
                e.stopPropagation()
                setEditing(n)
              }}
            >
              ✏️ Edit
            </button>
            <button
              className="noteAct del"
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(n)
              }}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="notesPage">
      <div className="pageHead">
        <h1 className="pageTitle">📝 Notes</h1>
        <button className="btnPrimary" onClick={() => setEditing('new')}>
          ＋ New note
        </button>
      </div>
      <input className="noteSearch" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search notes…" />
      {notes.error && <div className="errorBanner">{notes.error}</div>}
      {all.length === 0 && (
        <div className="empty">
          {q ? 'No notes match your search.' : 'No notes yet. Tap “＋ New note” to write something — add an alarm and it will remind you.'}
        </div>
      )}
      {upcoming.length > 0 && (
        <>
          <div className="noteHead">⏰ Reminders</div>
          {grid(upcoming)}
        </>
      )}
      {pinned.length > 0 && (
        <>
          <div className="noteHead">📌 Pinned</div>
          {grid(pinned)}
        </>
      )}
      {rest.length > 0 && (
        <>
          {(upcoming.length > 0 || pinned.length > 0) && <div className="noteHead">All notes</div>}
          {grid(rest)}
        </>
      )}
      {editing && <NoteSheet uid={uid} note={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <ConfirmDelete
          what={`Delete the note “${deleting.title || deleting.text.slice(0, 30)}”? Its alarm is removed too.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => removeItem(notesCol(uid), deleting.id)}
        />
      )}
    </div>
  )
}

function NoteSheet({ uid, note, onClose }: { uid: string; note: Note | null; onClose: () => void }) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [text, setText] = useState(note?.text ?? '')
  const [color, setColor] = useState(note?.color ?? '')
  const [pinned, setPinned] = useState(!!note?.pinned)
  const [alarm, setAlarm] = useState(!!note?.remindAt)
  const init = note?.remindAt ?? nowMs() + 60 * 60 * 1000
  const [date, setDate] = useState(toDate(init))
  const [time, setTime] = useState(toTime(init))
  const [repeat, setRepeat] = useState<Repeat>(note?.repeat ?? 'none')
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState<{ title: string; text: string; remindAt: number; repeat: Repeat } | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const remindAt = new Date(`${date}T${time || '09:00'}`).getTime()
  const canSave = (title.trim() || text.trim()) && (!alarm || !Number.isNaN(remindAt))

  const quick = (ms: number) => {
    setDate(toDate(ms))
    setTime(toTime(ms))
  }
  const tomorrow9 = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.getTime()
  }

  async function save() {
    const data = {
      title: title.trim(),
      text: text.trim(),
      pinned,
      color,
      updatedAt: nowMs(),
      ...(alarm ? { remindAt, repeat, notified: false } : {}),
    }
    if (note) await patchItem(notesCol(uid), note.id, alarm ? data : { ...data, remindAt: deleteField(), repeat: deleteField(), notified: deleteField() })
    else await addItem(notesCol(uid), data)
    if (!alarm) return onClose()
    const ok = await askNotifyPermission()
    if (ok) void registerPeriodic()
    else setWarn('Notifications are blocked for this site. The alarm will still ring inside the app when it is open. Allow notifications in your browser settings, or use the calendar button below.')
    setSaved({ title: data.title, text: data.text, remindAt, repeat })
  }

  if (saved)
    return (
      <Sheet title="✅ Note saved" onClose={onClose}>
        <p className="sheetText">
          Alarm set for <b>{whenText(saved.remindAt)}</b>
          {saved.repeat !== 'none' ? ` (${REPEAT_LABEL[saved.repeat].toLowerCase()})` : ''}.
        </p>
        {warn && <div className="errorBanner">{warn}</div>}
        <p className="statHint">
          Mera Khata rings and shows a notification when the app is open or opened. For an alarm that rings for sure even when the app is
          closed, also add it to your phone’s calendar:
        </p>
        <div className="pdfBtns">
          <a className="btnGhost full" href={calendarLink(saved)} target="_blank" rel="noreferrer">
            📅 Add to phone calendar (sure alarm)
          </a>
          <button className="btnPrimary full" onClick={onClose}>
            Done
          </button>
        </div>
      </Sheet>
    )

  return (
    <Sheet title={note ? 'Edit note' : 'New note'} onClose={onClose}>
      <Field label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Call supplier, Pay committee" maxLength={80} autoFocus={!note} />
      </Field>
      <Field label="Note">
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write anything…" />
      </Field>
      <Field label="Colour">
        <div className="colorPick">
          {COLORS.map((c) => (
            <button
              key={c || 'none'}
              type="button"
              className={`colorDot ${color === c ? 'active' : ''}`}
              style={{ background: c || 'var(--surface-2)' }}
              onClick={() => setColor(c)}
              title={c ? '' : 'No colour'}
            />
          ))}
        </div>
      </Field>
      <label className="checkRow soundRow">
        <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
        📌 Pin to top
      </label>
      <label className="checkRow soundRow">
        <input type="checkbox" checked={alarm} onChange={(e) => setAlarm(e.target.checked)} />
        ⏰ Alarm / reminder
      </label>
      {alarm && (
        <div className="alarmBox">
          <div className="twoFields">
            <Field label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div className="chips">
            <button type="button" className="chip" onClick={() => quick(nowMs() + 10 * 60000)}>
              In 10 min
            </button>
            <button type="button" className="chip" onClick={() => quick(nowMs() + 60 * 60000)}>
              In 1 hour
            </button>
            <button type="button" className="chip" onClick={() => quick(tomorrow9())}>
              Tomorrow 9 AM
            </button>
          </div>
          <Field label="Repeat">
            <Segmented
              options={(Object.keys(REPEAT_LABEL) as Repeat[]).map((r) => ({ id: r, label: REPEAT_LABEL[r] }))}
              value={repeat}
              onChange={setRepeat}
            />
          </Field>
          {!Number.isNaN(remindAt) && remindAt < nowMs() && repeat === 'none' && <div className="statHint">This time has passed — the alarm will ring right away.</div>}
        </div>
      )}
      <div className="sheetBtns">
        {note && (
          <button className="btnDanger" onClick={() => setDeleting(true)}>
            Delete
          </button>
        )}
        <button className="btnGhost" onClick={onClose}>
          Cancel
        </button>
        <button className="btnPrimary" disabled={!canSave} onClick={() => void save()}>
          Save
        </button>
      </div>
      {deleting && note && (
        <ConfirmDelete
          what={`Delete the note “${note.title || note.text.slice(0, 30)}”?`}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await removeItem(notesCol(uid), note.id)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}
