export type Kind = 'flight' | 'stay' | 'transport' | 'place' | 'buy' | 'pass' | 'expense'

export type PlaceCat = 'sight' | 'food' | 'cafe' | 'sweets' | 'bar' | 'experience' | 'market' | 'shop'
export type BuyCat = 'sweet' | 'savory' | 'drink' | 'souvenir' | 'clothes' | 'care' | 'other'
export type Diet = 'vegan' | 'vegetarian' | 'options' | 'none'
export type Mode = 'plane' | 'shinkansen' | 'train' | 'metro' | 'bus' | 'taxi' | 'walk' | 'ferry' | 'car' | 'bike' | 'cable'
export type Board = 'room' | 'breakfast' | 'half' | 'full' | 'all'
export type BudgetCat = 'flights' | 'stays' | 'taxes' | 'transport' | 'passes' | 'food' | 'activities' | 'shopping' | 'other'
export type Currency = string // codice ISO 4217, es. EUR, JPY, VND
export type LatLng = [number, number]

/** File salvato in IndexedDB (biglietto, prenotazione, passaporto…). */
export interface Doc { id: string; name: string; type: string; size: number; travelerId?: string }

export interface Stop { place: string; duration?: string }

/** Bagagli inclusi nel biglietto, per persona. */
export interface Bags { personal?: number; cabin?: number; cabinKg?: number; hold?: number; holdKg?: number }

export interface Item {
  id: string
  kind: Kind
  title: string
  cityId?: string
  placeCat?: PlaceCat
  buyCat?: BuyCat
  expenseCat?: BudgetCat
  diet?: Diet
  date?: string // YYYY-MM-DD
  time?: string // HH:MM
  endDate?: string
  endTime?: string
  order?: number // ordine nella giornata per gli elementi senza orario
  from?: string
  to?: string
  mode?: Mode
  stops?: Stop[] // scali
  duration?: string // durata del volo, es. 20h 15m
  bags?: Bags
  baggage?: string // vecchio campo di testo, convertito in `bags` dalla migrazione v4
  baggageCost?: number // costo bagagli extra
  tax?: number // tassa di soggiorno per persona per notte
  taxCurrency?: Currency
  board?: Board // trattamento alloggio
  ref?: string // numero volo / codice prenotazione
  area?: string
  address?: string
  mapsUrl?: string
  link?: string
  store?: string
  cost?: number
  currency?: Currency
  paid?: boolean
  done?: boolean // visitato / comprato
  fav?: boolean
  bookingNeeded?: boolean
  bookingOpens?: string
  booked?: boolean
  closed?: string
  notes?: string
  photos?: string[] // id foto caricate (IndexedDB)
  files?: Doc[]
  // posizione e dati presi da Google / OpenStreetMap
  pos?: LatLng
  gid?: string
  rating?: number
  ratings?: number
  hours?: string[]
  gphotos?: string[] // URL delle foto di Google
  enriched?: 'google' | 'osm' | 'none'
}

export interface City { id: string; name: string; image?: string; pos?: LatLng }
export interface Traveler { id: string; name: string }

export interface CheckItem { id: string; text: string; group: 'prima' | 'valigia'; done?: boolean; due?: string }

export interface Trip {
  id: string
  name: string
  start: string
  end: string
  cover?: string
  currency: Currency
  budget?: number
  travelers: Traveler[]
  cities: City[]
  items: Item[]
  checklist: CheckItem[]
  docs: Doc[]
}

export interface Settings {
  name: string
  avatar?: string
  home: Currency
  theme: 'auto' | 'light' | 'dark'
  googleKey?: string
}

export interface Rates { base: string; date: string; rates: Record<string, number> }
