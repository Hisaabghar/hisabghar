import { useState } from 'react'
import { Sheet } from '../Sheet'

export function NewAccountModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <Sheet onClose={onClose}>
      <div className="sheetTitle">New account</div>
      <input
        className="newAccInput"
        autoFocus
        placeholder="e.g. Tayyab account"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="sheetBtns">
        <button className="btnGhost" onClick={onClose}>
          Cancel
        </button>
        <button className="btnPrimary" onClick={() => onCreate(name)} disabled={!name.trim()}>
          Create
        </button>
      </div>
    </Sheet>
  )
}
