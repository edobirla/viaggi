import { useState } from 'react'
import {
  CalendarPlus, Camera, CaretRight, CheckSquareOffset, FolderSimple, GearSix, MapPin, ShoppingBag, Trash, Wallet, Plus,
} from '@phosphor-icons/react'
import type { Item, Trip } from '../types'
import { deleteTrip, fillCityImages, savePhoto, uid, updateTrip, useRates, useSettings } from '../store'
import { cap, deadlines, diffDays, downloadIcs, fmtDayLong, fmtMonth, fmtRange, money, parseDay, today, totals, cmp } from '../util'
import { CurrencyButton, Field, Img, KindIcon, Ring, Sheet, SheetTop, Top, TripImage, ask, toast } from '../ui'
import { ItemSheet } from '../ItemSheet'
import { entryLabel } from './Plan'

function Countdown({ t }: { t: Trip }) {
  const now = today()
  const to = diffDays(now, t.start)
  if (to > 0) return <div className="countdown"><b>{to}</b><span>{to === 1 ? 'giorno alla partenza' : 'giorni alla partenza'}</span></div>
  if (now <= t.end) return <div className="countdown"><b>{diffDays(t.start, now) + 1}</b><span>giorno di {diffDays(t.start, t.end) + 1}</span></div>
  return <div className="countdown"><span>Viaggio concluso</span></div>
}

/** Primo elemento in programma da oggi in poi (o dall'inizio del viaggio). */
function nextUp(t: Trip): Item | undefined {
  const from = today() > t.start ? today() : t.start
  return t.items
    .filter((i) => i.date && i.date >= from && i.kind !== 'buy' && i.kind !== 'expense')
    .sort((a, b) => cmp(a.date! + (a.time ?? '~'), b.date! + (b.time ?? '~')))[0]
}

export function Overview({ trip: t }: { trip: Trip }) {
  const home = useSettings().home
  const rates = useRates()
  const [settings, setSettings] = useState(false)
  const [open, setOpen] = useState<Item>()
  const base = `#/t/${t.id}`

  const { planned } = totals(t, home, rates)
  const checks = t.checklist.filter((c) => c.done).length
  const buys = t.items.filter((i) => i.kind === 'buy')
  const places = t.items.filter((i) => i.kind === 'place')
  const visited = places.filter((p) => p.done).length
  const dl = deadlines(t).filter((d) => d.date >= today())
  const next = nextUp(t)
  const files = t.docs.length + t.items.reduce((n, i) => n + (i.files?.length ?? 0), 0)
  const nights = (cityId: string) =>
    t.items.filter((i) => i.kind === 'stay' && i.cityId === cityId && i.date && i.endDate).reduce((s, i) => s + diffDays(i.date!, i.endDate!), 0)

  async function setCover(f?: File) {
    if (!f) return
    const id = await savePhoto(f)
    updateTrip(t.id, (x) => ({ ...x, cover: id }))
  }

  return (
    <main className="content wide">
      <Top back="#/">
        <button className="icon-btn glass" onClick={() => setSettings(true)} aria-label="Impostazioni del viaggio"><GearSix size={20} /></button>
      </Top>

      <div className="enter">
        <section className="bezel" style={{ borderRadius: 36 }}>
          <div className="hero">
            <TripImage t={t} />
            <label className="cover-btn pill-glass" aria-label="Cambia copertina">
              <Camera size={18} weight="fill" />
              <input type="file" accept="image/*" hidden onChange={(e) => setCover(e.target.files?.[0])} />
            </label>
            <h1>{t.name}</h1>
            <div className="dates">{fmtRange(t.start, t.end)} · {diffDays(t.start, t.end) + 1} giorni</div>
            {t.travelers.length > 0 && (
              <div className="travelers">
                {t.travelers.map((p) => <span key={p.id} className="pill-glass"><i>{p.name.charAt(0).toUpperCase()}</i>{p.name}</span>)}
              </div>
            )}
            <Countdown t={t} />
          </div>
        </section>

        <div className="bento">
          <button className="tile span2 next" onClick={() => (next ? setOpen(next) : (location.hash = base + '/plan'))}>
            <div className="k">Prossimo</div>
            {next ? (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 'auto' }}>
                <KindIcon item={next} size={24} />
                <div style={{ minWidth: 0 }}>
                  <div className="when">{cap(fmtDayLong(next.date!))}{next.time ? `, ${next.time}` : ''}</div>
                  <div className="what">{next.title}</div>
                  <div className="sub">{entryLabel(next, t)}</div>
                </div>
              </div>
            ) : <div className="what" style={{ marginTop: 'auto' }}>Il programma è ancora vuoto</div>}
          </button>

          <a className="tile" href={base + '/budget'}>
            <div className="k"><Wallet size={18} weight="duotone" />Budget</div>
            {t.budget ? <Ring value={planned / t.budget} /> : null}
            <div className="big">{money(planned, home, true)}</div>
            <div className="sub">{t.budget ? `${Math.round((planned / t.budget) * 100)}% di ${money(t.budget, home, true)}` : 'previsti'}</div>
          </a>

          <a className="tile" href={base + '/prep'}>
            <div className="k"><CheckSquareOffset size={18} weight="duotone" />Preparativi</div>
            <Ring value={t.checklist.length ? checks / t.checklist.length : 0} />
            <div className="big">{checks}<span className="faint">/{t.checklist.length}</span></div>
            <div className="sub">{files ? `${files} documenti` : 'checklist e documenti'}</div>
          </a>

          <a className="tile" href={base + '/places'}>
            <div className="k"><MapPin size={18} weight="duotone" />Da visitare</div>
            <Ring value={places.length ? visited / places.length : 0} />
            <div className="big">{places.length - visited}</div>
            <div className="sub">{visited} visitati su {places.length}</div>
          </a>

          <a className="tile" href={base + '/shop'}>
            <div className="k"><ShoppingBag size={18} weight="duotone" />Acquisti</div>
            <div className="big">{buys.filter((b) => b.done).length}<span className="faint">/{buys.length}</span></div>
            <div className="sub">cose da comprare</div>
          </a>

          <div className="tile span2" style={{ padding: 0, minHeight: 0 }}>
            <div className="section-head" style={{ padding: '16px 18px 0', marginBottom: 4 }}>
              <div className="k" style={{ fontSize: 14, fontWeight: 620, color: 'var(--ink-2)' }}>Scadenze</div>
              {dl.length > 0 && <button className="link" onClick={() => downloadIcs(t, dl)}><CalendarPlus size={18} />Calendario</button>}
            </div>
            {dl.length ? dl.slice(0, 3).map((d) => (
              <button key={d.id} className="row" onClick={() => (d.itemId ? setOpen(t.items.find((i) => i.id === d.itemId)) : (location.hash = base + '/prep'))}>
                <div className="date-tile"><span>{fmtMonth(d.date)}</span><b>{parseDay(d.date).getDate()}</b></div>
                <div className="main"><div className="t">{d.title}</div><div className="s">tra {diffDays(today(), d.date)} giorni</div></div>
              </button>
            )) : <p className="muted small" style={{ padding: '4px 18px 18px' }}>Nessuna scadenza. Attiva “Serve prenotare” su un posto per ricevere un promemoria.</p>}
          </div>
        </div>

        <section className="section">
          <div className="section-head"><h2 className="h2">Città</h2><button className="link" onClick={() => setSettings(true)}>Modifica</button></div>
          {t.cities.length ? (
            <div className="city-rail">
              {t.cities.map((c) => (
                <a key={c.id} className="city-card" href={`${base}/city/${c.id}`}>
                  <Img src={c.image || undefined} />
                  <div><b>{c.name}</b><span>{places.filter((p) => p.cityId === c.id).length} posti{nights(c.id) ? ` · ${nights(c.id)} notti` : ''}</span></div>
                </a>
              ))}
            </div>
          ) : <button className="btn ghost" onClick={() => setSettings(true)}><Plus size={18} />Aggiungi città</button>}
        </section>

        <section className="section">
          <a className="list row" href={base + '/prep'}>
            <span className="ico h-flight"><FolderSimple size={21} weight="duotone" /></span>
            <div className="main"><div className="t">Documenti e checklist</div><div className="s">Passaporti, biglietti, assicurazione, cose da fare</div></div>
            <CaretRight size={16} className="faint" />
          </a>
        </section>
      </div>

      <ItemSheet trip={t} item={open} onClose={() => setOpen(undefined)} />
      <Sheet open={settings} onClose={() => setSettings(false)} center>
        <TripSettings t={t} onClose={() => setSettings(false)} />
      </Sheet>
    </main>
  )
}

function TripSettings({ t, onClose }: { t: Trip; onClose: () => void }) {
  const home = useSettings().home
  const [d, setD] = useState(t)
  const [newCity, setNewCity] = useState('')
  const [newTraveler, setNewTraveler] = useState('')
  function addTraveler() {
    if (!newTraveler.trim()) return
    set({ travelers: [...d.travelers, { id: uid(), name: newTraveler.trim() }] })
    setNewTraveler('')
  }
  const set = (p: Partial<Trip>) => setD((x) => ({ ...x, ...p }))

  function addCity() {
    if (!newCity.trim()) return
    set({ cities: [...d.cities, { id: uid(), name: newCity.trim() }] })
    setNewCity('')
  }

  function save() {
    if (!d.name.trim()) return toast('Serve un nome')
    if (!d.start || !d.end || d.end < d.start) return toast('Controlla le date')
    const renamed = d.cities.map((c) => {
      const old = t.cities.find((o) => o.id === c.id)
      return old && old.name !== c.name ? { ...c, image: undefined } : c // nuova foto se cambi nome
    })
    // ponytail: aggiorna solo i campi del form, items/checklist/docs restano quelli attuali
    updateTrip(t.id, (x) => ({ ...x, name: d.name.trim(), start: d.start, end: d.end, currency: d.currency, budget: d.budget, cities: renamed, travelers: d.travelers.filter((p) => p.name.trim()) }))
    fillCityImages(t.id)
    onClose()
  }

  async function remove() {
    if (!(await ask(`Eliminare “${t.name}”?`, 'Elimina', 'Verranno eliminati tutti i contenuti del viaggio, foto e documenti compresi.'))) return
    deleteTrip(t.id)
    location.hash = '#/'
  }

  return (
    <>
      <SheetTop title="Impostazioni viaggio" onClose={onClose} onDone={save} />
      <div className="sheet-body">
        <input className="title-input" value={d.name} onChange={(e) => set({ name: e.target.value })} />
        <div className="form">
          <Field label="Partenza"><input type="date" value={d.start} onChange={(e) => set({ start: e.target.value })} /></Field>
          <Field label="Ritorno"><input type="date" min={d.start} value={d.end} onChange={(e) => set({ end: e.target.value })} /></Field>
        </div>

        <div className="group-title">Soldi</div>
        <div className="form">
          <div className="field"><span className="lbl">Valuta locale</span><span style={{ flex: 1 }} /><CurrencyButton value={d.currency} onChange={(c) => set({ currency: c })} /></div>
          <Field label={`Budget (${home})`}>
            <input type="number" inputMode="decimal" placeholder="Nessuno" value={d.budget ?? ''} onChange={(e) => set({ budget: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
        </div>

        <div className="group-title">Viaggiatori</div>
        <div className="form">
          {d.travelers.map((p, idx) => (
            <div className="field" key={p.id}>
              <input style={{ textAlign: 'left' }} value={p.name} aria-label="Nome viaggiatore"
                onChange={(e) => set({ travelers: d.travelers.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)) })} />
              <button type="button" className="faint" aria-label={`Rimuovi ${p.name}`} onClick={() => set({ travelers: d.travelers.filter((x) => x.id !== p.id) })}><Trash size={19} /></button>
            </div>
          ))}
          <div className="field">
            <input style={{ textAlign: 'left' }} placeholder="Aggiungi viaggiatore" value={newTraveler} onChange={(e) => setNewTraveler(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTraveler()} />
            <button type="button" className="link" onClick={addTraveler}>Aggiungi</button>
          </div>
        </div>

        <div className="group-title">Città</div>
        <div className="form">
          {d.cities.map((c, idx) => (
            <div className="field" key={c.id}>
              <input style={{ textAlign: 'left' }} value={c.name} aria-label="Nome città"
                onChange={(e) => set({ cities: d.cities.map((x, j) => (j === idx ? { ...x, name: e.target.value } : x)) })} />
              <button type="button" className="faint" aria-label={`Rimuovi ${c.name}`} onClick={() => set({ cities: d.cities.filter((x) => x.id !== c.id) })}><Trash size={19} /></button>
            </div>
          ))}
          <div className="field">
            <input style={{ textAlign: 'left' }} placeholder="Aggiungi città" value={newCity} onChange={(e) => setNewCity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCity()} />
            <button type="button" className="link" onClick={addCity}>Aggiungi</button>
          </div>
        </div>

        <button className="btn danger block" onClick={remove}><Trash size={18} />Elimina viaggio</button>
      </div>
    </>
  )
}
