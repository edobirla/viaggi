import { useEffect, useState } from 'react'
import type { Item, LatLng, Mode, Trip } from './types'

// =========================================================
// Distanze
// =========================================================

export function km(a: LatLng, b: LatLng) {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export const fmtKm = (d: number) =>
  d < 1 ? `${Math.round(d * 1000 / 10) * 10} m` : d < 10 ? `${d.toFixed(1).replace('.', ',')} km` : `${Math.round(d).toLocaleString('it-IT')} km`

/** Tempo a piedi approssimato (5 km/h), utile sotto i 2 km. */
export const walk = (d: number) => `${Math.max(1, Math.round((d / 5) * 60))} min a piedi`

/**
 * Tempo stimato di una tratta: a piedi sotto 1,2 km, altrimenti con i mezzi.
 * ponytail: stima fissa (10 min tra camminata e attesa + 22 km/h di media in città in linea d'aria);
 * il tempo vero lo dà Google Maps dal link "percorso". Con le Routes API si potrebbe calcolare esatto.
 */
export function travelTime(d: number) {
  return d < 1.2 ? walk(d) : `${transferTime(d, 'metro')} coi mezzi`
}

/**
 * Ordina le tappe con "vicino più vicino" partendo da `start` (es. l'hotel).
 * ponytail: euristica greedy, va bene fino a una decina di tappe al giorno; per percorsi ottimi servirebbe un TSP vero.
 */
export function nearestOrder<T extends { pos?: LatLng }>(list: T[], start?: LatLng): T[] {
  const withPos = list.filter((x) => x.pos), without = list.filter((x) => !x.pos)
  const out: T[] = []
  let cur = start ?? withPos[0]?.pos
  const left = [...withPos]
  while (left.length) {
    let best = 0
    left.forEach((x, i) => { if (cur && km(cur, x.pos!) < km(cur, left[best].pos!)) best = i })
    const [next] = left.splice(best, 1)
    out.push(next)
    cur = next.pos
  }
  return [...out, ...without]
}

const fmtMin = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`)

// km/h medi in linea d'aria e minuti fissi (attese, controlli, camminate per arrivare al mezzo)
const SPEED: Record<Mode, [number, number]> = {
  walk: [4.5, 0], bike: [14, 0], metro: [26, 8], bus: [20, 8], train: [55, 10], shinkansen: [190, 20],
  taxi: [28, 5], car: [40, 5], ferry: [25, 15], cable: [12, 5], plane: [600, 90],
}

/** Durata stimata di un trasferimento con un certo mezzo. ponytail: stima, il tempo vero è nel link al percorso. */
export function transferTime(d: number, mode: Mode = 'train') {
  const [kmh, extra] = SPEED[mode]
  return '~' + fmtMin(Math.max(5, Math.round(extra + (d / kmh) * 60)))
}

/** Punto di partenza/arrivo di un trasferimento: un alloggio del viaggio ("Hotel a Tokyo") o un nome/codice cercato prima. */
export function endpointPos(name: string | undefined, trip: Trip, geo: Record<string, LatLng | null>): LatLng | undefined {
  if (!name) return
  const n = name.trim().toLowerCase()
  const stay = trip.items.find((i) => i.kind === 'stay' && i.title.trim().toLowerCase() === n)
  if (stay) return stay.pos ?? trip.cities.find((c) => c.id === stay.cityId)?.pos
  return geo['t:' + n] ?? geo[n] ?? undefined
}

/** Nomi da cercare per i trasferimenti (esclusi gli alloggi, che hanno già una posizione). */
export function transferNames(trip: Trip) {
  const stays = new Set(trip.items.filter((i) => i.kind === 'stay').map((i) => i.title.trim().toLowerCase()))
  return [...new Set(trip.items.filter((i) => i.kind === 'transport').flatMap((i) => [i.from, i.to]))]
    .filter((x): x is string => !!x && !stays.has(x.trim().toLowerCase()))
}

/** Durata di un trasferimento: quella scritta a mano, altrimenti la stima dalla distanza. */
export function transferDuration(i: Item, trip: Trip, geo: Record<string, LatLng | null>) {
  if (i.duration) return i.duration
  const a = endpointPos(i.from, trip, geo), b = endpointPos(i.to, trip, geo)
  return a && b ? transferTime(km(a, b), i.mode) : undefined
}

// =========================================================
// Posizione dell'utente
// =========================================================

let myPos: LatLng | undefined
export function useMyPosition(enabled: boolean) {
  const [pos, setPos] = useState(myPos)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    if (!navigator.geolocation) return setError('Posizione non disponibile su questo dispositivo')
    const id = navigator.geolocation.watchPosition(
      (p) => { myPos = [p.coords.latitude, p.coords.longitude]; setPos(myPos); setError('') },
      (e) => setError(e.code === 1 ? 'Hai negato l\'accesso alla posizione. Attivalo nelle impostazioni del browser.' : 'Non riesco a trovare la tua posizione'),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])
  return { pos, error }
}

// =========================================================
// Geocoding gratuito
// =========================================================

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let lastOsm = 0
let osmPausedUntil = 0

/** OpenStreetMap Nominatim: gratis, massimo 1 richiesta al secondo. Se ci rallenta, si ferma per 10 minuti. */
/** Riquadro [ovest, sud, est, nord] attorno alle città del viaggio, per non trovare "Nara" in un altro continente. */
export type Box = [number, number, number, number]
export function tripBox(trip: Trip): Box | undefined {
  const p = trip.cities.map((c) => c.pos).filter((x): x is LatLng => !!x)
  if (!p.length) return
  const lat = p.map((x) => x[0]), lng = p.map((x) => x[1])
  return [Math.min(...lng) - 1.5, Math.min(...lat) - 1.5, Math.max(...lng) + 1.5, Math.max(...lat) + 1.5]
}
export const inBox = (p: LatLng, b: Box) => p[1] >= b[0] && p[1] <= b[2] && p[0] >= b[1] && p[0] <= b[3]

export async function osmSearch(q: string, box?: Box): Promise<LatLng | null> {
  return (await osmCandidates(q, box, 1))[0] ?? null
}

/** Più risultati per lo stesso nome (es. le diverse "Kibune" del Giappone). */
export async function osmCandidates(q: string, box?: Box, limit = 5): Promise<LatLng[]> {
  if (Date.now() < osmPausedUntil) throw new Error('OpenStreetMap è occupato, riprovo tra qualche minuto')
  const wait = 1100 - (Date.now() - lastOsm)
  if (wait > 0) await sleep(wait)
  lastOsm = Date.now()
  const area = box ? `&viewbox=${box.join(',')}&bounded=1` : ''
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=${limit}&accept-language=it${area}&q=${encodeURIComponent(q)}`)
    .catch(() => null) // un 429 senza intestazioni CORS arriva qui come errore di rete
  if (!r?.ok) {
    osmPausedUntil = Date.now() + 10 * 60_000
    throw new Error('OpenStreetMap è occupato, riprovo tra qualche minuto')
  }
  return ((await r.json()) as { lat: string; lon: string }[]).map((h) => [Number(h.lat), Number(h.lon)] as LatLng)
}

// distanza massima credibile di una tratta per mezzo: oltre, uno dei due nomi è stato trovato nel posto sbagliato
export const MAX_KM: Partial<Record<Mode, number>> = { walk: 15, bike: 60, metro: 80, bus: 400, taxi: 150, cable: 20, train: 700, ferry: 600, car: 1200 }

/** Coordinate di un aeroporto dal codice IATA (Wikidata). */
export async function airportPos(code: string): Promise<LatLng | null> {
  const q = `SELECT ?c WHERE { ?a wdt:P238 "${code.replace(/[^A-Z]/g, '')}"; wdt:P625 ?c } LIMIT 1`
  const r = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`)
  const v: string | undefined = (await r.json()).results?.bindings?.[0]?.c?.value
  const m = v?.match(/Point\(([-\d.]+) ([-\d.]+)\)/)
  return m ? [Number(m[2]), Number(m[1])] : null
}

/** Coordinate di un luogo generico: codice aeroporto o nome. */
export async function placePos(name: string, box?: Box) {
  if (/^[A-Z]{3}$/.test(name.trim())) return airportPos(name.trim())
  // prima nell'area del viaggio, poi ovunque (es. città di scalo lontane)
  return (box && (await osmSearch(name, box))) || osmSearch(name)
}

// =========================================================
// Google Places (richiede la chiave nelle impostazioni)
// =========================================================

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location', 'places.googleMapsUri', 'places.websiteUri',
  'places.rating', 'places.userRatingCount', 'places.regularOpeningHours.weekdayDescriptions', 'places.photos',
].join(',')

export async function googleEnrich(i: Item, trip: Trip, key: string): Promise<Partial<Item>> {
  const city = trip.cities.find((c) => c.id === i.cityId)
  const body: Record<string, unknown> = { textQuery: [i.title, i.address ?? i.area, city?.name].filter(Boolean).join(', '), languageCode: 'it', maxResultCount: 1 }
  if (city?.pos) body.locationBias = { circle: { center: { latitude: city.pos[0], longitude: city.pos[1] }, radius: 30000 } }
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify(body),
  })
  if (r.status === 400 || r.status === 403) throw new Error('Chiave Google non valida o API non attivata')
  if (!r.ok) throw new Error('Google non risponde')
  const p = (await r.json()).places?.[0]
  if (!p) return { enriched: 'none' }

  // ponytail: al massimo 6 foto per posto, ogni foto è una richiesta a pagamento oltre la soglia gratuita
  const gphotos: string[] = []
  for (const ph of (p.photos ?? []).slice(0, 6)) {
    const m = await fetch(`https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=1400&skipHttpRedirect=true&key=${key}`)
    if (m.ok) gphotos.push((await m.json()).photoUri)
  }
  return {
    enriched: 'google',
    gid: p.id,
    pos: p.location ? [p.location.latitude, p.location.longitude] : undefined,
    mapsUrl: i.mapsUrl || p.googleMapsUri,
    link: i.link || p.websiteUri,
    address: i.address || p.formattedAddress,
    rating: p.rating,
    ratings: p.userRatingCount,
    hours: p.regularOpeningHours?.weekdayDescriptions,
    gphotos,
  }
}

/** Solo coordinate da OpenStreetMap: prima con indirizzo, poi col nome. */
export async function osmEnrich(i: Item, trip: Trip): Promise<Partial<Item>> {
  const city = trip.cities.find((c) => c.id === i.cityId)?.name ?? ''
  const tries = [
    i.address && [i.address, i.area, city].filter(Boolean).join(', '),
    [i.title, city].filter(Boolean).join(', '),
    i.area && [i.area, city].join(', '),
  ].filter(Boolean) as string[]
  const box = tripBox(trip)
  for (const q of tries) {
    const pos = await osmSearch(q, box)
    if (pos) return { pos, enriched: 'osm' }
  }
  return { enriched: 'none' }
}
