import type { jsPDF } from 'jspdf'
import type { Invoice, Settings } from '../types'
import { rsRaw } from './format'

const BRAND: [number, number, number] = [15, 118, 110]
const INK: [number, number, number] = [30, 41, 59]
const MUTED: [number, number, number] = [100, 116, 139]
const W = 210
const H = 297
const M = 16

export type Profile = Pick<Settings, 'businessName' | 'logo' | 'ownerName' | 'phone' | 'address'>

const longDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

async function newDoc() {
  // Loaded on first use so the PDF library doesn't slow down app start-up.
  const { jsPDF } = await import('jspdf')
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

/** Letterhead: logo, shop name, owner, phone and address, with a footer line. */
function letterhead(doc: jsPDF, p: Profile, right?: { title: string; lines: string[] }) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, W, 4, 'F')
  let x = M
  if (p.logo) {
    try {
      // Fit inside a 24 mm box without stretching.
      const { width, height } = doc.getImageProperties(p.logo)
      const k = 24 / Math.max(width, height)
      const w = width * k
      const h = height * k
      doc.addImage(p.logo, M, 12 + (24 - h) / 2, w, h, undefined, 'FAST')
      x = M + w + 5
    } catch {
      // Unsupported image: leave it out.
    }
  }
  doc.setTextColor(...BRAND)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.text(p.businessName || 'My Shop', x, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  const info = [p.ownerName, p.phone && `Phone: ${p.phone}`].filter(Boolean).join('   |   ')
  if (info) doc.text(info, x, 27)
  if (p.address) {
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(p.address, right ? 95 : W - x - M), x, 33)
  }
  if (right) {
    doc.setTextColor(...BRAND)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text(right.title, W - M, 20, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    right.lines.forEach((l, i) => doc.text(l, W - M, 27 + i * 5, { align: 'right' }))
  }
  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.6)
  doc.line(M, 42, W - M, 42)
  // Footer
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(M, H - 18, W - M, H - 18)
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  const foot = [p.businessName, p.phone, p.address].filter(Boolean).join('  •  ')
  doc.text(foot, W / 2, H - 12, { align: 'center' })
  doc.setFillColor(...BRAND)
  doc.rect(0, H - 4, W, 4, 'F')
}

export const invoiceTotals = (inv: Pick<Invoice, 'items' | 'discount' | 'paid'>) => {
  const subtotal = inv.items.reduce((s, i) => s + i.qty * i.price, 0)
  const total = Math.max(0, subtotal - inv.discount)
  return { subtotal, total, due: Math.max(0, total - inv.paid) }
}

export async function invoicePdf(p: Profile, inv: Invoice) {
  const doc = await newDoc()
  const { subtotal, total, due } = invoiceTotals(inv)
  letterhead(doc, p, { title: due > 0 ? 'INVOICE' : 'CASH RECEIPT', lines: [`Bill No: ${inv.no}`, `Date: ${longDate(inv.date)}`] })

  let y = 52
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text('BILL TO', M, y)
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.text(inv.customer || 'Walk-in customer', M, y + 6)
  doc.setFont('helvetica', 'normal')
  if (inv.phone) {
    doc.setFontSize(10)
    doc.text(inv.phone, M, y + 11.5)
  }

  // Items table
  y = 72
  const cols = { no: M + 3, item: M + 12, qty: 128, rate: 158, amt: W - M - 3 }
  doc.setFillColor(...BRAND)
  doc.rect(M, y, W - 2 * M, 9, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('#', cols.no, y + 6)
  doc.text('Item / Description', cols.item, y + 6)
  doc.text('Qty', cols.qty, y + 6, { align: 'right' })
  doc.text('Rate', cols.rate, y + 6, { align: 'right' })
  doc.text('Amount', cols.amt, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...INK)
  y += 9
  inv.items.forEach((it, i) => {
    const name = doc.splitTextToSize(it.name, cols.qty - cols.item - 14) as string[]
    const h = Math.max(8, name.length * 4.6 + 3.4)
    if (y + h > H - 70) {
      doc.addPage()
      letterhead(doc, p, { title: 'INVOICE', lines: [`Bill No: ${inv.no}`, '(continued)'] })
      y = 52
    }
    if (i % 2 === 1) {
      doc.setFillColor(241, 245, 249)
      doc.rect(M, y, W - 2 * M, h, 'F')
    }
    doc.text(String(i + 1), cols.no, y + 5.4)
    doc.text(name, cols.item, y + 5.4)
    doc.text(String(it.qty), cols.qty, y + 5.4, { align: 'right' })
    doc.text(rsRaw(it.price), cols.rate, y + 5.4, { align: 'right' })
    doc.text(rsRaw(it.qty * it.price), cols.amt, y + 5.4, { align: 'right' })
    y += h
  })
  doc.setDrawColor(226, 232, 240)
  doc.line(M, y, W - M, y)

  // Totals
  y += 8
  const row = (label: string, value: string, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(bold ? 12 : 10)
    doc.text(label, 140, y, { align: 'right' })
    doc.text(value, cols.amt, y, { align: 'right' })
    y += bold ? 8 : 6
  }
  row('Subtotal', rsRaw(subtotal))
  if (inv.discount > 0) row('Discount', '- ' + rsRaw(inv.discount))
  doc.setDrawColor(...BRAND)
  doc.line(110, y - 3, W - M, y - 3)
  y += 2
  row('Total', rsRaw(total), true)
  row('Paid', rsRaw(Math.min(inv.paid, total)))
  if (due > 0) {
    doc.setTextColor(185, 28, 28)
    row('Balance due', rsRaw(due), true)
    doc.setTextColor(...INK)
  }

  // Paid / unpaid stamp
  const stamp = due > 0 ? (inv.paid > 0 ? 'PARTLY PAID' : 'UNPAID') : 'PAID'
  const col: [number, number, number] = due > 0 ? [185, 28, 28] : [21, 128, 61]
  doc.setDrawColor(...col)
  doc.setTextColor(...col)
  doc.setLineWidth(0.8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  const sw = doc.getTextWidth(stamp) + 10
  doc.roundedRect(M, y - 22, sw, 11, 2, 2, 'S')
  doc.text(stamp, M + 5, y - 14.2)
  doc.setTextColor(...INK)
  doc.setLineWidth(0.3)

  if (inv.note) {
    y += 4
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...MUTED)
    doc.text(doc.splitTextToSize(`Note: ${inv.note}`, W - 2 * M), M, y)
  }

  signature(doc, p, H - 40)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BRAND)
  doc.text('Thank you for your business!', M, H - 26)
  return doc
}

function signature(doc: jsPDF, p: Profile, y: number) {
  doc.setDrawColor(...MUTED)
  doc.setLineWidth(0.3)
  doc.line(W - M - 55, y, W - M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text(p.ownerName || 'Signature', W - M - 27.5, y + 5, { align: 'center' })
  if (p.phone) {
    doc.setTextColor(...MUTED)
    doc.text(p.phone, W - M - 27.5, y + 10, { align: 'center' })
  }
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
  letterhead(doc, p)
  if (!l.body.trim() && !l.subject && !l.to) return doc
  let y = 54
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  doc.text(`Date: ${longDate(l.date)}`, W - M, y, { align: 'right' })
  if (l.to) {
    const to = doc.splitTextToSize(`To,\n${l.to}`, 110) as string[]
    doc.text(to, M, y)
    y += to.length * 5.4 + 4
  } else y += 8
  if (l.subject) {
    doc.setFont('helvetica', 'bold')
    const sub = doc.splitTextToSize(`Subject: ${l.subject}`, W - 2 * M) as string[]
    doc.text(sub, M, y)
    y += sub.length * 5.6 + 4
    doc.setFont('helvetica', 'normal')
  }
  doc.setFontSize(11)
  for (const line of doc.splitTextToSize(l.body, W - 2 * M) as string[]) {
    if (y > H - 50) {
      doc.addPage()
      letterhead(doc, p)
      y = 54
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(...INK)
    }
    doc.text(line, M, y)
    y += 6
  }
  signature(doc, p, Math.min(Math.max(y + 22, H - 60), H - 32))
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

export const canSharePdf = () => {
  try {
    return !!navigator.canShare?.({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })
  } catch {
    return false
  }
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

/** Shrinks a picked image to a small square-ish PNG data URL for the logo. */
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
