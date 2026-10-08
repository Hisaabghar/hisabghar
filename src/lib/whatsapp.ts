/** 0300-1234567 / +92 300 1234567 → 923001234567 (empty if it doesn't look like a number). */
export function toWhatsAppNumber(phone?: string) {
  const d = (phone ?? '').replace(/\D/g, '')
  if (d.startsWith('92') && d.length >= 12) return d
  if (d.startsWith('0') && d.length === 11) return `92${d.slice(1)}`
  if (d.length === 10 && d.startsWith('3')) return `92${d}`
  return ''
}

/** Opens WhatsApp with a ready message; without a number the user picks the chat. */
export function whatsappLink(message: string, phone?: string) {
  const n = toWhatsAppNumber(phone)
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`
}
