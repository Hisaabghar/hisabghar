import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Bottom sheet. Rendered at the top of the page so a sheet opened from another sheet shows above it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet">
        <div className="sheetTitle">{title}</div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
