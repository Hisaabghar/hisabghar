import type { jsPDF } from 'jspdf'
import type { Invoice, Settings } from '../types'

type RGB = [number, number, number]
const INK: RGB = [30, 30, 30]
const MUTED: RGB = [95, 95, 95]
const GRID: RGB = [70, 70, 70]
const W = 210
const H = 297
const M = 14

export const BILL_COLORS: { name: string; hex: string }[] = [
  { name: 'Orange', hex: '#E0582B' },
  { name: 'Teal', hex: '#0F766E' },
  { name: 'Blue', hex: '#1D4ED8' },
  { name: 'Green', hex: '#15803D' },
  { name: 'Maroon', hex: '#9F1239' },
  { name: 'Black', hex: '#1F2937' },
]

export type Profile = Pick<
  Settings,
  'businessName' | 'logo' | 'ownerName' | 'phone' | 'address' | 'tagline' | 'ntn' | 'bankTitle' | 'iban' | 'bankName' | 'payTerms' | 'signature' | 'stamp' | 'billColor'
>

const rgb = (hex?: string): RGB => {
  const h = (hex || BILL_COLORS[0].hex).replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const n0 = (n: number) => Math.round(n).toLocaleString('en-PK')
const dmy = (iso: string) => iso.split('-').reverse().join('-')

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function under100(n: number) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '')
}
function under1000(n: number) {
  const h = Math.floor(n / 100)
  const r = n % 100
  return [h ? ONES[h] + ' Hundred' : '', r ? under100(r) : ''].filter(Boolean).join(' ')
}
/** 36500 → "Thirty-Six Thousand Five Hundred" (lakh/crore for big amounts). */
export function inWords(amount: number) {
  let n = Math.round(Math.abs(amount))
  if (n === 0) return 'Zero'
  const parts: string[] = []
  for (const [size, name] of [
    [10000000, 'Crore'],
    [100000, 'Lakh'],
    [1000, 'Thousand'],
  ] as const) {
    if (n >= size) {
      const q = Math.floor(n / size)
      parts.push((size === 10000000 ? inWords(q) : under100(q)) + ' ' + name)
      n %= size
    }
  }
  if (n) parts.push(under1000(n))
  return parts.join(' ')
}

async function newDoc() {
  // Loaded on first use so the PDF library doesn't slow down app start-up.
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

/** Draws an image inside a box, keeping its shape. */
function fitImage(doc: jsPDF, src: string | undefined, x: number, y: number, bw: number, bh: number, alignRight = false) {
  if (!src) return 0
  try {
    const { width, height } = doc.getImageProperties(src)
    const k = Math.min(bw / width, bh / height)
    const w = width * k
    const h = height * k
    doc.addImage(src, alignRight ? x + bw - w : x, y + (bh - h) / 2, w, h, undefined, 'FAST')
    return w
  } catch {
    return 0
  }
}

/** Shop header: colour strip, title, logo, big name, tagline bar, NTN. Returns the y below it. */
function header(doc: jsPDF, p: Profile, title?: string) {
  const C = rgb(p.billColor)
  doc.setFillColor(...C)
  doc.rect(M, 8, W - 2 * M, 2.4, 'F')
  if (title) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(title.toUpperCase(), W / 2, 17, { align: 'center' })
  }
  const logoW = fitImage(doc, p.logo, M + 2, 20, 34, 28)
  const x = logoW ? M + 2 + Math.max(logoW, 30) + 6 : M + 2
  const right = W - M
  const name = p.businessName || 'My Shop'
  doc.setFont('helvetica', 'bolditalic')
  let size = 30
  doc.setFontSize(size)
  while (doc.getTextWidth(name) > right - x && size > 14) doc.setFontSize(--size)
  doc.setTextColor(...C)
  doc.text(name, x + (right - x) / 2, 36, { align: 'center' })
  let y = 39.5
  if (p.tagline) {
    doc.setFillColor(205, 205, 205)
    doc.rect(x, y, right - x, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK)
    doc.text(doc.splitTextToSize(p.tagline, right - x - 4)[0], x + (right - x) / 2, y + 4.1, { align: 'center' })
    y += 6
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  const contact = [p.ownerName, p.phone && `Ph: ${p.phone}`, p.ntn && `NTN: ${p.ntn}`].filter(Boolean).join('   |   ')
  if (contact) doc.text(contact, right, y + 4.5, { align: 'right' })
  y = Math.max(y + 7.5, 51)
  doc.setDrawColor(...C)
  doc.setLineWidth(0.5)
  doc.line(M + 2, y, right, y)
  return y
}

function footer(doc: jsPDF, p: Profile) {
  const foot = [p.address, p.phone && `Ph: ${p.phone}`].filter(Boolean).join('   •   ')
  if (foot) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(foot, W / 2, H - 9, { align: 'center' })
  }
  doc.setFillColor(...rgb(p.billColor))
  doc.rect(M, H - 6, W - 2 * M, 1.6, 'F')
}

function watermark(doc: jsPDF, p: Profile, cy: number) {
  const word = (p.businessName || '').split(/\s+/)[0]?.toUpperCase()
  if (!word) return
  const D = doc as jsPDF & { GState: new (o: object) => unknown; setGState: (g: unknown) => void }
  try {
    D.setGState(new D.GState({ opacity: 0.07 }))
  } catch {
    return
  }
  doc.setFont('helvetica', 'bold')
  let size = 80
  doc.setFontSize(size)
  while (doc.getTextWidth(word) > 150 && size > 30) doc.setFontSize(--size)
  doc.setTextColor(0, 0, 0)
  doc.text(word, W / 2, cy, { align: 'center' })
  D.setGState(new D.GState({ opacity: 1 }))
}

/** Bank details (left), stamp and signature (right). */
function signOff(doc: jsPDF, p: Profile, y: number) {
  const C = rgb(p.billColor)
  const bank = [
    p.bankTitle && `Account Title: ${p.bankTitle}`,
    p.iban && `IBAN / A/C: ${p.iban}${p.bankName ? `  (${p.bankName})` : ''}`,
    !p.iban && p.bankName && `Bank: ${p.bankName}`,
    p.payTerms && `Payment: ${p.payTerms}`,
  ].filter(Boolean) as string[]
  if (bank.length) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...C)
    doc.text(p.iban || p.bankTitle || p.bankName ? 'Bank Details' : 'Terms', M + 2, y + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.3)
    doc.setTextColor(...INK)
    bank.forEach((l, i) => doc.text(doc.splitTextToSize(l, 92)[0], M + 2, y + 11 + i * 4.2))
  }
  fitImage(doc, p.stamp, 104, y + 1, 32, 32)
  const sx = W - M - 52
  fitImage(doc, p.signature, sx, y + 4, 52, 18)
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.4)
  doc.line(sx, y + 23, W - M, y + 23)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...INK)
  doc.text('Signature', sx + 26, y + 27, { align: 'center' })
  if (p.ownerName) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(p.ownerName, sx + 26, y + 31, { align: 'center' })
  }
}

export const lineAmount = (i: { qty: number; price: number }) => (i.qty > 0 ? i.qty * i.price : i.price)

export const invoiceTotals = (inv: Pick<Invoice, 'items' | 'discount' | 'paid'>) => {
  const subtotal = inv.items.reduce((s, i) => s + lineAmount(i), 0)
  const total = Math.max(0, subtotal - inv.discount)
  return { subtotal, total, due: Math.max(0, total - inv.paid) }
}

const ROW = 8.6
const TABLE_BOTTOM = 238

export async function invoicePdf(p: Profile, inv: Invoice) {
  const doc = await newDoc()
  const C = rgb(p.billColor)
  const { total, due } = invoiceTotals(inv)
  const lines: { sno: string; name: string; detail?: string; qty: string; rate: string; amt: string }[] = inv.items.map((it, i) => ({
    sno: String(i + 1),
    name: it.name,
    detail: it.detail,
    qty: it.qty > 0 ? String(it.qty) : '',
    rate: it.qty > 0 ? n0(it.price) : '',
    amt: n0(lineAmount(it)),
  }))
  if (inv.discount > 0) lines.push({ sno: '', name: 'Less: Discount', qty: '', rate: '', amt: '- ' + n0(inv.discount) })

  // Column edges: S.No | Description | Qty | Rate | Amount
  const X = [M + 2, M + 17, M + 123, M + 139, M + 159, W - M]
  const perPage = Math.floor((TABLE_BOTTOM - 92 - ROW) / ROW)
  const pages = Math.max(1, Math.ceil(lines.length / perPage))

  for (let pg = 0; pg < pages; pg++) {
    if (pg) doc.addPage()
    let y = header(doc, p, inv.title || 'BILL / INVOICE')
    // No. and date
    y += 9
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text('No.', X[0], y)
    doc.setTextColor(...C)
    doc.text(String(inv.no) + (pages > 1 ? `  (page ${pg + 1}/${pages})` : ''), X[0] + 9, y)
    doc.setTextColor(...INK)
    doc.text('Date:', 150, y)
    doc.setFont('helvetica', 'normal')
    doc.text(dmy(inv.date), 162, y)
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.2)
    doc.line(X[0] + 8, y + 1.5, 80, y + 1.5)
    doc.line(161, y + 1.5, W - M, y + 1.5)
    // Customer
    y += 9
    doc.setFont('helvetica', 'bold')
    doc.text('M/s.', X[0], y)
    doc.text(inv.customer || 'Walk-in customer', X[0] + 9, y)
    if (inv.phone) {
      doc.setFont('helvetica', 'normal')
      doc.text(`Ph: ${inv.phone}`, W - M, y, { align: 'right' })
    }
    doc.line(X[0] + 8, y + 1.5, W - M, y + 1.5)

    // Table
    const top = y + 7
    watermark(doc, p, top + (TABLE_BOTTOM - top) / 2 + 10)
    doc.setFillColor(...C)
    doc.rect(X[0], top, X[5] - X[0], ROW, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.3)
    doc.setTextColor(255, 255, 255)
    const th = top + 5.6
    doc.text('S.No.', (X[0] + X[1]) / 2, th, { align: 'center' })
    doc.text('Description', (X[1] + X[2]) / 2, th, { align: 'center' })
    doc.text('Qty.', (X[2] + X[3]) / 2, th, { align: 'center' })
    doc.text('Rate', (X[3] + X[4]) / 2, th, { align: 'center' })
    doc.text('Amount', (X[4] + X[5]) / 2, th, { align: 'center' })

    let ry = top + ROW
    const chunk = lines.slice(pg * perPage, (pg + 1) * perPage)
    const last = pg === pages - 1
    const bottom = last ? TABLE_BOTTOM : TABLE_BOTTOM + ROW
    doc.setTextColor(...INK)
    for (let r = 0; ry + ROW <= bottom + 0.01; r++, ry += ROW) {
      const l = chunk[r]
      if (l) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.3)
        doc.text(l.sno, (X[0] + X[1]) / 2, ry + 5.5, { align: 'center' })
        doc.setFont('helvetica', 'bold')
        doc.text(doc.splitTextToSize(l.name, X[2] - X[1] - 4)[0], X[1] + 2.5, ry + (l.detail ? 4.2 : 5.5))
        if (l.detail) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6.5)
          doc.setTextColor(...MUTED)
          doc.text(doc.splitTextToSize(l.detail, X[2] - X[1] - 4)[0], X[1] + 2.5, ry + 7.3)
          doc.setTextColor(...INK)
        }
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8.3)
        doc.text(l.qty, (X[2] + X[3]) / 2, ry + 5.5, { align: 'center' })
        doc.text(l.rate, X[4] - 2, ry + 5.5, { align: 'right' })
        doc.text(l.amt, X[5] - 2, ry + 5.5, { align: 'right' })
      }
      doc.setDrawColor(...GRID)
      doc.setLineWidth(0.2)
      doc.line(X[0], ry + ROW, X[5], ry + ROW)
    }
    // Grid: outer box and column lines
    doc.setDrawColor(...GRID)
    doc.setLineWidth(0.3)
    doc.rect(X[0], top, X[5] - X[0], ry - top)
    for (const cx of X.slice(1, 5)) doc.line(cx, top, cx, ry)

    if (last) {
      // Amount in words + total
      doc.rect(X[0], ry, X[5] - X[0], ROW)
      doc.setFillColor(Math.round(255 - (255 - C[0]) * 0.15), Math.round(255 - (255 - C[1]) * 0.15), Math.round(255 - (255 - C[2]) * 0.15))
      doc.rect(X[3], ry, X[5] - X[3], ROW, 'FD')
      doc.line(X[4], ry, X[4], ry + ROW)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.3)
      doc.setTextColor(...INK)
      doc.text(doc.splitTextToSize(`Rupees ${inWords(total)} Only`, X[3] - X[0] - 5)[0], X[0] + 2.5, ry + 5.4)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text('Total', (X[3] + X[4]) / 2, ry + 5.6, { align: 'center' })
      doc.setTextColor(...C)
      doc.text('Rs ' + n0(total), (X[4] + X[5]) / 2, ry + 5.6, { align: 'center' })
      ry += ROW
      // Payment status
      doc.setFontSize(8)
      if (due > 0) {
        doc.setTextColor(185, 28, 28)
        doc.text(inv.paid > 0 ? `Paid: Rs ${n0(Math.min(inv.paid, total))}     Balance due: Rs ${n0(due)}` : `Unpaid - Balance due: Rs ${n0(due)}`, X[5], ry + 5, { align: 'right' })
      } else {
        doc.setTextColor(21, 128, 61)
        doc.text('PAID IN FULL', X[5], ry + 5, { align: 'right' })
      }
      if (inv.note) {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...MUTED)
        doc.text(doc.splitTextToSize(`Note: ${inv.note}`, 120)[0], X[0], ry + 5)
      }
      signOff(doc, p, ry + 7)
    }
    footer(doc, p)
  }
  return doc
}

export interface Letter {
  date: string
  to?: string
  subject?: string
  body: string
}

/** A letter on the shop's letter pad; with an empty body it is a blank pad page. */
export async function letterPdf(p: Profile, l: Letter) {
  const doc = await newDoc()
  const pad = () => {
    const y = header(doc, p)
    footer(doc, p)
    return y
  }
  let y = pad() + 10
  if (!l.body.trim() && !l.subject && !l.to) return doc
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(`Date: ${dmy(l.date)}`, W - M, y, { align: 'right' })
  if (l.to) {
    const to = doc.splitTextToSize(`To,\n${l.to}`, 110) as string[]
    doc.text(to, M + 2, y)
    y += to.length * 5.4 + 4
  } else y += 8
  if (l.subject) {
    doc.setFont('helvetica', 'bold')
    const sub = doc.splitTextToSize(`Subject: ${l.subject}`, W - 2 * M - 4) as string[]
    doc.text(sub, M + 2, y)
    y += sub.length * 5.6 + 4
    doc.setFont('helvetica', 'normal')
  }
  doc.setFontSize(11)
  for (const line of doc.splitTextToSize(l.body, W - 2 * M - 4) as string[]) {
    if (y > H - 60) {
      doc.addPage()
      y = pad() + 10
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...INK)
    }
    doc.text(line, M + 2, y)
    y += 6
  }
  signOff(doc, { ...p, bankTitle: undefined, iban: undefined, bankName: undefined, payTerms: undefined }, Math.min(Math.max(y + 6, H - 75), H - 50))
  return doc
}

const fileOf = (doc: jsPDF, name: string) => new File([doc.output('blob')], name, { type: 'application/pdf' })

export function downloadPdf(doc: jsPDF, name: string) {
  const url = URL.createObjectURL(doc.output('blob'))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}

/** Opens the phone's share menu (WhatsApp etc.); falls back to download. */
export async function sharePdf(doc: jsPDF, name: string, text?: string) {
  const file = fileOf(doc, name)
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name, text })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  downloadPdf(doc, name)
}

/** Shrinks a picked image to a small PNG data URL (logo, signature, stamp). */
export function resizeImage(file: File, max = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read this image'))
    }
    img.src = url
  })
}
