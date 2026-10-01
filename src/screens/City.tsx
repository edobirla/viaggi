import { useState } from 'react'
import { ArrowRight, Bed, CalendarDots, MapPin, ShoppingBag, Star } from '@phosphor-icons/react'
import type { Item, Trip } from '../types'
import { usePhoto } from '../store'
import { BOARD, cap, diffDays, fmtDay, fmtDayLong, fmtRange, cmp } from '../util'
import { DietBadge, Img, ItemThumb, Top } from '../ui'
import { ItemSheet } from '../ItemSheet'
import { entryLabel } from './Plan'

const has = (s: string | undefined, name: string) => !!s && s.toLowerCase().includes(name.toLowerCase())

function StayCard({ i, onOpen }: { i: Item; onOpen: () => void }) {
  const photo = usePhoto(i.photos?.[0])
  const img = photo ?? i.gphotos?.[0]
  return (
    <button className="stay-card card" onClick={onOpen}>
      {img ? <img src={img} alt="" referrerPolicy="no-referrer" /> : <span className="tintbox h-stay"><Bed size={34} weight="duotone" /></span>}
      <div className="main">
        <div className="t">{i.title}</div>
        <div className="s">{i.date && i.endDate ? `${fmtDay(i.date)} - ${fmtDay(i.endDate)}, ${diffDays(i.date, i.endDate)} notti` : 'Date da inserire'}</div>
        <div className="badges">
          {i.board && <span className="badge plain">{BOARD[i.board]}</span>}
          {i.bookingNeeded && <span className={'badge ' + (i.booked ? 'vegan' : 'warn')}>{i.booked ? 'Prenotato' : 'Da prenotare'}</span>}
          {!!i.files?.length && <span className="badge plain">{i.files.length} documenti</span>}
        </div>
      </div>
    </button>
  )
}

export function City({ trip: t, cityId }: { trip: Trip; cityId: string }) {
  const [open, setOpen] = useState<Item>()
  const c = t.cities.find((x) => x.id === cityId)
  if (!c) return <main className="content"><Top back={`#/t/${t.id}`} /><div className="empty"><b>Città non trovata</b></div></main>

  const base = `#/t/${t.id}`
  const stays = t.items.filter((i) => i.kind === 'stay' && i.cityId === c.id).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  const first = stays.find((s) => s.date)?.date
  const last = [...stays].reverse().find((s) => s.endDate)?.endDate
  const nights = stays.reduce((n, s) => n + (s.date && s.endDate ? diffDays(s.date, s.endDate) : 0), 0)
  const moves = t.items.filter((i) => i.kind === 'flight' || i.kind === 'transport')
  // come arrivi: spostamenti veri (da → a) che finiscono qui o arrivano il giorno del primo check-in.
  // come riparti: spostamenti del giorno dell'ultimo check-out. Le gite in mezzo finiscono in "In programma".
  const isMove = (i: Item) => !!(i.from && i.to) || i.title.includes('→')
  const after = (i: Item) => i.title.split('→')[1]
  const arrive = moves.filter((i) => isMove(i) && (has(i.to, c.name) || has(after(i), c.name)) && (!first || (i.endDate ?? i.date) === first))
  const leave = moves.filter((i) => isMove(i) && !arrive.includes(i) && !!last && i.date === last)
  const places = t.items.filter((i) => i.kind === 'place' && i.cityId === c.id)
  const todo = places.filter((p) => !p.done)
  const favs = places.filter((p) => p.fav)
  // in programma: tutto quello che cade nei giorni in cui sei qui, più le cose con una data assegnate alla città
  const inStay = (d?: string) => !!d && !!first && !!last && d >= first && d < last
  const planned = t.items.filter((i) => i.date && !['stay', 'buy', 'expense'].includes(i.kind) && !arrive.includes(i) && !leave.includes(i) && (inStay(i.date) || (i.cityId === c.id && i.date! >= t.start && i.date! <= t.end)))
    .sort((a, b) => cmp(a.date! + (a.time ?? '~'), b.date! + (b.time ?? '~')))
  const buys = t.items.filter((i) => i.kind === 'buy' && i.cityId === c.id)

  const Row = ({ i }: { i: Item }) => (
    <button className="row" onClick={() => setOpen(i)}>
      <ItemThumb item={i} />
      <div className="main">
        <div className="t">{i.title}</div>
        <div className="s">{[i.date && cap(fmtDayLong(i.date)), i.time, entryLabel(i, t)].filter(Boolean).join(' · ')}</div>
      </div>
      {i.kind === 'place' && <DietBadge diet={i.diet} />}
    </button>
  )

  return (
    <main className="content wide">
      <Top back={base} />
      <div className="enter">
        <section className="bezel" style={{ borderRadius: 36 }}>
          <div className="hero city-hero">
            <Img src={c.image || undefined} />
            <p className="eyebrow" style={{ color: 'rgb(255 255 255 / .85)' }}>{t.name}</p>
            <h1>{c.name}</h1>
            <div className="dates">{first && last ? fmtRange(first, last) : 'Aggiungi un alloggio per vedere le date'}</div>
            {nights > 0 && <div className="countdown"><b>{nights + 1}</b><span>{nights + 1 === 1 ? 'giorno' : 'giorni'}, {nights} notti</span></div>}
          </div>
        </section>

        <div className="bento">
          <a className="tile" href={`${base}/places?city=${c.id}&status=todo`}>
            <div className="k"><MapPin size={18} weight="duotone" />Da visitare</div>
            <div className="big">{todo.length}</div>
            <div className="sub">{places.length - todo.length} visitati su {places.length}</div>
          </a>
          <a className="tile" href={`${base}/places?city=${c.id}&status=fav`}>
            <div className="k"><Star size={18} weight="duotone" />Preferiti</div>
            <div className="big">{favs.length}</div>
            <div className="sub">{favs.slice(0, 2).map((f) => f.title).join(', ') || 'Tocca la stellina su un posto'}</div>
          </a>
          <a className="tile" href={`${base}/plan${first ? `?day=${first}` : ''}`}>
            <div className="k"><CalendarDots size={18} weight="duotone" />In programma</div>
            <div className="big">{planned.length}</div>
            <div className="sub">attività con una data</div>
          </a>
          <a className="tile" href={`${base}/shop?city=${c.id}`}>
            <div className="k"><ShoppingBag size={18} weight="duotone" />Solo qui</div>
            <div className="big">{buys.filter((b) => !b.done).length}</div>
            <div className="sub">cose da comprare a {c.name}</div>
          </a>
        </div>

        <section className="section">
          <div className="section-head"><h2 className="h2">Dove dormi</h2></div>
          {stays.length ? <div className="stay-grid">{stays.map((s) => <StayCard key={s.id} i={s} onOpen={() => setOpen(s)} />)}</div>
            : <p className="muted small">Nessun alloggio in questa città. Aggiungilo dal Programma.</p>}
        </section>

        {(arrive.length > 0 || leave.length > 0) && (
          <div className="two-col">
            {arrive.length > 0 && (
              <section className="section">
                <div className="section-head"><h2 className="h2">Come arrivi</h2></div>
                <div className="list">{arrive.map((i) => <Row key={i.id} i={i} />)}</div>
              </section>
            )}
            {leave.length > 0 && (
              <section className="section">
                <div className="section-head"><h2 className="h2">Come riparti</h2></div>
                <div className="list">{leave.map((i) => <Row key={i.id} i={i} />)}</div>
              </section>
            )}
          </div>
        )}

        {planned.length > 0 && (
          <section className="section">
            <div className="section-head"><h2 className="h2">In programma</h2></div>
            <div className="list">{planned.map((i) => <Row key={i.id} i={i} />)}</div>
          </section>
        )}

        {favs.length > 0 && (
          <section className="section">
            <div className="section-head"><h2 className="h2">I tuoi preferiti</h2></div>
            <div className="list">{favs.map((i) => <Row key={i.id} i={i} />)}</div>
          </section>
        )}

        <section className="section">
          <a className="btn ghost" href={`${base}/places?city=${c.id}`}>Tutti i posti di {c.name}<span className="knob"><ArrowRight size={17} weight="bold" /></span></a>
        </section>
      </div>
      <ItemSheet trip={t} item={open} onClose={() => setOpen(undefined)} />
    </main>
  )
}
