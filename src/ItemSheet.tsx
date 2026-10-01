import { useEffect, useState } from 'react'
import {
  AirplaneInFlight, ArrowUpRight, Backpack, Camera, Copy, MapTrifold, MagnifyingGlass, Minus, NavigationArrow, PencilSimple, Plus, Star, Suitcase,
  SuitcaseRolling, Ticket, Trash, X,
} from '@phosphor-icons/react'
import type { Bags, Board, BudgetCat, BuyCat, Diet, Doc, Item, Mode, PlaceCat, Stop, Trip } from './types'
import { deleteItem, enrichOne, patchItem, resolveTransfers, savePhoto, saveItem, useGeo, useRates, useSettings } from './store'
import {
  BOARD, BUDGET_CAT, BUY_CAT, DIET, EATS, KIND, MODE, PLACE_CAT, cap, convert, directionsUrl, fmtDay, fmtDayLong, hostOf, mapsUrl, money, stayTax, transitUrl,
} from './util'
import { endpointPos, fmtKm, km, transferDuration, useMyPosition, walk } from './geo'
import {
  CurrencyButton, DietBadge, Field, FileList, Gallery, Options, Sheet, SheetTop, StarBtn, SwitchRow, ask, hueClass, iconFor, toast, useDocOpener,
} from './ui'

/** Sheet per vedere, creare o modificare qualsiasi elemento. Un `item` che non è ancora nel viaggio = nuovo. */
export function ItemSheet({ trip, item, onClose }: { trip: Trip; item?: Item; onClose: () => void }) {
  return (
    <Sheet open={!!item} onClose={onClose}>
      {item && <Inner key={item.id} trip={trip} initial={item} onClose={onClose} />}
    </Sheet>
  )
}

function Inner({ trip, initial, onClose }: { trip: Trip; initial: Item; onClose: () => void }) {
  const live = trip.items.find((i) => i.id === initial.id)
  const [editing, setEditing] = useState(!live)
  if (editing || !live) return <Editor trip={trip} initial={live ?? initial} isNew={!live} onClose={onClose} onSaved={() => setEditing(false)} />
  return <Detail trip={trip} item={live} onClose={onClose} onEdit={() => setEditing(true)} />
}

function subtitle(i: Item, trip: Trip) {
  const city = trip.cities.find((c) => c.id === i.cityId)?.name
  const cat = i.kind === 'place' ? PLACE_CAT[i.placeCat ?? 'sight'] : i.kind === 'buy' ? BUY_CAT[i.buyCat ?? 'other'] : i.kind === 'transport' && i.mode ? MODE[i.mode] : KIND[i.kind]
  return [cat, i.area, city].filter(Boolean).join(' · ')
}

/** "Carta d'imbarco di Edoardo", "Prenotazione", "Biglietto 2"… */
export function docLabel(i: Item, d: Doc, trip: Trip) {
  const files = i.files ?? []
  const base = i.kind === 'flight' ? 'Carta d\'imbarco' : i.kind === 'stay' ? 'Prenotazione' : 'Biglietto'
  const owner = trip.travelers.find((t) => t.id === d.travelerId)?.name.split(' ')[0]
  const same = files.filter((f) => f.travelerId === d.travelerId)
  const n = same.length > 1 ? ` ${same.indexOf(d) + 1}` : ''
  return owner ? `${base} di ${owner}${n}` : `${base}${n}`
}

const bagParts = (b?: Bags) => [
  b?.personal ? { Icon: Backpack, label: 'Personale', qty: b.personal } : null,
  b?.cabin ? { Icon: Suitcase, label: 'A mano', qty: b.cabin, kg: b.cabinKg } : null,
  b?.hold ? { Icon: SuitcaseRolling, label: 'Da stiva', qty: b.hold, kg: b.holdKg } : null,
].filter((x) => !!x)

const stopsLabel = (s?: Stop[]) => (!s?.length ? 'Diretto' : s.length === 1 ? '1 scalo' : `${s.length} scali`)

// =========================================================
// Dettaglio
// =========================================================

function Detail({ trip, item: i, onClose, onEdit }: { trip: Trip; item: Item; onClose: () => void; onEdit: () => void }) {
  const home = useSettings().home
  const rates = useRates()
  const settings = useSettings()
  const [searching, setSearching] = useState(false)
  const { pos: me } = useMyPosition(false)
  const [allHours, setAllHours] = useState(false)
  const [openDoc, viewer] = useDocOpener()
  const tax = stayTax(i, trip)
  const geo = useGeo()
  useEffect(() => { if (i.kind === 'transport') resolveTransfers(trip.id) }, [i.kind, i.from, i.to]) // eslint-disable-line react-hooks/exhaustive-deps
  const dur = i.kind === 'transport' ? transferDuration(i, trip, geo) : undefined
  // per il link al percorso: coordinate se le abbiamo (es. l'hotel), altrimenti il nome
  const ep = (name?: string) => { const p = endpointPos(name, trip, geo); return p ? `${p[0]},${p[1]}` : name ?? '' }
  const patch = (p: Partial<Item>) => patchItem(trip.id, i.id, p)
  const Icon = iconFor(i)
  const hasMap = i.kind === 'place' || i.kind === 'stay'
  const cur = i.currency ?? trip.currency
  const conv = (n: number) => (cur !== home ? convert(n, cur, home, rates) : null)
  const dist = me && i.pos ? km(me, i.pos) : undefined
  const today = (new Date().getDay() + 6) % 7 // Google elenca da lunedì

  async function addPhoto(f?: File) {
    if (!f) return
    try { patch({ photos: [...(i.photos ?? []), await savePhoto(f)] }) } catch { toast('Non riesco a leggere la foto') }
  }

  async function remove() {
    if (!(await ask(`Eliminare “${i.title}”?`, 'Elimina', 'Verranno eliminati anche foto e file allegati.'))) return
    deleteItem(trip.id, i)
    onClose()
  }

  async function research() {
    setSearching(true)
    toast(settings.googleKey ? 'Cerco su Google…' : 'Cerco la posizione…')
    toast(await enrichOne(trip.id, i.id))
    setSearching(false)
  }

  const when =
    i.kind === 'stay' || i.kind === 'pass' ? [i.date && `dal ${fmtDay(i.date)}`, i.endDate && `al ${fmtDay(i.endDate)}`].filter(Boolean).join(' ')
    : i.date ? cap(fmtDayLong(i.date)) + (i.time && i.kind !== 'flight' ? `, ${i.time}` : '') : ''

  const photos = [...(i.photos ?? [])], remote = i.gphotos ?? []

  return (
    <>
      <SheetTop title={KIND[i.kind]} onClose={onClose}
        right={<button className="icon-btn glass" onClick={onEdit} aria-label="Modifica"><PencilSimple size={19} weight="bold" /></button>} />
      <div className="sheet-body">
        {photos.length || remote.length ? (
          <Gallery ids={photos} remote={remote} onChange={(p) => patch({ photos: p })} />
        ) : (
          <label className={'tint-hero tintbox ' + hueClass(i)} style={{ cursor: 'pointer', position: 'relative' }}>
            <Icon size={56} weight="duotone" />
            <span className="pill-glass" style={{ position: 'absolute', right: 12, bottom: 12, color: 'var(--ink)', background: 'var(--glass-strong)' }}>
              <Camera size={16} weight="bold" />Foto
            </span>
            <input type="file" accept="image/*" hidden onChange={(e) => addPhoto(e.target.files?.[0])} />
          </label>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="d-title">{i.title}</h2>
            <p className="d-sub">{subtitle(i, trip)}</p>
          </div>
          {(i.kind === 'place' || i.kind === 'stay' || i.kind === 'buy') && <StarBtn on={i.fav} onChange={() => patch({ fav: !i.fav })} size={26} />}
        </div>

        <div className="badges">
          {i.rating != null && <span className="badge rating"><Star size={12} weight="fill" />{i.rating.toFixed(1).replace('.', ',')}{i.ratings ? ` (${i.ratings.toLocaleString('it-IT')})` : ''}</span>}
          {i.kind === 'place' && EATS.includes(i.placeCat ?? 'sight') && <DietBadge diet={i.diet} showUnknown />}
          {i.kind === 'stay' && i.board && <span className="badge plain">{BOARD[i.board]}</span>}
          {i.bookingNeeded && <span className={'badge ' + (i.booked ? 'vegan' : 'warn')}>{i.booked ? 'Prenotato' : 'Da prenotare'}</span>}
          {i.closed && <span className="badge plain">Chiuso {i.closed}</span>}
          {dist != null && <span className="badge plain">{fmtKm(dist)} da te{dist < 2 ? ` · ${walk(dist)}` : ''}</span>}
        </div>

        {i.kind === 'flight' && (
          <div className="card ticket" style={{ marginTop: 18 }}>
            <div className="pass">
              <div className="code">{i.from ?? '?'}<small>{i.time ?? 'partenza'}</small></div>
              <div className="mid"><AirplaneInFlight size={22} weight="duotone" />{i.duration && <b className="dur">{i.duration}</b>}{stopsLabel(i.stops)}</div>
              <div className="code">{i.to ?? '?'}<small>{i.endTime ?? 'arrivo'}{i.endDate && i.date && i.endDate !== i.date ? ' +1' : ''}</small></div>
            </div>
            {!!i.stops?.length && (
              <div className="stops">
                {i.stops.map((s, n) => <span key={n}>Scalo a <b>{s.place}</b>{s.duration ? `, ${s.duration}` : ''}</span>)}
              </div>
            )}
            <div className="foot">
              <div>Data<b>{i.date ? fmtDay(i.date) : '-'}</b></div>
              <div style={{ textAlign: 'right' }}>Compagnia / volo<b>{i.ref ?? '-'}</b></div>
            </div>
          </div>
        )}

        {i.kind === 'flight' && (bagParts(i.bags).length > 0 || i.baggageCost != null) && (
          <>
            <div className="group-title">Bagagli inclusi<span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>per persona</span></div>
            <div className="bags">
              {bagParts(i.bags).map(({ Icon, label, qty, kg }) => (
                <div key={label} className="bag card">
                  <Icon size={26} weight="duotone" />
                  <b>{qty} × {label}</b>
                  <span>{kg ? `fino a ${kg} kg` : label === 'Personale' ? 'sotto il sedile' : 'peso non indicato'}</span>
                </div>
              ))}
              {i.baggageCost != null && (
                <div className="bag card extra">
                  <Plus size={26} weight="bold" />
                  <b>{money(i.baggageCost, cur)}</b>
                  <span>bagagli extra</span>
                </div>
              )}
            </div>
          </>
        )}

        {i.kind === 'transport' && (
          <>
            {(i.from || i.to) && (
              <div className="card ticket" style={{ marginTop: 18 }}>
                <div className="pass">
                  <div className="code" style={{ fontSize: 22 }}>{i.from ?? '?'}<small>{i.time ?? ''}</small></div>
                  <div className="mid"><Icon size={22} weight="duotone" />{dur && <b className="dur">{dur}</b>}</div>
                  <div className="code" style={{ fontSize: 22 }}>{i.to ?? '?'}<small>{i.endTime ?? ''}</small></div>
                </div>
              </div>
            )}
            <div className="group-title">Mezzo</div>
            <div className="form"><Options<Mode> options={MODE} value={i.mode} onChange={(m) => patch({ mode: m })} /></div>
          </>
        )}

        <div className="quick">
          {hasMap && <a href={mapsUrl(i, trip)} target="_blank" rel="noreferrer"><MapTrifold size={24} weight="duotone" />Mappa</a>}
          {hasMap && <a href={directionsUrl(i, trip)} target="_blank" rel="noreferrer"><NavigationArrow size={24} weight="duotone" />Indicazioni</a>}
          {i.kind === 'transport' && i.from && i.to && <a href={transitUrl(ep(i.from), ep(i.to))} target="_blank" rel="noreferrer"><NavigationArrow size={24} weight="duotone" />Percorso</a>}
          {i.link && <a href={i.link} target="_blank" rel="noreferrer"><ArrowUpRight size={24} weight="bold" />{i.kind === 'place' ? 'Sito' : 'Link'}</a>}
          {(i.files ?? []).map((d) => (
            <button key={d.id} className="ticket-btn" onClick={() => openDoc(d)}><Ticket size={24} weight="duotone" />{docLabel(i, d, trip)}</button>
          ))}
        </div>

        <div className="list">
          {when && <div className="kv"><span>{i.kind === 'stay' ? 'Soggiorno' : i.kind === 'pass' ? 'Validità' : 'Quando'}</span><b>{when}</b></div>}
          {i.kind === 'stay' && i.time && <div className="kv"><span>Check-in</span><b>dalle {i.time}</b></div>}
          {i.kind === 'stay' && i.endTime && <div className="kv"><span>Check-out</span><b>entro le {i.endTime}</b></div>}
          {tax && (
            <div className="kv"><span>Tassa di soggiorno</span>
              <b className="num" style={{ whiteSpace: 'normal' }}>{money(tax.total, tax.currency)}<span className="faint" style={{ fontWeight: 500 }}> ({money(tax.perNight, tax.currency)} × {tax.people} × {tax.nights} notti)</span></b>
            </div>
          )}
          {(i.kind === 'place' || i.kind === 'stay') && (
            <div className="kv"><span>Posizione</span>
              <b style={{ color: i.pos ? 'var(--ok)' : 'var(--ink-3)', fontWeight: 560 }}>
                {i.pos ? `trovata con ${i.enriched === 'google' ? 'Google' : 'OpenStreetMap'}` : i.enriched === 'none' ? 'non trovata' : 'non ancora cercata'}
              </b>
            </div>
          )}
          {i.address && <div className="kv"><span>Indirizzo</span><b style={{ whiteSpace: 'normal' }}>{i.address}</b></div>}
          {i.store && <div className="kv"><span>Dove</span><b>{i.store}</b></div>}
          {i.ref && i.kind !== 'flight' && (
            <button className="kv" onClick={() => navigator.clipboard?.writeText(i.ref!).then(() => toast('Codice copiato'))}>
              <span>Codice</span><b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{i.ref}<Copy size={15} className="faint" /></b>
            </button>
          )}
          {i.link && <a className="kv" href={i.link} target="_blank" rel="noreferrer"><span>Link</span><b style={{ color: 'var(--accent)' }}>{hostOf(i.link)}</b></a>}
          {i.cost != null && (
            <div className="kv"><span>{i.kind === 'buy' ? 'Prezzo' : 'Costo'}</span>
              <b className="num">{money(i.cost, cur)}{conv(i.cost) != null && <span className="faint" style={{ fontWeight: 500 }}> ≈ {money(conv(i.cost)!, home)}</span>}</b>
            </div>
          )}
          {i.bookingNeeded && i.bookingOpens && !i.booked && <div className="kv"><span>Prenotazioni</span><b>aprono il {fmtDay(i.bookingOpens)}</b></div>}
          {i.kind === 'place' && <SwitchRow label="Già visitato" checked={i.done} onChange={(v) => patch({ done: v })} />}
          {i.kind === 'buy' && <SwitchRow label="Comprato" checked={i.done} onChange={(v) => patch({ done: v })} />}
          {i.bookingNeeded && <SwitchRow label="Prenotato" checked={i.booked} onChange={(v) => patch({ booked: v })} />}
          {i.cost != null && i.kind !== 'buy' && <SwitchRow label="Pagato" checked={i.paid} onChange={(v) => patch({ paid: v })} />}
        </div>

        {!!i.hours?.length && (
          <>
            <div className="group-title">Orari<button className="link" onClick={() => setAllHours(!allHours)}>{allHours ? 'Solo oggi' : 'Tutta la settimana'}</button></div>
            <div className="list">
              {(allHours ? i.hours : [i.hours[today] ?? i.hours[0]]).map((h) => {
                const [d, ...rest] = h.split(': ')
                return <div key={h} className="kv"><span>{cap(d)}</span><b>{rest.join(': ')}</b></div>
              })}
            </div>
          </>
        )}

        {i.notes && (
          <>
            <div className="group-title">Note</div>
            <div className="card notes">{i.notes}</div>
          </>
        )}

        <div className="group-title">{i.kind === 'flight' ? 'Carte d\'imbarco' : i.kind === 'stay' ? 'Prenotazione' : 'Biglietti e documenti'}</div>
        <FileList files={i.files ?? []} travelers={trip.travelers} collapsible onChange={(files) => patch({ files })}
          addLabel={i.kind === 'flight' ? 'Allega carta d\'imbarco' : i.kind === 'stay' ? 'Allega prenotazione' : 'Allega biglietto o documento'} />

        {i.kind === 'place' && (
          <>
            <button className="btn ghost block" style={{ marginTop: 18 }} onClick={research} disabled={searching}>
              <MagnifyingGlass size={18} className={searching ? 'spin' : ''} />
              {searching ? 'Cerco…' : settings.googleKey ? (i.enriched === 'google' ? 'Aggiorna foto e orari da Google' : 'Cerca foto, orari e posizione') : 'Cerca la posizione'}
            </button>
            {!settings.googleKey && <p className="small faint" style={{ textAlign: 'center', margin: '8px 12px 0' }}>Per le foto automatiche serve la chiave Google: <a className="link" href="#/settings">Impostazioni</a></p>}
          </>
        )}
        <button className="btn danger block" style={{ marginTop: 8 }} onClick={remove}><Trash size={18} />Elimina</button>
      </div>
      {viewer}
    </>
  )
}

function Stepper({ value = 0, onChange, label }: { value?: number; onChange: (n?: number) => void; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Meno" onClick={() => onChange(value > 1 ? value - 1 : undefined)} disabled={!value}><Minus size={15} weight="bold" /></button>
      <b className="num">{value}</b>
      <button type="button" aria-label="Più" onClick={() => onChange(value + 1)}><Plus size={15} weight="bold" /></button>
    </span>
  )
}

// =========================================================
// Modifica
// =========================================================

function Editor({ trip, initial, isNew, onClose, onSaved }: { trip: Trip; initial: Item; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState(initial)
  const set = <K extends keyof Item>(k: K, v: Item[K]) => setD((p) => ({ ...p, [k]: v === '' ? undefined : v }))
  const txt = (k: keyof Item) => ({ value: (d[k] as string) ?? '', onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) })
  const num = (k: 'cost' | 'baggageCost') => ({
    value: d[k] ?? '', type: 'number', inputMode: 'decimal' as const, min: '0', step: 'any', placeholder: '0',
    onChange: (e: { target: { value: string } }) => set(k, e.target.value === '' ? undefined : Number(e.target.value)),
  })
  const k = d.kind
  const isPlace = k === 'place'
  const stops = d.stops ?? []
  const setStop = (n: number, p: Partial<Stop>) => set('stops', stops.map((s, j) => (j === n ? { ...s, ...p } : s)))
  const bags = d.bags ?? {}
  const setBags = (p: Partial<Bags>) => setD((x) => ({ ...x, bags: { ...x.bags, ...p } }))

  function done() {
    // ponytail: le foto aggiunte e poi annullate restano orfane in IndexedDB; poche, spariscono con "cancella tutti i dati"
    let link = d.link?.trim()
    if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link
    saveItem(trip.id, {
      ...d, link, title: d.title.trim() || KIND[k], stops: stops.filter((s) => s.place.trim()),
      bags: Object.values(bags).some((v) => v != null) ? bags : undefined,
      taxCurrency: d.tax != null ? d.taxCurrency ?? trip.currency : undefined,
      currency: d.currency ?? (d.cost != null || d.baggageCost != null ? trip.currency : undefined),
    })
    onSaved()
  }

  return (
    <>
      <SheetTop title={isNew ? `Nuovo: ${KIND[k].toLowerCase()}` : 'Modifica'} onClose={isNew ? onClose : onSaved} onDone={done} />
      <div className="sheet-body">
        <input className="title-input" placeholder={k === 'flight' ? 'Roma → Tokyo' : k === 'stay' ? 'Nome dell\'hotel' : 'Nome'} autoFocus={isNew} {...txt('title')} />

        {isNew && <Gallery ids={d.photos} onChange={(ids) => set('photos', ids)} />}

        {isPlace && <div className="form"><Options<PlaceCat> options={PLACE_CAT} value={d.placeCat} onChange={(v) => set('placeCat', v)} /></div>}
        {isPlace && EATS.includes(d.placeCat ?? 'sight') && (
          <>
            <div className="group-title">Vegano / vegetariano</div>
            <div className="form"><Options<Diet> options={DIET} value={d.diet} onChange={(v) => set('diet', v)} allowNone /></div>
          </>
        )}
        {k === 'buy' && <div className="form"><Options<BuyCat> options={BUY_CAT} value={d.buyCat} onChange={(v) => set('buyCat', v)} /></div>}
        {k === 'expense' && <div className="form"><Options<BudgetCat> options={BUDGET_CAT} value={d.expenseCat} onChange={(v) => set('expenseCat', v)} /></div>}
        {k === 'transport' && <div className="form"><Options<Mode> options={MODE} value={d.mode} onChange={(v) => set('mode', v)} /></div>}
        {k === 'stay' && (
          <>
            <div className="group-title">Trattamento</div>
            <div className="form"><Options<Board> options={BOARD} value={d.board} onChange={(v) => set('board', v)} allowNone /></div>
          </>
        )}

        <div className="form">
          {k !== 'flight' && k !== 'transport' && k !== 'expense' && (
            <Field label="Città">
              <select value={d.cityId ?? ''} onChange={(e) => set('cityId', e.target.value)}>
                <option value="">{k === 'buy' ? 'Ovunque' : 'Nessuna'}</option>
                {trip.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          )}
          {(k === 'flight' || k === 'transport') && (
            <>
              <Field label="Da"><input placeholder={k === 'flight' ? 'FCO' : 'Stazione, aeroporto'} {...txt('from')} /></Field>
              <Field label="A"><input placeholder={k === 'flight' ? 'NRT' : 'Hotel, città'} {...txt('to')} /></Field>
            </>
          )}
          {k === 'buy' && <Field label="Negozio"><input placeholder="7-Eleven, Don Quijote" list="stores" {...txt('store')} /></Field>}
          {(isPlace || k === 'stay') && (
            <>
              <Field label="Zona"><input placeholder="Quartiere" {...txt('area')} /></Field>
              <Field label="Indirizzo"><input placeholder="Via, numero" {...txt('address')} /></Field>
              <Field label="Google Maps"><input type="url" inputMode="url" placeholder="Incolla il link" {...txt('mapsUrl')} /></Field>
            </>
          )}
          {isPlace && <Field label="Chiuso il"><input placeholder="mercoledì" {...txt('closed')} /></Field>}
          {(k === 'flight' || k === 'stay' || k === 'transport' || k === 'pass') && (
            <Field label={k === 'flight' ? 'Compagnia' : 'Codice'}><input placeholder={k === 'flight' ? 'Qatar Airways QR 132' : 'Codice prenotazione'} {...txt('ref')} /></Field>
          )}
          {k !== 'expense' && (
            <Field label={isPlace ? 'Sito web' : 'Link'}>
              <input type="url" inputMode="url" placeholder={k === 'stay' ? 'Booking, Airbnb, sito hotel' : isPlace ? 'Sito o prenotazione' : 'Pagina della prenotazione'} {...txt('link')} />
            </Field>
          )}
        </div>

        {k === 'flight' && (
          <>
            <div className="group-title">Scali</div>
            <div className="form">
              {stops.map((s, n) => (
                <div className="field" key={n}>
                  <input style={{ textAlign: 'left' }} placeholder="Dove, es. Doha" value={s.place} onChange={(e) => setStop(n, { place: e.target.value })} aria-label="Città dello scalo" />
                  <input style={{ maxWidth: 100 }} placeholder="Durata" value={s.duration ?? ''} onChange={(e) => setStop(n, { duration: e.target.value })} aria-label="Durata dello scalo" />
                  <button type="button" className="faint" aria-label="Togli scalo" onClick={() => set('stops', stops.filter((_, j) => j !== n))}><X size={18} /></button>
                </div>
              ))}
              <button type="button" className="field link" style={{ width: '100%' }} onClick={() => set('stops', [...stops, { place: '' }])}><Plus size={17} weight="bold" />Aggiungi scalo</button>
            </div>
            <div className="group-title">Bagagli inclusi<span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>per persona</span></div>
            <div className="form">
              {([['personal', 'Personale', Backpack, null], ['cabin', 'A mano', Suitcase, 'cabinKg'], ['hold', 'Da stiva', SuitcaseRolling, 'holdKg']] as const).map(([k, label, Icon, kgKey]) => (
                <div className="field bag-row" key={k}>
                  <Icon size={22} weight="duotone" className="faint" />
                  <span className="lbl" style={{ flex: 1 }}>{label}</span>
                  {kgKey && !!bags[k] && (
                    <label className="kg"><input type="number" inputMode="numeric" min="0" placeholder="kg" value={bags[kgKey] ?? ''} aria-label={`Peso massimo ${label}`}
                      onChange={(e) => setBags({ [kgKey]: e.target.value ? Number(e.target.value) : undefined })} />kg</label>
                  )}
                  <Stepper label={label} value={bags[k]} onChange={(n) => setBags({ [k]: n })} />
                </div>
              ))}
              <label className="field"><span className="lbl">Costo extra</span><input {...num('baggageCost')} /></label>
            </div>
          </>
        )}

        {k !== 'buy' && (
          <div className="form">
            <Field label={k === 'stay' ? 'Check-in' : k === 'pass' ? 'Valido dal' : k === 'flight' ? 'Partenza' : isPlace ? 'Giorno' : 'Data'}>
              <input type="date" min={trip.start} max={trip.end} {...txt('date')} />
            </Field>
            {k !== 'pass' && k !== 'expense' && <Field label={k === 'stay' ? 'Check-in dalle' : 'Ora'}><input type="time" {...txt('time')} /></Field>}
            {(k === 'stay' || k === 'pass' || k === 'flight') && (
              <Field label={k === 'stay' ? 'Check-out' : k === 'flight' ? 'Arrivo' : 'Valido fino al'}><input type="date" min={d.date ?? trip.start} max={trip.end} {...txt('endDate')} /></Field>
            )}
            {k === 'stay' && <Field label="Check-out entro"><input type="time" {...txt('endTime')} /></Field>}
            {(k === 'flight' || k === 'transport') && <Field label="Ora arrivo"><input type="time" {...txt('endTime')} /></Field>}
            {(k === 'flight' || k === 'transport') && <Field label={k === 'flight' ? 'Durata volo' : 'Durata'}><input placeholder={k === 'flight' ? '20h 15m' : 'Vuoto = stima automatica'} {...txt('duration')} /></Field>}
          </div>
        )}

        {isPlace && (
          <div className="form">
            <SwitchRow label="Serve prenotare" checked={d.bookingNeeded} onChange={(v) => set('bookingNeeded', v)} />
            {d.bookingNeeded && <Field label="Aprono il"><input type="date" {...txt('bookingOpens')} /></Field>}
          </div>
        )}

        <div className="form">
          <label className="field">
            <span className="lbl">{k === 'buy' ? 'Prezzo' : 'Costo'}</span>
            <input {...num('cost')} />
            <CurrencyButton value={d.currency ?? trip.currency} onChange={(c) => set('currency', c)} />
          </label>
          {k !== 'buy' && <SwitchRow label="Già pagato" checked={d.paid} onChange={(v) => set('paid', v)} />}
        </div>

        {k === 'stay' && (
          <>
            <div className="group-title">Tassa di soggiorno</div>
            <div className="form">
              <label className="field">
                <span className="lbl">A notte</span>
                <input type="number" inputMode="decimal" min="0" step="any" placeholder="per persona" value={d.tax ?? ''}
                  onChange={(e) => set('tax', e.target.value === '' ? undefined : Number(e.target.value))} />
                <CurrencyButton value={d.taxCurrency ?? trip.currency} onChange={(c) => set('taxCurrency', c)} />
              </label>
              {(() => { const x = stayTax({ ...d, taxCurrency: d.taxCurrency ?? trip.currency }, trip); return x ? (
                <div className="field"><span className="lbl">Totale</span><b className="num" style={{ marginLeft: 'auto' }}>{money(x.total, x.currency)}</b></div>
              ) : null })()}
            </div>
            <p className="small faint" style={{ margin: '-6px 6px 14px' }}>Per persona e per notte: il totale usa le notti del soggiorno e i {Math.max(1, trip.travelers.length)} viaggiatori.</p>
          </>
        )}

        <div className="form">
          <Field label="Note" col><textarea placeholder="Orari, consigli, cosa ordinare" {...txt('notes')} /></Field>
        </div>

        {isNew && <p className="small faint" style={{ textAlign: 'center' }}>Dopo averlo aggiunto potrai allegare biglietti e prenotazioni.</p>}
        <datalist id="stores">
          {[...new Set(trip.items.map((i) => i.store).filter(Boolean))].map((s) => <option key={s} value={s} />)}
        </datalist>
      </div>
    </>
  )
}
