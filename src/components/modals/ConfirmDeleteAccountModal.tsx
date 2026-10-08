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
      <p className="sheetText">
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
