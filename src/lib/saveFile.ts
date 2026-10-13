/** True inside the Android app (Capacitor), false in a normal browser. */
export const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

/**
 * Saves a file. In the Android app it opens the share menu (save to Files/Drive, WhatsApp…);
 * in a browser it downloads, or shares when `share` is set and the phone supports it.
 */
export async function saveBlob(blob: Blob, name: string, opts: { share?: boolean; text?: string } = {}) {
  if (isNative()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({ path: name, data: await toBase64(blob), directory: Directory.Cache })
    try {
      await Share.share({ title: name, text: opts.text, files: [uri], dialogTitle: 'Save or send' })
    } catch {
      // Closed the share menu.
    }
    return
  }
  if (opts.share) {
    const file = new File([blob], name, { type: blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name, text: opts.text })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
  }
  download(blob, name)
}
