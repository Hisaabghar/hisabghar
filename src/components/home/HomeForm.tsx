import { useState } from 'react'
import { arrayUnion } from 'firebase/firestore'
import type { HomeType } from '../../types'
import { homeCol, settingsDoc } from '../../lib/paths'
import { addItem, mergeDoc } from '../../hooks/useData'
import { today } from '../../lib/format'
import { HOME_EXPENSE, HOME_INCOME } from '../../lib/catalog'
import { Chips, Field, FormSheet, MoneyInput, Segmented, num } from '../ui/kit'

const nowTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const ADD = '+ Add account'

/** Account chips with an inline "add a bank / account" field. */
function AccountPicker({
  uid,
  accounts,
  value,
  onChange,
  exclude,
}: {
  uid: string
  accounts: string[]
  value: string
  onChange: (v: string) => void
  exclude?: string
}) {
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
            placeholder="Bank or account name, e.g. HBL, Meezan"
            maxLength={24}
          />
          <button
            type="button"
            className="btnPrimary"
            disabled={!adding.trim()}
            onClick={async () => {
              const name = adding.trim()
              await mergeDoc(settingsDoc(uid), { homeAccounts: arrayUnion(name) })
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

export function HomeForm({
  uid,
  initialType,
  accounts,
  onClose,
}: {
  uid: string
  initialType: HomeType
  accounts: string[]
  onClose: () => void
}) {
  const [type, setType] = useState<HomeType>(initialType)
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState(initialType === 'income' ? HOME_INCOME[1] : HOME_EXPENSE[0])
  const [account, setAccount] = useState(accounts[0])
  const [toAccount, setToAccount] = useState(accounts[1] ?? accounts[0])
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const [time, setTime] = useState(nowTime())
  const cats = type === 'income' ? HOME_INCOME : HOME_EXPENSE
  const isTransfer = type === 'transfer'

  const title = type === 'income' ? 'Add income' : type === 'expense' ? 'Add expense' : 'Move money between accounts'
  const canSave = num(amount) > 0 && (!isTransfer || (toAccount && toAccount !== account))

  return (
    <FormSheet
      title={title}
      onClose={onClose}
      canSave={!!canSave}
      onSave={() =>
        addItem(homeCol(uid), {
          type,
          amount: num(amount),
          category: isTransfer ? 'Transfer' : category,
          account,
          ...(isTransfer ? { toAccount } : {}),
          note: note.trim(),
          date,
          time,
        })
      }
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
          if (t !== 'transfer') setCategory(t === 'income' ? HOME_INCOME[1] : HOME_EXPENSE[0])
        }}
      />
      <Field label="Amount (Rs)">
        <MoneyInput value={amount} onChange={setAmount} autoFocus />
      </Field>
      <Field label={type === 'income' ? 'Received in' : isTransfer ? 'From account' : 'Paid from'}>
        <AccountPicker uid={uid} accounts={accounts} value={account} onChange={setAccount} />
      </Field>
      {isTransfer ? (
        <Field label="To account">
          <AccountPicker uid={uid} accounts={accounts} value={toAccount} onChange={setToAccount} exclude={account} />
        </Field>
      ) : (
        <Field label={type === 'income' ? 'Source' : 'Spent on'}>
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
