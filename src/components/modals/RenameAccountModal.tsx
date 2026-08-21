import { useState } from 'react'
import { Sheet } from '../Sheet'

export function RenameAccountModal({
  currentName,
  onClose,
  onSave,
}: {
  currentName: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [name, setName] = useState(currentName)
  return (
    <Sheet onClose={onClose}>
      <div className="sheetTitle">Rename account</div>
      <input className="newAccInput" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      <div className="sheetBtns">
        <button className="btnGhost" onClick={onClose}>
          Cancel
        </button>
        <button className="btnPrimary" onClick={() => onSave(name)} disabled={!name.trim()}>
          Save
        </button>
      </div>
    </Sheet>
  )
}
