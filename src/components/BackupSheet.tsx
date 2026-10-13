import { useState } from 'react'
import type { Settings } from '../types'
import { Sheet } from './ui/Sheet'
import { PinGate } from './home/PinGate'

/** Excel export, full backup file and restore — behind the PIN when Home is locked. */
export function BackupSheet({ uid, settings, onClose }: { uid: string; settings: Settings; onClose: () => void }) {
  const needPin = !!settings.pinHash && settings.homeLock !== false
  const [ok, setOk] = useState(!needPin)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<File | null>(null)

  async function run(label: string, fn: () => Promise<unknown>, done: string) {
    setBusy(label)
    setMsg(null)
    try {
      await fn()
      setMsg(done)
    } catch (e) {
      setMsg(`Could not finish: ${(e as Error).message}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet title="💾 Backup & export" onClose={onClose}>
      {!ok ? (
        <PinGate pinHash={settings.pinHash} hint="Enter your PIN to download your data" onUnlock={() => setOk(true)} onCreate={async () => {}} />
      ) : (
        <>
          {msg && <div className={`errorBanner ${msg.includes('✓') ? 'successBanner' : ''}`}>{msg}</div>}
          <p className="sheetText">
            Keep a copy of all your records on your phone, computer or Google Drive. Do this once a month so nothing is ever lost.
          </p>
          <div className="pdfBtns">
            <button
              className="btnPrimary full"
              disabled={!!busy}
              onClick={() => run('excel', async () => (await import('../lib/exporter')).exportExcel(uid), 'Excel file ready ✓')}
            >
              {busy === 'excel' ? 'Preparing…' : '📊 Download Excel (all records)'}
            </button>
            <div className="statHint">Opens in Excel / Google Sheets — a separate sheet for home, loans, shop, stock, khata, bills and notes.</div>
            <button
              className="btnGhost full"
              disabled={!!busy}
              onClick={() => run('backup', async () => (await import('../lib/exporter')).exportBackup(uid), 'Backup file ready ✓ — keep it safe')}
            >
              {busy === 'backup' ? 'Preparing…' : '💾 Full backup file (for restore)'}
            </button>
            <label className="btnGhost full restoreBtn">
              ♻️ Restore from a backup file
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) setRestoring(f)
                }}
              />
            </label>
          </div>
          <div className="statHint">The backup file has all your data — keep it private and don’t send it to anyone.</div>
        </>
      )}
      {restoring && (
        <Sheet title="Restore this backup?" onClose={() => setRestoring(null)}>
          <p className="sheetText">
            Entries from <b>{restoring.name}</b> will be put back. Entries that are in the app now stay; the same entries are replaced by the
            backup copy.
          </p>
          <div className="sheetBtns">
            <button className="btnGhost" onClick={() => setRestoring(null)}>
              Cancel
            </button>
            <button
              className="btnPrimary"
              onClick={() => {
                const f = restoring
                setRestoring(null)
                void run(
                  'restore',
                  async () => {
                    const n = await (await import('../lib/exporter')).restoreBackup(uid, f)
                    setTimeout(() => setMsg(`Restored ${n} entries ✓`), 0)
                  },
                  'Restored ✓',
                )
              }}
            >
              Restore
            </button>
          </div>
        </Sheet>
      )}
    </Sheet>
  )
}
