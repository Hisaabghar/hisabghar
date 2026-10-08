export const HOME_INCOME = ['Opening balance', "Father's salary", 'My earnings', 'Gift / Eidi', 'Money returned', 'Other']

export const HOME_EXPENSE = [
  'Fuel / Bike',
  'Friends',
  'Food / Eating out',
  'Groceries',
  'Bills',
  'Mobile / Package',
  'Clothes',
  'Medicine / Doctor',
  'Fees / Education',
  'Travel',
  'Other',
]

export const ICONS: Record<string, string> = {
  'Opening balance': '🏁',
  "Father's salary": '💼',
  'My earnings': '💰',
  'Gift / Eidi': '🎁',
  'Money returned': '↩️',
  'Fuel / Bike': '🏍️',
  Friends: '🧑‍🤝‍🧑',
  'Food / Eating out': '🍔',
  Groceries: '🛒',
  Bills: '🧾',
  'Mobile / Package': '📱',
  Clothes: '👕',
  'Medicine / Doctor': '💊',
  'Fees / Education': '📚',
  Travel: '🚌',
  Other: '📝',
}

export const INVEST_CATEGORIES = [
  'Shop setup',
  'Machine / Printer',
  'Stock',
  'Furniture',
  'Rent advance',
  'Mobile / Computer',
  'Other',
]
export const INVEST_ICONS: Record<string, string> = {
  'Shop setup': '🏪',
  'Machine / Printer': '🖨️',
  Stock: '📦',
  Furniture: '🪑',
  'Rent advance': '🔑',
  'Mobile / Computer': '💻',
  Other: '📝',
}

export const HOME_ACCOUNTS = ['Cash in pocket', 'Easypaisa', 'JazzCash']
export const accountIcon = (a: string) =>
  a === 'Cash in pocket' ? '👛' : a === 'Easypaisa' || a === 'JazzCash' ? '📱' : '🏦'

/** Default accounts plus the user's own, without duplicates. */
export function allHomeAccounts(extra: string[] = []) {
  const seen = new Set<string>()
  return [...HOME_ACCOUNTS, ...extra].filter((n) => {
    const k = n.trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const NETWORKS = ['Jazz', 'Zong', 'Telenor', 'Ufone', 'Onic']
/** Built-in networks plus the user's own, without duplicates. */
export function allNetworks(extra: string[] = []) {
  const seen = new Set<string>()
  return [...NETWORKS, ...extra].filter((n) => {
    const k = n.trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export const NETWORK_COLORS: Record<string, string> = {
  Jazz: '#e11d48',
  Zong: '#16a34a',
  Telenor: '#0284c7',
  Ufone: '#ea580c',
  Onic: '#7c3aed',
}

export const COPY_TYPES = [
  'B&W copy',
  'Colour copy',
  'B&W print',
  'Colour print',
  'Lamination',
  'Scan',
  'Photo print',
]
export const DEFAULT_RATES: Record<string, number> = {
  'B&W copy': 10,
  'Colour copy': 50,
  'B&W print': 15,
  'Colour print': 60,
  Lamination: 50,
  Scan: 20,
  'Photo print': 50,
}

export const ONLINE_SERVICES = [
  'NIC / Smart card (NADRA)',
  'B-Form / Child registration',
  'Family registration (FRC)',
  'Birth certificate',
  'Death certificate',
  'Marriage certificate (Nikah)',
  'Divorce certificate',
  'Driving license',
  'Learner permit',
  'Domicile',
  'Police character certificate',
  'Passport form',
  'Job form',
  'Admission form',
  'Scholarship form',
  'Electricity / Gas bill',
  'Vehicle token tax',
  'Ehsaas / BISP',
  'Other',
]
