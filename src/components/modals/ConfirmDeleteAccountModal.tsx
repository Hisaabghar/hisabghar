import { Sheet } from '../Sheet'

export function ConfirmDeleteAccountModal({
  accountName,
  entryCount,
  onClose,
  onConfirm,
}: {
  accountName: string
  entryCount: number
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="sheetTitle">Delete "{accountName}"?</div>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '-6px 0 4px' }}>
        This permanently deletes this account and all {entryCount} of its entries. This can't be undone.
      </p>
      <div className="sheetBtns">
        <button className="btnGhost" onClick={onClose}>
          Cancel
        </button>
        <button className="btnDanger" onClick={onConfirm}>
          Delete
        </button>
      </div>
    </Sheet>
  )
}
