import { Sheet } from '../Sheet'

export function AccMenuModal({
  accountName,
  onClose,
  onRename,
  onDelete,
}: {
  accountName: string
  onClose: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="sheetTitle">{accountName}</div>
      <div className="menuList">
        <button className="menuItem" onClick={onRename}>
          <span className="ic">✏️</span> Rename account
        </button>
        <button className="menuItem danger" onClick={onDelete}>
          <span className="ic">🗑️</span> Delete account
        </button>
      </div>
      <div className="sheetBtns" style={{ marginTop: 14 }}>
        <button className="btnGhost" style={{ flex: 1 }} onClick={onClose}>
          Close
        </button>
      </div>
    </Sheet>
  )
}
