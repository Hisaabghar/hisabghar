import { useState } from 'react'
import { arrayRemove, arrayUnion } from 'firebase/firestore'
import type { HomeType } from '../../types'
import { homeCol, settingsDoc } from '../../lib/paths'
import { addItem, mergeDoc } from '../../hooks/useData'
import { rsRaw, today } from '../../lib/format'
import { HOME_EXPENSE, HOME_INCOME } from '../../lib/catalog'
import { Chips, Field, FormSheet, MoneyInput, Segmented, cleanNumber, num } from '../ui/kit'

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const ME = 'Me'

/** Chips plus an inline field that saves a new option to a settings list. */
function PickerWithAdd({
  uid,
  field,
  addLabel,
  placeholder,
  accounts,
  value,
  onChange,
  exclude,
}: {
  uid: string
  field: 'homeAccounts' | 'owners'
  addLabel: string
  placeholder: string
  accounts: string[]
  value: string
  onChange: (v: string) => void
  exclude?: string
}) {
  const ADD = addLabel
  const [adding, setAdding] = useState<string | null>(null)
  return (
    <>
      <Chips
        options={[...accounts.filter((a) => a !== exclude), ADD]}
        value={adding !== null ? ADD : value}
        onChange={(a) => {
          if (a === ADD) return setAdding('')
          setAdding(null)
          onChange(a)
        }}
      />
      {adding !== null && (
        <div className="inlineAdd">
          <input
            autoFocus
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder={placeholder}
            maxLength={24}
          />
          <button
            type="button"
            className="btnPrimary"
            disabled={!adding.trim()}
            onClick={async () => {
              const name = adding.trim()
              await mergeDoc(settingsDoc(uid), { [field]: arrayUnion(name), ...(field === 'homeAccounts' ? { hiddenAccounts: arrayRemove(name) } : {}) })
              onChange(name)
              setAdding(null)
            }}
          >
            Add
          </button>
        </div>
      )}
    </>
  )
}

function AccountPicker(props: { uid: string; accounts: string[]; value: string; onChange: (v: string) => void; exclude?: string }) {
  return (
    <PickerWithAdd {...props} field="homeAccounts" addLabel="+ Add account" placeholder="Bank or account name, e.g. HBL, Meezan" />
  )
}

function OwnerPicker({ uid, owners, value, onChange }: { uid: string; owners: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <PickerWithAdd
      uid={uid}
      field="owners"
      addLabel="+ Add person"
      placeholder="Whose money? e.g. Uncle, Abu"
      accounts={[ME, ...owners.filter((o) => o !== ME)]}
      value={value}
      onChange={onChange}
    />
  )
}

export function HomeForm({
  uid,
  initialType,
  accounts,
  owners,
  initialOwner,
  onClose,
}: {
  uid: string
  initialType: HomeType
  accounts: string[]
  owners: string[]
  initialOwner?: string
  onClose: () => void
}) {
  const [type, setType] = useState<HomeType>(initialType)
  const [amount, setAmount] = useState('')
  const [owner, setOwner] = useState(initialOwner ?? ME)
  const defaultCat = (t: HomeType, o: string) =>
    t === 'income' ? (o === ME ? "Father's salary" : 'Kept for someone') : o === ME ? HOME_EXPENSE[0] : 'Returned to owner'
  const [category, setCategory] = useState(defaultCat(initialType, initialOwner ?? ME))
  const [account, setAccount] = useState(accounts[0])
  const [toAccount, setToAccount] = useState(accounts[1] ?? accounts[0])
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState(nowTime())
  const cats = type === 'income' ? HOME_INCOME : HOME_EXPENSE
  const isTransfer = type === 'transfer'

  const title =
    type === 'transfer'
      ? 'Move money between accounts'
      : owner !== ME
        ? type === 'income'
          ? `Money received for ${owner}`
          : `Money paid out of ${owner}'s share`
        : type === 'income'
          ? 'Add income'
          : 'Add expense'
  // Income can be split: part of the amount may belong to other people.
  const [split, setSplit] = useState(false)
  const [shares, setShares] = useState<{ person: string; amount: string }[]>([{ person: '', amount: '' }])
  const splitting = type === 'income' && split
  const othersTotal = splitting ? shares.reduce((s, x) => s + num(x.amount), 0) : 0
  const mineLeft = num(amount) - othersTotal
  const sharesValid = !splitting || (mineLeft >= 0 && shares.some((x) => x.person.trim() && num(x.amount) > 0))

  const canSave = num(amount) > 0 && sharesValid && (!isTransfer || (toAccount && toAccount !== account))

  async function save() {
    const base = { type, account, note: note.trim(), date, time, ...(isTransfer ? { toAccount } : {}) }
    if (!splitting) {
      await addItem(homeCol(uid), {
        ...base,
        amount: num(amount),
        category: isTransfer ? 'Transfer' : category,
        ...(owner !== ME ? { owner } : {}),
      })
      return
    }
    const parts = shares.filter((x) => x.person.trim() && num(x.amount) > 0)
    for (const p of parts) {
      await addItem(homeCol(uid), { ...base, amount: num(p.amount), category: 'Kept for someone', owner: p.person.trim() })
    }
    if (mineLeft > 0) await addItem(homeCol(uid), { ...base, amount: mineLeft, category })
    const newPeople = parts.map((p) => p.person.trim()).filter((p) => !owners.includes(p))
    if (newPeople.length) await mergeDoc(settingsDoc(uid), { owners: arrayUnion(...newPeople) })
  }

  return (
    <FormSheet
      title={title}
      onClose={onClose}
      canSave={!!canSave}
      onSave={save}
    >
      <Segmented
        options={[
          { id: 'income', label: 'Income' },
          { id: 'expense', label: 'Expense' },
          { id: 'transfer', label: 'Transfer' },
        ]}
        value={type}
        onChange={(t) => {
          setType(t)
          if (t !== 'transfer') setCategory(defaultCat(t, owner))
        }}
      />
      <Field label="Amount (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      {type === 'income' ? (
        <Field label="Is all of this yours?">
          <Segmented
            options={[
              { id: 'mine', label: 'All mine' },
              { id: 'split', label: "Some is others' money" },
            ]}
            value={split ? 'split' : 'mine'}
            onChange={(v) => setSplit(v === 'split')}
          />
          {split && (
            <div className="splitBox">
              <datalist id="ownerList">
                {owners.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
              {shares.map((sh, i) => (
                <div key={i} className="splitRow">
                  <input
                    list="ownerList"
                    value={sh.person}
                    placeholder="Whose? e.g. Uncle"
                    onChange={(e) => setShares((s) => s.map((x, j) => (j === i ? { ...x, person: e.target.value } : x)))}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={sh.amount}
                    placeholder="Amount"
                    onChange={(e) => setShares((s) => s.map((x, j) => (j === i ? { ...x, amount: cleanNumber(e.target.value) } : x)))}
                  />
                  {shares.length > 1 && (
                    <button type="button" className="splitDel" onClick={() => setShares((s) => s.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="linkBtn" onClick={() => setShares((s) => [...s, { person: '', amount: '' }])}>
                + Add another person
              </button>
              <div className={`totalLine ${mineLeft < 0 ? 'bad' : ''}`}>
                {mineLeft < 0 ? (
                  <>Others' shares are more than the total by {rsRaw(-mineLeft)}</>
                ) : (
                  <>
                    Others: <b>{rsRaw(othersTotal)}</b> · Mine: <b>{rsRaw(mineLeft)}</b>
                  </>
                )}
              </div>
            </div>
          )}
        </Field>
      ) : (
        <Field label="Whose money?">
          <OwnerPicker
            uid={uid}
            owners={owners}
            value={owner}
            onChange={(o) => {
              setOwner(o)
              if (!isTransfer) setCategory(defaultCat(type, o))
            }}
          />
        </Field>
      )}
      <Field label={type === 'income' ? 'Received in' : isTransfer ? 'From account' : 'Paid from'}>
        <AccountPicker uid={uid} accounts={accounts} value={account} onChange={setAccount} />
      </Field>
      {isTransfer ? (
        <Field label="To account">
          <AccountPicker uid={uid} accounts={accounts} value={toAccount} onChange={setToAccount} exclude={account} />
        </Field>
      ) : (
        <Field label={type === 'income' ? (splitting ? 'Source of your part' : 'Source') : 'Spent on'}>
          <Chips options={cats} value={category} onChange={setCategory} />
        </Field>
      )}
      <Field label="Note (optional)">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={isTransfer ? 'e.g. ATM withdrawal' : 'e.g. Tea with Ali, 2 litres petrol'}
        />
      </Field>
      <div className="twoFields">
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
    </FormSheet>
  )
}
