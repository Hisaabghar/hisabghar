// Tiny UI sounds made with the Web Audio API (no files to download).
const KEY = 'mk-sound'
let ctx: AudioContext | null = null

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // ignore
  }
}

function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  const t = ctx.currentTime + start
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

export function play(kind: 'click' | 'success' | 'delete') {
  if (!soundOn()) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    if (kind === 'click') tone(1100, 0, 0.05, 0.08, 'triangle')
    else if (kind === 'success') {
      tone(880, 0, 0.12, 0.09)
      tone(1320, 0.08, 0.16, 0.09)
    } else tone(320, 0, 0.14, 0.1, 'triangle')
  } catch {
    // audio not available
  }
}

const CLICKABLE =
  'button, a, select, [role="button"], .row, .stat.clickable, .quickTile, .tab, .subTab, .chip, .navItem, .kindPick, .pinKey, .iconPick'

/** One listener for the whole app: a soft tick on taps, a chime on primary/save buttons. */
export function installClickSounds() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest?.(CLICKABLE) as HTMLElement | null
      if (!el || (el as HTMLButtonElement).disabled) return
      if (el.matches('.btnDanger')) play('delete')
      else if (el.matches('.btnPrimary, .pinKey.ok, .sellBig')) play('success')
      else play('click')
    },
    { capture: true, passive: true },
  )
}
