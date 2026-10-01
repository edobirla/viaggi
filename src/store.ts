import { useEffect, useState, useSyncExternalStore } from 'react'
import { get, set, del, delMany, entries } from 'idb-keyval'
import type { Doc, Item, LatLng, Rates, Settings, Trip } from './types'
import { cityImage, fetchRates, parseBaggage } from './util'
import { MAX_KM, airportPos, endpointPos, googleEnrich, inBox, km, osmCandidates, osmEnrich, osmSearch, placePos, tripBox, type Box } from './geo'

// ponytail: tutto lo stato in un solo oggetto in IndexedDB. Nella fase sync questo è l'unico modulo da cambiare.
type State = { version: number; trips: Trip[]; settings: Settings; rates?: Rates; geo: Record<string, LatLng | null> }
const KEY = 'state-v2'
const VERSION = 4
const DEFAULT_SETTINGS: Settings = { name: '', home: 'EUR', theme: 'auto' }

let state: State = { version: VERSION, trips: [], settings: DEFAULT_SETTINGS, geo: {} }
const subs = new Set<() => void>()

function commit(next: State) {
  state = next
  subs.forEach((f) => f())
  set(KEY, state)
}

/** Porta i dati salvati alla versione attuale senza perdere quello che hai inserito. */
function migrate(s: State): State {
  let trips = s.trips.map((t) => ({ ...t, travelers: t.travelers ?? [] }))
  if ((s.version ?? 2) < 4) {
    // v4: bagagli da testo a campi, durata del volo come campo invece che nelle note
    trips = trips.map((t) => ({
      ...t,
      items: t.items.map((i) => {
        if (i.kind !== 'flight') return i
        const { baggage, ...rest } = i
        const m = i.notes?.match(/\s*Durata (\d+h \d+m)\.?/)
        return {
          ...rest,
          bags: i.bags ?? parseBaggage(baggage),
          duration: i.duration ?? m?.[1],
          notes: m ? i.notes!.replace(m[0], '').trim() || undefined : i.notes,
        }
      }),
    }))
  }
  return { ...s, version: VERSION, trips, geo: s.geo ?? {}, settings: { ...DEFAULT_SETTINGS, ...s.settings } }
}

export const ready = get<State>(KEY).then((s) => {
  // prima installazione: app vuota (i viaggi si creano o si caricano da un backup nelle Impostazioni)
  state = s ? migrate(s) : { version: VERSION, trips: [], settings: DEFAULT_SETTINGS, geo: {} }
  if (!s || s.version !== VERSION) set(KEY, state)
  subs.forEach((f) => f())
  refreshRates()
  ;(async () => { for (const t of state.trips) { await fillCityImages(t.id); await enrichTrip(t.id) } })()
})

const subscribe = (f: () => void) => (subs.add(f), () => subs.delete(f))
const useSelect = <T,>(sel: (s: State) => T) => useSyncExternalStore(subscribe, () => sel(state))

export const useTrips = () => useSelect((s) => s.trips)
export const useTrip = (id: string) => useTrips().find((t) => t.id === id)
export const useSettings = () => useSelect((s) => s.settings)
export const useRates = () => useSelect((s) => s.rates)
export const getRates = () => state.rates
export const useGeo = () => useSelect((s) => s.geo)

export const uid = () => crypto.randomUUID().slice(0, 8)

// ---------- azioni ----------

export const updateSettings = (p: Partial<Settings>) => commit({ ...state, settings: { ...state.settings, ...p } })

export function updateTrip(id: string, fn: (t: Trip) => Trip) {
  commit({ ...state, trips: state.trips.map((t) => (t.id === id ? fn(t) : t)) })
}

export function addTrip(t: Trip) {
  commit({ ...state, trips: [...state.trips, t] })
  fillCityImages(t.id)
}

export function deleteTrip(id: string) {
  const t = state.trips.find((x) => x.id === id)
  commit({ ...state, trips: state.trips.filter((x) => x.id !== id) })
  if (!t) return
  const keys = [
    ...(t.cover ? ['photo:' + t.cover] : []),
    ...t.docs.map((d) => 'file:' + d.id),
    ...t.items.flatMap((i) => [...(i.photos ?? []).map((p) => 'photo:' + p), ...(i.files ?? []).map((f) => 'file:' + f.id)]),
  ]
  delMany(keys)
}

export function saveItem(tripId: string, item: Item) {
  const old = state.trips.find((t) => t.id === tripId)?.items.find((i) => i.id === item.id)
  const moved = !old || ['title', 'address', 'area', 'cityId'].some((k) => old[k as keyof Item] !== item[k as keyof Item])
  // nome o indirizzo cambiati: posizione e foto di Google vanno ricercate
  const next = moved && old?.enriched ? { ...item, enriched: undefined, pos: undefined, gphotos: undefined, rating: undefined, ratings: undefined, hours: undefined, gid: undefined } : item
  updateTrip(tripId, (t) => {
    const exists = t.items.some((i) => i.id === item.id)
    return { ...t, items: exists ? t.items.map((i) => (i.id === item.id ? next : i)) : [...t.items, next] }
  })
  if (moved) enrichTrip(tripId)
}

export function patchItem(tripId: string, id: string, patch: Partial<Item>) {
  updateTrip(tripId, (t) => ({ ...t, items: t.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }))
}

export function deleteItem(tripId: string, item: Item) {
  updateTrip(tripId, (t) => ({ ...t, items: t.items.filter((i) => i.id !== item.id) }))
  delMany([...(item.photos ?? []).map((p) => 'photo:' + p), ...(item.files ?? []).map((f) => 'file:' + f.id)])
}

/** Foto da Wikipedia e coordinate per le città che non le hanno ancora. image '' = cercata, non trovata. */
export async function fillCityImages(tripId: string) {
  const t = state.trips.find((x) => x.id === tripId)
  for (const c of t?.cities.filter((c) => c.image === undefined || !c.pos) ?? []) {
    const image = c.image ?? (await cityImage(c.name).catch(() => undefined))
    const pos = c.pos ?? (await osmSearch(c.name).catch(() => null)) ?? undefined
    updateTrip(tripId, (x) => ({ ...x, cities: x.cities.map((y) => (y.id === c.id ? { ...y, image, pos } : y)) }))
  }
}

// ---------- posizione e foto dei posti ----------

type Progress = { running: boolean; done: number; total: number; error?: string }
let progress: Progress = { running: false, done: 0, total: 0 }
const setProgress = (p: Partial<Progress>) => { progress = { ...progress, ...p }; subs.forEach((f) => f()) }
export const useEnrichProgress = () => useSyncExternalStore(subscribe, () => progress)

const needsEnrich = (i: Item, google: boolean) =>
  (i.kind === 'place' || (i.kind === 'stay' && !!i.address)) && (!i.enriched || (google && i.enriched !== 'google'))

/**
 * Cerca posizione (e con la chiave Google anche foto, voto e orari) dei posti che non li hanno.
 * Senza chiave usa OpenStreetMap, gratis ma solo coordinate. Una coda alla volta.
 */
export async function enrichTrip(tripId: string, force = false) {
  if (progress.running) return
  const key = state.settings.googleKey
  const t = state.trips.find((x) => x.id === tripId)
  if (!t) return
  const todo = t.items.filter((i) => (force && (i.kind === 'place' || (i.kind === 'stay' && !!i.address))) || needsEnrich(i, !!key))
  if (!todo.length) return
  setProgress({ running: true, done: 0, total: todo.length, error: undefined })
  for (const i of todo) {
    const trip = state.trips.find((x) => x.id === tripId)
    if (!trip) break
    try {
      const patch = key ? await googleEnrich(i, trip, key) : await osmEnrich(i, trip)
      patchItem(tripId, i.id, patch)
    } catch (e) {
      setProgress({ error: (e as Error).message })
      break // chiave sbagliata o servizio che ci rallenta: inutile insistere, si riprova al prossimo avvio
    }
    setProgress({ done: progress.done + 1 })
  }
  setProgress({ running: false })
}

/** Cerca subito un solo posto (tasto nella scheda), anche se la coda automatica è in corso. Restituisce un messaggio per l'utente. */
export async function enrichOne(tripId: string, itemId: string): Promise<string> {
  const t = state.trips.find((x) => x.id === tripId)
  const i = t?.items.find((x) => x.id === itemId)
  if (!t || !i) return 'Elemento non trovato'
  const key = state.settings.googleKey
  try {
    const patch = key ? await googleEnrich(i, t, key) : await osmEnrich(i, t)
    patchItem(tripId, itemId, patch)
    if (patch.enriched === 'none') return 'Non ho trovato questo posto. Aggiungi indirizzo o zona e riprova.'
    if (key) return `Trovato su Google: posizione, ${patch.gphotos?.length ?? 0} foto${patch.hours ? ' e orari' : ''}`
    return 'Posizione trovata. Per foto, orari e recensioni aggiungi la chiave Google nelle Impostazioni.'
  } catch (e) {
    return (e as Error).message
  }
}

/** Coordinate di aeroporti e città (km percorsi, durate dei trasferimenti), con cache. Con `box` i nomi si cercano vicino al viaggio. */
export async function resolvePlaces(names: string[], box?: Box) {
  for (const n of names) {
    const k = n.trim().toLowerCase()
    const cached = state.geo[k]
    // già in cache: va bene, a meno che sia fuori dall'area del viaggio (es. "Nara" trovata in un altro paese)
    if (!k || (k in state.geo && !(box && cached && !inBox(cached, box)))) continue
    const pos = await placePos(n, box).catch(() => undefined)
    if (pos === undefined) continue // offline
    commit({ ...state, geo: { ...state.geo, [k]: pos } })
  }
}
/**
 * Coordinate dei punti dei trasferimenti. Per i nomi ambigui sceglie il risultato più vicino all'altro capo della tratta
 * (o a una città del viaggio) e ricerca le tratte con distanze impossibili per quel mezzo.
 */
let resolvingTransfers = false
export async function resolveTransfers(tripId: string) {
  const t0 = state.trips.find((x) => x.id === tripId)
  if (!t0 || resolvingTransfers) return
  resolvingTransfers = true
  try { await resolveTransfersOf(t0, tripId) } finally { resolvingTransfers = false }
}

async function resolveTransfersOf(t0: Trip, tripId: string) {
  const box = tripBox(t0)
  const stays = new Set(t0.items.filter((i) => i.kind === 'stay').map((i) => i.title.trim().toLowerCase()))
  const cityPos = t0.cities.map((c) => c.pos).filter((p): p is LatLng => !!p)
  const moves = t0.items.filter((i) => i.kind === 'transport' && i.from && i.to)
  // prima i nomi che sono città del viaggio: fanno da riferimento per gli altri
  const order = [...moves].sort((a, b) => Number(!!b.from && isCity(b.from)) - Number(!!a.from && isCity(a.from)))
  function isCity(n: string) { return t0!.cities.some((c) => c.name.toLowerCase() === n.trim().toLowerCase()) }

  for (const i of order) {
    for (const [name, other] of [[i.from!, i.to!], [i.to!, i.from!]]) {
      const n = name.trim().toLowerCase()
      if (stays.has(n)) continue
      const k = 't:' + n // cache separata: posizioni scelte in base all'altro capo della tratta
      const t = state.trips.find((x) => x.id === tripId)!
      const here = state.geo[k], there = endpointPos(other, t, state.geo)
      const tooFar = here && there && km(here, there) > (MAX_KM[i.mode ?? 'train'] ?? Infinity)
      const outside = here && box && !inBox(here, box)
      if (k in state.geo && !tooFar && !outside) continue
      if (tooFar && isCity(name)) continue // la città è giusta, sarà l'altro capo a essere ricercato
      try {
        let pos: LatLng | null
        if (/^[A-Z]{3}$/.test(name.trim())) pos = await airportPos(name.trim())
        else {
          const cands = await osmCandidates(name, box)
          const ref = there ? [there] : cityPos
          pos = cands.sort((a, b) => Math.min(...ref.map((r) => km(a, r))) - Math.min(...ref.map((r) => km(b, r))))[0] ?? null
        }
        commit({ ...state, geo: { ...state.geo, [k]: pos } })
      } catch { return } // OpenStreetMap occupato: riprova alla prossima apertura
    }
  }
}

export const cachedPos = (name?: string) => (name ? state.geo[name.trim().toLowerCase()] ?? undefined : undefined)

export async function refreshRates(force = false) {
  const age = state.rates ? Date.now() - new Date(state.rates.date).getTime() : Infinity
  if (!force && age < 12 * 3600_000) return
  const rates = await fetchRates().catch(() => undefined)
  if (rates) commit({ ...state, rates })
  else if (force) throw new Error('Cambi non disponibili, sei online?')
}

// ---------- foto ----------

export async function savePhoto(file: File): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height))
  const canvas = new OffscreenCanvas(Math.round(bmp.width * scale), Math.round(bmp.height * scale))
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 })
  const id = uid()
  await set('photo:' + id, blob)
  return id
}

// ponytail: gli object URL restano in cache per la sessione, sono poche decine
const urls = new Map<string, string>()
function useBlobUrl(key?: string) {
  const [url, setUrl] = useState(key ? urls.get(key) : undefined)
  useEffect(() => {
    if (!key) return setUrl(undefined)
    if (urls.has(key)) return setUrl(urls.get(key))
    let live = true
    get<Blob>(key).then((b) => {
      if (!b || !live) return
      urls.set(key, URL.createObjectURL(b))
      setUrl(urls.get(key))
    })
    return () => { live = false }
  }, [key])
  return url
}

export const usePhoto = (id?: string) => useBlobUrl(id && 'photo:' + id)
export const deletePhoto = (id: string) => del('photo:' + id)

// ---------- file (biglietti, documenti) ----------

export async function saveFile(file: File): Promise<Doc> {
  const id = uid()
  await set('file:' + id, file)
  return { id, name: file.name, type: file.type || 'application/octet-stream', size: file.size }
}

export const useFileUrl = (id?: string) => useBlobUrl(id && 'file:' + id)
export const getFile = (id: string) => get<Blob>('file:' + id)
export function deleteFile(id: string) {
  const u = urls.get('file:' + id)
  if (u) URL.revokeObjectURL(u)
  urls.delete('file:' + id)
  return del('file:' + id)
}

// ---------- backup ----------

const toDataUrl = (b: Blob) =>
  new Promise<string>((r) => {
    const fr = new FileReader()
    fr.onload = () => r(fr.result as string)
    fr.readAsDataURL(b)
  })

export async function exportBackup() {
  const files: Record<string, string> = {}
  for (const [k, v] of await entries()) if (v instanceof Blob) files[k as string] = await toDataUrl(v)
  const blob = new Blob([JSON.stringify({ version: 2, state, files })], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `viaggi-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text())
  if (data?.version !== 2 || !Array.isArray(data.state?.trips)) throw new Error('Questo file non è un backup valido di Viaggi.')
  for (const [k, v] of Object.entries<string>(data.files ?? {})) await set(k, await (await fetch(v)).blob())
  commit(migrate(data.state))
}

export async function wipeAll() {
  for (const [k] of await entries()) await del(k)
  location.reload()
}
