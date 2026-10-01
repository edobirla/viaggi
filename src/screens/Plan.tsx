import { useEffect, useState } from 'react'
import { AirplaneInFlight, Clock, Moon, Paperclip, Path, Plus } from '@phosphor-icons/react'
import type { Item, Kind, LatLng, PlaceCat, Trip } from '../types'
import { patchItem, resolveTransfers, uid, useGeo } from '../store'
import { KIND, MODE, PLACE_CAT, routeUrl, cap, eachDay, fmtDay, fmtDayLong, fmtWeekday, today, cmp } from '../util'
import { DietBadge, ItemThumb, KindIcon, Sheet, SheetTop, Top, toast } from '../ui'
import { fmtKm, km, nearestOrder, transferDuration, transferNames, travelTime } from '../geo'
import { ItemSheet } from '../ItemSheet'

/** Riga descrittiva di un elemento, usata nel programma e nella panoramica. */
export function entryLabel(i: Item, trip: Trip, label?: string) {
  const city = trip.cities.find((c) => c.id === i.cityId)?.name
  switch (i.kind) {
    case 'flight': return [`${i.from ?? '?'} → ${i.to ?? '?'}`, i.ref].filter(Boolean).join(' · ')
    case 'transport': return [i.mode && MODE[i.mode], i.from && i.to && `${i.from} → ${i.to}`].filter(Boolean).join(' · ')
    case 'stay': return [label, i.area ?? city].filter(Boolean).join(' · ')
    case 'pass': return `Pass${i.endDate ? ` valido fino al ${fmtDay(i.endDate)}` : ''}`
    case 'place': return [i.placeCat && PLACE_CAT[i.placeCat], i.area].filter(Boolean).join(' · ')
    default: return KIND[i.kind]
  }
}

type Entry = { item: Item; key: string; label?: string }

function Card({ item: i, label, trip, duration }: { item: Item; label?: string; trip: Trip; duration?: string }) {
  if (i.kind === 'flight' && (i.from || i.to)) {
    const nextDay = i.endDate && i.date && i.endDate > i.date
    return (
      <div className="tl-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        <div className="pass">
          <div className="code" style={{ fontSize: 26 }}>{i.from ?? '?'}<small>{i.time ?? ''}</small></div>
          <div className="mid">
            <AirplaneInFlight size={20} weight="duotone" />
            {i.duration && <b className="dur">{i.duration}</b>}
          </div>
          <div className="code" style={{ fontSize: 26 }}>{i.to ?? '?'}<small>{i.endTime ?? ''}{nextDay ? ' +1' : ''}</small></div>
        </div>
        <div className="stops" style={{ marginTop: 0 }}>
          {i.stops?.length
            ? i.stops.map((st, n) => <span key={n}>Scalo a <b>{st.place}</b>{st.duration ? ` · ${st.duration}` : ''}</span>)
            : <span>Volo diretto</span>}
        </div>
        {(i.ref || !!i.files?.length) && (
          <div className="s" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '.5px solid var(--line)', paddingTop: 8 }}>
            <span>{i.ref ?? ''}</span>{!!i.files?.length && <Paperclip size={15} />}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className="tl-card">
      <ItemThumb item={i} />
      <div className="main">
        <div className="t">{i.title}</div>
        <div className="s">{entryLabel(i, trip, label)} {i.kind === 'place' && <DietBadge diet={i.diet} />}</div>
        {duration && <div className="dur-line"><Clock size={13} weight="bold" />{duration}</div>}
      </div>
      {!!i.files?.length && <Paperclip size={17} className="clip" />}
    </div>
  )
}

export function Plan({ trip: t }: { trip: Trip }) {
  const [open, setOpen] = useState<Item>()
  const [adding, setAdding] = useState<string | null>(null) // giorno preimpostato, '' = nessuno
  const days = eachDay(t.start, t.end)
  const dated = t.items.filter((i) => i.date && i.kind !== 'buy' && i.kind !== 'expense')
  const outside = (i: Item) => !!i.date && (i.date < t.start || i.date > t.end)
  // senza data (solo spostamenti e alloggi) oppure con una data fuori dal viaggio, es. dopo aver cambiato le date
  const unplanned = t.items.filter((i) => i.kind !== 'buy' && i.kind !== 'expense' && ((!i.date && ['flight', 'stay', 'transport', 'pass'].includes(i.kind)) || outside(i)))
  const stays = t.items.filter((i) => i.kind === 'stay' && i.date && i.endDate)

  function entriesFor(day: string): Entry[] {
    const out: Entry[] = []
    for (const i of dated) {
      if (i.kind === 'stay') {
        if (i.endDate === day) out.push({ item: i, key: i.endTime ?? '00:00', label: 'Check-out' })
        if (i.date === day) out.push({ item: i, key: i.time ?? '~~', label: 'Check-in' })
      } else if (i.date === day) out.push({ item: i, key: i.time ?? '~' + String(i.order ?? 999).padStart(3, '0') })
    }
    // ponytail: sort stabile, gli elementi senza orario restano nell'ordine di inserimento
    return out.sort((a, b) => cmp(a.key, b.key))
  }

  const geo = useGeo()
  const names = transferNames(t)
  useEffect(() => { resolveTransfers(t.id) }, [names.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  const nightAt = (day: string) => stays.find((s) => s.date! <= day && day < s.endDate!)
  const cityOf = (day: string) => {
    const s = nightAt(day) ?? stays.find((x) => x.endDate === day)
    return t.cities.find((c) => c.id === s?.cityId)?.name
  }
  /** Punto di partenza della giornata: l'hotel se ha una posizione, altrimenti il centro della città. */
  const anchorOf = (day: string): LatLng | undefined => {
    const s = nightAt(day) ?? stays.find((x) => x.endDate === day)
    return s?.pos ?? t.cities.find((c) => c.id === s?.cityId)?.pos
  }

  function optimize(day: string) {
    const places = entriesFor(day).map((e) => e.item).filter((i) => i.kind === 'place' && !i.time)
    if (places.filter((p) => p.pos).length < 2) return toast('Servono almeno due posti con posizione in questa giornata')
    nearestOrder(places, anchorOf(day)).forEach((p, n) => patchItem(t.id, p.id, { order: n + 1 }))
    toast('Ordine ottimizzato per distanza')
  }

  const jump = (d: string) => document.getElementById('d-' + d)?.scrollIntoView({ behavior: 'smooth' })
  // arrivando da una città (?day=…) si apre direttamente sul primo giorno lì
  useEffect(() => {
    const day = new URLSearchParams(location.hash.split('?')[1]).get('day')
    if (day) setTimeout(() => jump(day), 350)
  }, [])

  return (
    <main className="content">
      <Top back={`#/t/${t.id}`}>
        <button className="icon-btn accent" onClick={() => setAdding('')} aria-label="Aggiungi"><Plus size={20} weight="bold" /></button>
      </Top>
      <div className="enter">
        <p className="eyebrow">{t.name}</p>
        <h1 className="title">Programma</h1>
        <div className="day-strip">
          {days.map((d) => (
            <button key={d} className={d === today() ? 'today' : ''} onClick={() => jump(d)}>
              <span>{fmtWeekday(d)}</span><b className="num">{Number(d.slice(8))}</b>
            </button>
          ))}
        </div>

        {unplanned.length > 0 && (
          <section className="section" style={{ marginTop: 18 }}>
            <div className="section-head"><h2 className="h2">Da mettere in calendario</h2></div>
            <div className="list">
              {unplanned.map((i) => (
                <button key={i.id} className="row" onClick={() => setOpen(i)}>
                  <ItemThumb item={i} />
                  <div className="main"><div className="t">{i.title}</div><div className="s">{outside(i) ? `Data fuori dal viaggio: ${fmtDay(i.date!)}` : entryLabel(i, t)}</div></div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div>
          {days.map((day, n) => {
            const entries = entriesFor(day)
            const night = nightAt(day)
            const city = cityOf(day)
            return (
              <section key={day} id={'d-' + day} className="day">
                <div className="day-head">
                  <div className="day-num">{Number(day.slice(8))}</div>
                  <div className="meta">
                    <b>{fmtDayLong(day).replace(/ \d+ /, ' ')}</b>
                    <span>Giorno {n + 1}{city && <> · <em>{city}</em></>}</span>
                  </div>
                  {entries.filter((e) => e.item.kind === 'place' && !e.item.time).length > 1 && (
                    <button className="icon-btn glass" style={{ width: 38, height: 38 }} aria-label="Ottimizza il percorso della giornata" title="Ottimizza percorso" onClick={() => optimize(day)}>
                      <Path size={17} weight="bold" />
                    </button>
                  )}
                  <button className="icon-btn glass" style={{ width: 38, height: 38 }} aria-label={`Aggiungi a ${fmtDayLong(day)}`} onClick={() => setAdding(day)}>
                    <Plus size={17} weight="bold" />
                  </button>
                </div>
                {entries.map(({ item, label, key }, n) => {
                  const prev = entries[n - 1]?.item
                  const hop = prev?.pos && item.pos && prev.id !== item.id ? km(prev.pos, item.pos) : undefined
                  return (
                    <div key={item.id + key}>
                      {hop != null && prev && (
                        <a className="hop" href={routeUrl(prev, item, t)} target="_blank" rel="noreferrer" title="Apri il percorso su Google Maps">
                          <span />{fmtKm(hop)} · {travelTime(hop)}<b>Percorso</b>
                        </a>
                      )}
                      <button className="tl" onClick={() => setOpen(item)}>
                        <div className="rail">
                          <KindIcon item={item} size={20} />
                          {(label === 'Check-out' ? item.endTime : item.time) && <span className="time">{label === 'Check-out' ? item.endTime : item.time}</span>}
                        </div>
                        <Card item={item} label={label} trip={t} duration={item.kind === 'transport' ? transferDuration(item, t, geo) : undefined} />
                      </button>
                    </div>
                  )
                })}
                {!entries.length && <div className="free"><span>·</span><span>Giornata libera</span></div>}
                {night && <div className="night"><Moon size={15} weight="fill" />Notte a {night.title}</div>}
              </section>
            )
          })}
        </div>
      </div>

      <ItemSheet trip={t} item={open} onClose={() => setOpen(undefined)} />
      <Sheet open={adding !== null} onClose={() => setAdding(null)} center>
        <AddChooser trip={t} day={adding || undefined} anchor={adding ? (() => { const d = entriesFor(adding).map((e) => e.item).filter((i) => i.pos).pop(); return d?.pos ?? anchorOf(adding) })() : undefined}
          dayCity={adding ? (nightAt(adding) ?? stays.find((x) => x.endDate === adding))?.cityId : undefined}
          onPick={(i) => { setAdding(null); setOpen(i) }} onClose={() => setAdding(null)} />
      </Sheet>
    </main>
  )
}

const NEW_KINDS: Kind[] = ['flight', 'stay', 'transport', 'place', 'pass']

function AddChooser({ trip: t, day, anchor, dayCity, onPick, onClose }: {
  trip: Trip; day?: string; anchor?: LatLng; dayCity?: string; onPick: (i: Item) => void; onClose: () => void
}) {
  const [pick, setPick] = useState(false)
  const saved = t.items.filter((i) => i.kind === 'place' && !i.date)
  const title = day ? cap(fmtDayLong(day)) : 'Aggiungi'

  if (pick) {
    // solo i posti della città in cui sei quel giorno, divisi per categoria e ordinati dal più vicino
    const d = (p: Item) => (anchor && p.pos ? km(anchor, p.pos) : undefined)
    const city = t.cities.find((c) => c.id === dayCity)
    const pool = saved.filter((p) => !city || p.cityId === city.id).sort((a, b) => (d(a) ?? 1e9) - (d(b) ?? 1e9))
    const cats = (Object.keys(PLACE_CAT) as PlaceCat[]).filter((c) => pool.some((p) => (p.placeCat ?? 'sight') === c))
    return (
      <>
        <SheetTop title={city ? `Posti a ${city.name}` : 'Posti salvati'} onClose={onClose} />
        <div className="sheet-body">
          <p className="small muted" style={{ margin: '0 6px 4px' }}>
            {city ? `Solo i posti di ${city.name}, dove sei quel giorno.` : 'Quel giorno non hai un alloggio, quindi vedi i posti di tutte le città.'}
            {anchor ? ' Tempi stimati dall\'ultima tappa della giornata.' : ''}
          </p>
          {cats.map((c) => (
            <div key={c}>
              <div className="group-title">{PLACE_CAT[c]}<span className="faint">{pool.filter((p) => (p.placeCat ?? 'sight') === c).length}</span></div>
              <div className="list">
                {pool.filter((p) => (p.placeCat ?? 'sight') === c).map((p) => (
                  <button key={p.id} className="row" onClick={() => { patchItem(t.id, p.id, { date: day, order: 999 }); onClose() }}>
                    <ItemThumb item={p} />
                    <div className="main">
                      <div className="t">{p.title}</div>
                      <div className="s">{d(p) != null ? `${fmtKm(d(p)!)} · ${travelTime(d(p)!)}` : [!city && t.cities.find((x) => x.id === p.cityId)?.name, p.area].filter(Boolean).join(' · ') || 'Posizione non ancora trovata'}</div>
                    </div>
                    <DietBadge diet={p.diet} />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {!pool.length && <div className="empty"><b>Nessun posto da aggiungere</b>{city ? `Salva prima qualche posto a ${city.name} nella sezione Posti.` : 'Salvali prima nella sezione Posti.'}</div>}
        </div>
      </>
    )
  }

  return (
    <>
      <SheetTop title={title} onClose={onClose} />
      <div className="sheet-body">
        <div className="kind-grid">
          {NEW_KINDS.map((k) => (
            <button key={k} onClick={() => onPick({ id: uid(), kind: k, title: '', date: day, placeCat: k === 'place' ? 'sight' : undefined, cityId: k === 'place' || k === 'stay' ? dayCity : undefined })}>
              <KindIcon item={{ kind: k }} />{KIND[k]}
            </button>
          ))}
          {day && (
            <button onClick={() => setPick(true)}>
              <KindIcon item={{ kind: 'place', placeCat: 'food' }} />Dai posti salvati
            </button>
          )}
        </div>
      </div>
    </>
  )
}
