import type { Bags, Board, BudgetCat, BuyCat, Currency, Diet, Item, Kind, Mode, PlaceCat, Rates, Trip } from './types'

// ---------- date ----------

const DAY = 86_400_000
export const parseDay = (d: string) => new Date(d + 'T00:00:00')
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => isoDay(new Date())
export const addDays = (d: string, n: number) => isoDay(new Date(parseDay(d).getTime() + n * DAY))
export const diffDays = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / DAY)

export function eachDay(start: string, end: string) {
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('it-IT', o)
export const fmtDay = (d: string) => fmt({ day: 'numeric', month: 'short' }).format(parseDay(d))
export const fmtDayLong = (d: string) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(parseDay(d))
export const fmtWeekday = (d: string) => fmt({ weekday: 'short' }).format(parseDay(d)).replace('.', '')
export const fmtMonth = (d: string) => fmt({ month: 'short' }).format(parseDay(d)).replace('.', '')
export const fmtRange = (a: string, b: string) =>
  a.slice(0, 7) === b.slice(0, 7)
    ? `${parseDay(a).getDate()} - ${fmt({ day: 'numeric', month: 'long', year: 'numeric' }).format(parseDay(b))}`
    : `${fmtDay(a)} - ${fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(parseDay(b))}`
export function countdown(t: Trip) {
  const now = today()
  const to = diffDays(now, t.start)
  if (to > 1) return `tra ${to} giorni`
  if (to === 1) return 'domani'
  if (now <= t.end) return `giorno ${diffDays(t.start, now) + 1} di ${diffDays(t.start, t.end) + 1}`
  return 'concluso'
}
/** Confronto per codice carattere: '~' dopo le cifre, così "senza orario" va in fondo (localeCompare non lo garantisce). */
export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ---------- valute ----------

export const money = (n: number, c: Currency, compact = false) => {
  try {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency', currency: c, minimumFractionDigits: 0,
      maximumFractionDigits: compact || Number.isInteger(n) ? 0 : 2,
    }).format(n)
  } catch {
    return `${Math.round(n)} ${c}`
  }
}

const currencyNames = new Intl.DisplayNames(['it'], { type: 'currency' })
export const currencyName = (c: Currency) => cap(currencyNames.of(c) ?? c)

/** Elenco valute: quelle con un cambio disponibile, altrimenti quelle note al browser. */
export function currencyList(rates?: Rates) {
  const codes = rates ? Object.keys(rates.rates) : Intl.supportedValuesOf('currency')
  const top = ['EUR', 'USD', 'GBP', 'JPY', 'CHF']
  return [...top, ...codes.filter((c) => !top.includes(c)).sort()]
}

/** Converte tra due valute usando i cambi con base comune. Se manca il cambio restituisce null. */
export function convert(n: number, from: Currency, to: Currency, rates?: Rates): number | null {
  if (from === to) return n
  const a = rates?.rates[from], b = rates?.rates[to]
  return a && b ? (n / a) * b : null
}

export async function fetchRates(): Promise<Rates> {
  const r = await fetch('https://open.er-api.com/v6/latest/EUR')
  const d = await r.json()
  if (d.result !== 'success') throw new Error('rates')
  return { base: 'EUR', date: new Date(d.time_last_update_unix * 1000).toISOString(), rates: d.rates }
}

// ---------- foto delle città da Wikipedia ----------

const BAD_IMAGE = /flag|coat_of_arms|seal|emblem|logo|map|\.svg/i

async function wikiSummaryImage(lang: string, title: string) {
  const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
  if (r.status === 404) return ''
  if (!r.ok) throw new Error('wiki')
  const d = await r.json()
  const src: string | undefined = d.thumbnail?.source
  if (!src || BAD_IMAGE.test(src)) return ''
  return src.replace(/\/\d+px-/, '/1280px-').replace(/\?.*$/, '')
}

/** Foto rappresentativa della città (Wikipedia inglese, con fallback dal titolo italiano). '' se non trovata. */
export async function cityImage(name: string): Promise<string> {
  const direct = await wikiSummaryImage('en', name)
  if (direct) return direct
  const q = await fetch(`https://it.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(name)}&prop=langlinks&lllang=en&redirects=1&format=json&origin=*`).then((r) => r.json())
  const page = Object.values<{ langlinks?: { '*': string }[] }>(q.query?.pages ?? {})[0]
  const en = page?.langlinks?.[0]?.['*']
  return (en && (await wikiSummaryImage('en', en))) || (await wikiSummaryImage('it', name))
}

// ---------- etichette ----------

export const KIND: Record<Kind, string> = {
  flight: 'Volo', stay: 'Alloggio', transport: 'Spostamento', place: 'Posto', buy: 'Da comprare', pass: 'Pass', expense: 'Spesa',
}

export const PLACE_CAT: Record<PlaceCat, string> = {
  sight: 'Da vedere', food: 'Ristoranti', cafe: 'Caffè', sweets: 'Dolci', bar: 'Bar', experience: 'Esperienze', market: 'Supermercati', shop: 'Negozi',
}

export const BUY_CAT: Record<BuyCat, string> = {
  sweet: 'Dolci', savory: 'Salato', drink: 'Bevande', souvenir: 'Souvenir', clothes: 'Vestiti e scarpe', care: 'Cura personale', other: 'Altro',
}

export const DIET: Record<Diet, string> = { vegan: 'Vegano', vegetarian: 'Vegetariano', options: 'Opzioni veg', none: 'Menu normale' }

export const MODE: Record<Mode, string> = {
  plane: 'Aereo', shinkansen: 'Treno veloce', train: 'Treno', metro: 'Metro', bus: 'Bus', taxi: 'Taxi', walk: 'A piedi', ferry: 'Traghetto', car: 'Auto', bike: 'Bici', cable: 'Funivia',
}

export const BOARD: Record<Board, string> = { room: 'Solo pernottamento', breakfast: 'Colazione inclusa', half: 'Mezza pensione', full: 'Pensione completa', all: 'All inclusive' }

export const BUDGET_CAT: Record<BudgetCat, string> = {
  flights: 'Voli', stays: 'Alloggi', taxes: 'Tasse di soggiorno', transport: 'Trasporti', passes: 'Pass', food: 'Cibo', activities: 'Attività', shopping: 'Shopping', other: 'Altro',
}

export const EATS: PlaceCat[] = ['food', 'cafe', 'sweets', 'bar', 'market']

export function budgetCat(i: Item): BudgetCat {
  switch (i.kind) {
    case 'flight': return 'flights'
    case 'stay': return 'stays'
    case 'transport': return 'transport'
    case 'pass': return 'passes'
    case 'buy': return 'shopping'
    case 'expense': return i.expenseCat ?? 'other'
    case 'place': return EATS.includes(i.placeCat ?? 'sight') ? 'food' : 'activities'
  }
}

/** Tassa di soggiorno di un alloggio: per persona per notte × persone × notti. */
export function stayTax(i: Item, t: Trip) {
  if (i.kind !== 'stay' || !i.tax) return null
  const nights = i.date && i.endDate ? diffDays(i.date, i.endDate) : 0
  const people = Math.max(1, t.travelers.length)
  const currency = i.taxCurrency ?? t.currency
  return { perNight: i.tax, nights, people, currency, total: i.tax * nights * people }
}

/** Converte il vecchio testo dei bagagli ("1 bagaglio a mano, 1 da stiva da 23 kg") nei campi strutturati. */
export function parseBaggage(text?: string): Bags | undefined {
  if (!text) return undefined
  const n = (re: RegExp) => { const m = text.match(re); return m ? Number(m[1]) : undefined }
  const bags: Bags = {
    personal: n(/(\d+)\s+(?:piccolo\s+)?bagaglio personale/i),
    cabin: n(/(\d+)\s+bagaglio a mano/i),
    hold: n(/(\d+)\s+bagaglio da stiva/i),
    holdKg: n(/stiva[^\d]*(\d+)\s*kg/i),
  }
  return Object.values(bags).some((v) => v != null) ? bags : undefined
}

/** Totali del viaggio in valuta di casa. I costi senza cambio disponibile finiscono in `unconverted`. */
export function totals(t: Trip, home: Currency, rates?: Rates) {
  let planned = 0, paid = 0, unconverted = 0
  const byCat = {} as Record<BudgetCat, number>
  for (const i of t.items) {
    const amount = (i.cost ?? 0) + (i.baggageCost ?? 0)
    if (!amount) continue
    const v = convert(amount, i.currency ?? t.currency, home, rates)
    if (v == null) { unconverted++; continue }
    planned += v
    if (i.paid) paid += v
    const c = budgetCat(i)
    byCat[c] = (byCat[c] ?? 0) + v
  }
  for (const i of t.items) {
    const tax = stayTax(i, t)
    const v = tax && convert(tax.total, tax.currency, home, rates)
    if (!tax?.total) continue
    if (v == null) { unconverted++; continue }
    planned += v
    byCat.taxes = (byCat.taxes ?? 0) + v
  }
  return { planned, paid, unconverted, byCat }
}

// ---------- mappe e link ----------

function query(i: Item, t: Trip) {
  const city = t.cities.find((c) => c.id === i.cityId)?.name ?? ''
  return [i.title, i.address ?? i.area, city].filter(Boolean).join(', ')
}

export const mapsUrl = (i: Item, t: Trip) =>
  i.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query(i, t))}`

export const directionsUrl = (i: Item, t: Trip) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=transit&destination=${encodeURIComponent(query(i, t))}`

/** Percorso con i mezzi da un elemento all'altro su Google Maps (usa le coordinate se ci sono). */
export function routeUrl(a: Item, b: Item, t: Trip) {
  const q = (i: Item) => (i.pos ? `${i.pos[0]},${i.pos[1]}` : query(i, t))
  return `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${encodeURIComponent(q(a))}&destination=${encodeURIComponent(q(b))}`
}

/** Percorso coi mezzi tra due nomi o coordinate qualsiasi (per i trasferimenti). */
export const transitUrl = (from: string, to: string) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=transit&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}`

export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

export const fileSize = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

// ---------- scadenze ----------

export interface Deadline { id: string; date: string; title: string; itemId?: string }

export function deadlines(t: Trip): Deadline[] {
  const fromItems = t.items
    .filter((i) => i.bookingNeeded && !i.booked && i.bookingOpens)
    .map((i) => ({ id: i.id, date: i.bookingOpens!, title: `Prenotare ${i.title}`, itemId: i.id }))
  const fromChecklist = t.checklist.filter((c) => c.due && !c.done).map((c) => ({ id: c.id, date: c.due!, title: c.text }))
  return [...fromItems, ...fromChecklist].sort((a, b) => a.date.localeCompare(b.date))
}

/** File .ics con promemoria la sera prima di ogni scadenza. Su iPhone e Mac si apre in Calendario. */
export function downloadIcs(t: Trip, list: Deadline[]) {
  const d = (s: string) => s.replaceAll('-', '')
  const ev = list.map((x) =>
    [
      'BEGIN:VEVENT', `UID:${x.id}@viaggi`, `DTSTAMP:${d(today())}T000000Z`,
      `DTSTART;VALUE=DATE:${d(x.date)}`, `DTEND;VALUE=DATE:${d(addDays(x.date, 1))}`,
      `SUMMARY:${x.title} (${t.name})`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${x.title}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'END:VEVENT',
    ].join('\r\n'),
  )
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//viaggi//IT', ...ev, 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `scadenze-${t.id}.ics`
  a.click()
}
