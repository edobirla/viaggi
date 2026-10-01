import { useState } from 'react'
import { ArrowRight, Plus } from '@phosphor-icons/react'
import { addTrip, uid, useSettings, useTrips } from '../store'
import { countdown, fmtRange } from '../util'
import { CurrencyButton, Field, Sheet, SheetTop, Top, TripImage, toast } from '../ui'

export function Trips({ adding }: { adding: boolean }) {
  const trips = [...useTrips()].sort((a, b) => a.start.localeCompare(b.start))
  const name = useSettings().name
  const [open, setOpen] = useState(adding)
  const close = () => { setOpen(false); if (adding) location.hash = '#/' }

  return (
    <main className="content wide">
      <Top>
        <button className="icon-btn accent hide-wide" onClick={() => setOpen(true)} aria-label="Nuovo viaggio"><Plus size={20} weight="bold" /></button>
      </Top>
      <div className="enter">
        {name && <p className="eyebrow">Ciao {name.split(' ')[0]}</p>}
        <h1 className="title">I tuoi viaggi</h1>
        <div className="trip-grid">
          {trips.map((t) => (
            <a key={t.id} className="bezel" href={`#/t/${t.id}`}>
              <div className="trip-card">
                <TripImage t={t} />
                <span className="pill-glass">{countdown(t)}</span>
                <div className="body">
                  <h2>{t.name}</h2>
                  <div className="when">{fmtRange(t.start, t.end)}{t.cities.length ? ` · ${t.cities.map((c) => c.name).join(', ')}` : ''}</div>
                </div>
              </div>
            </a>
          ))}
          <button className="new-trip" onClick={() => setOpen(true)}>
            <span className="icon-btn accent"><Plus size={22} weight="bold" /></span>
            Nuovo viaggio
          </button>
        </div>
      </div>
      <Sheet open={open} onClose={close} center>
        <NewTrip onClose={close} />
      </Sheet>
    </main>
  )
}

function NewTrip({ onClose }: { onClose: () => void }) {
  const { home, name: me } = useSettings()
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [cities, setCities] = useState('')
  const [currency, setCurrency] = useState(home)

  function create() {
    if (!name.trim()) return toast('Dai un nome al viaggio')
    if (!start || !end || end < start) return toast('Controlla le date')
    const id = uid()
    addTrip({
      id, name: name.trim(), start, end, currency, cities: cities.split(',').map((c) => c.trim()).filter(Boolean).map((c) => ({ id: uid(), name: c })),
      items: [], checklist: [], docs: [], travelers: me ? [{ id: uid(), name: me }] : [],
    })
    location.hash = `#/t/${id}`
  }

  return (
    <>
      <SheetTop title="Nuovo viaggio" onClose={onClose} onDone={create} />
      <div className="sheet-body">
        <input className="title-input" placeholder="Dove vai?" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="form">
          <Field label="Partenza"><input type="date" value={start} onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value) }} /></Field>
          <Field label="Ritorno"><input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        <div className="form">
          <Field label="Città"><input placeholder="Lisbona, Porto" value={cities} onChange={(e) => setCities(e.target.value)} /></Field>
          <div className="field"><span className="lbl">Valuta locale</span><span style={{ flex: 1 }} /><CurrencyButton value={currency} onChange={setCurrency} /></div>
        </div>
        <p className="small muted" style={{ margin: '0 6px 18px' }}>Le foto delle città arrivano da sole. Potrai cambiare tutto in seguito.</p>
        <button className="btn block" onClick={create}>Crea viaggio<span className="knob"><ArrowRight size={17} weight="bold" /></span></button>
      </div>
    </>
  )
}
