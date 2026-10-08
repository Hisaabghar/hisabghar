import { useState } from 'react'
import type { DayOpening } from '../../types'
import { dayDoc } from '../../lib/paths'
import { mergeDoc } from '../../hooks/useData'
import { Field, FormSheet, MoneyInput, num } from '../ui/kit'

export function OpeningForm({
  uid,
  date,
  current,
  onClose,
}: {
  uid: string
  date: string
  current: DayOpening
  onClose: () => void
}) {
  const [cash, setCash] = useState(current.cash ? String(current.cash) : '')
  const [ep, setEp] = useState(current.easypaisa ? String(current.easypaisa) : '')
  const [jc, setJc] = useState(current.jazzcash ? String(current.jazzcash) : '')
  return (
    <FormSheet
      title="Opening balance"
      onClose={onClose}
      canSave
      onSave={() => mergeDoc(dayDoc(uid, date), { cash: num(cash), easypaisa: num(ep), jazzcash: num(jc) })}
    >
      <p className="sheetText">How much money did you have at the start of the day?</p>
      <Field label="Cash in drawer">
        <MoneyInput value={cash} onChange={setCash} autoFocus />
      </Field>
      <Field label="Easypaisa balance">
        <MoneyInput value={ep} onChange={setEp} />
      </Field>
      <Field label="JazzCash balance">
        <MoneyInput value={jc} onChange={setJc} />
      </Field>
    </FormSheet>
  )
}
