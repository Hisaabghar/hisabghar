import { useState } from 'react'
import { arrayUnion } from 'firebase/firestore'
import type { CustomBiz } from '../../types'
import { settingsDoc } from '../../lib/paths'
import { mergeDoc } from '../../hooks/useData'
import { Field, FormSheet } from '../ui/kit'
import { BIZ_ICONS, KIND_LABEL } from './bizMeta'

/** Adds a new business category to Settings.customBiz. */
export function AddBizSheet({
  uid,
  existing,
  onClose,
  onAdded,
}: {
  uid: string
  existing: CustomBiz[]
  onClose: () => void
  onAdded?: (b: CustomBiz) => void
}) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(BIZ_ICONS[0])
  const clean = name.trim()
  const taken =
    existing.some((b) => b.name.toLowerCase() === clean.toLowerCase()) ||
    Object.values(KIND_LABEL).some((l) => l.toLowerCase() === clean.toLowerCase())

  return (
    <FormSheet
      title="Add a business category"
      onClose={onClose}
      canSave={!!clean && !taken}
      onSave={async () => {
        const b = { name: clean, icon }
        await mergeDoc(settingsDoc(uid), { customBiz: arrayUnion(b) })
        onAdded?.(b)
      }}
    >
      <p className="sheetText">Track any other work you do — it gets its own page, entries and profit.</p>
      <Field label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tea stall, Bike repair, Tailoring" maxLength={28} autoFocus />
      </Field>
      {taken && <div className="errorBanner">A category with this name already exists.</div>}
      <Field label="Icon">
        <div className="iconGrid">
          {BIZ_ICONS.map((i) => (
            <button key={i} type="button" className={`iconPick ${i === icon ? 'active' : ''}`} onClick={() => setIcon(i)}>
              {i}
            </button>
          ))}
        </div>
      </Field>
    </FormSheet>
  )
}
