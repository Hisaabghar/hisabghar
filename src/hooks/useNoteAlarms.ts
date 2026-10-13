import { useEffect, useState } from 'react'
import type { Note } from '../types'
import { notesCol } from '../lib/paths'
import { patchItem, useLiveQuery } from './useData'
import { cacheAlarms, nextTime, showNote } from '../lib/noteAlarms'
import { play } from '../lib/sound'

/** Rings note alarms while the app is open, and catches up on missed ones when it opens. */
export function useNoteAlarms(uid: string) {
  const notes = useLiveQuery<Note>(notesCol(uid), `notes-${uid}`)
  const [ringing, setRinging] = useState<Note[]>([])
  const key = JSON.stringify(notes.items.map((n) => [n.id, n.remindAt, n.notified, n.repeat, n.title, n.text]))

  useEffect(() => {
    const list = notes.items
    void cacheAlarms(list)
    const fire = (n: Note) => {
      void showNote(n)
      play('alarm')
      setRinging((r) => (r.some((x) => x.id === n.id) ? r : [...r, n]))
      const repeat = n.repeat && n.repeat !== 'none'
      void patchItem(notesCol(uid), n.id, repeat ? { remindAt: nextTime(n.remindAt!, n.repeat) } : { notified: true })
    }
    const timers: number[] = []
    const now = Date.now()
    for (const n of list) {
      if (!n.remindAt || n.notified) continue
      const wait = n.remindAt - now
      if (wait <= 0) fire(n)
      else if (wait < 2 ** 31 - 1) timers.push(window.setTimeout(() => fire(n), wait))
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid])

  return { notes, ringing, dismiss: (id: string) => setRinging((r) => r.filter((x) => x.id !== id)) }
}
