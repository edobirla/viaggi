import { useState } from 'react'
import { Leaf, MagnifyingGlass, NavigationArrow, Plus } from '@phosphor-icons/react'
import type { Diet, Item, PlaceCat, Trip } from '../types'
import { enrichTrip, patchItem, uid, useEnrichProgress, usePhoto } from '../store'
import { DIET, EATS, PLACE_CAT, fmtDay } from '../util'
import { fmtKm, km, useMyPosition } from '../geo'
import { DietBadge, Segmented, StarBtn, Top, hueClass, iconFor } from '../ui'
import { ItemSheet } from '../ItemSheet'

// Macro-tipi: il filtro vegano ha senso solo dentro "Mangiare".
const GROUPS = {
  all: { label: 'Tutto', cats: [] as PlaceCat[] },
  see: { label: 'Da vedere', cats: ['sight'] as PlaceCat[] },
  eat: { label: 'Mangiare', cats: EATS },
  do: { label: 'Esperienze', cats: ['experience'] as PlaceCat[] },
  shop: { label: 'Negozi', cats: ['shop'] as PlaceCat[] },
}
type Group = keyof typeof GROUPS
type Status = 'all' | 'todo' | 'done' | 'fav'
const DIETS: (Diet | 'unknown')[] = ['vegan', 'vegetarian', 'options', 'unknown']

function PlaceCard({ i, showCity, trip, dist, onOpen }: { i: Item; showCity: boolean; trip: Trip; dist?: number; onOpen: () => void }) {
  const own = usePhoto(i.photos?.[0])
  const url = own ?? i.gphotos?.[0]
  const Icon = iconFor(i)
  const city = trip.cities.find((c) => c.id === i.cityId)?.name
  return (
    <div className={'pcard' + (i.done ? ' done' : '')} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className={'pimg ' + (url ? '' : 'tintbox ' + hueClass(i))}>{url ? <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <Icon size={24} weight="duotone" />}</div>
      <div className="main">
        <div className="t">{i.title}</div>
        <div className="s">{[dist != null && fmtKm(dist), showCity && city, i.area].filter(Boolean).join(' · ') || (i.notes ?? ' ')}</div>
        <div className="badges">
          {EATS.includes(i.placeCat ?? 'sight') && <DietBadge diet={i.diet} showUnknown />}
          {i.bookingNeeded && !i.booked && <span className="badge warn">Da prenotare</span>}
          {i.done && <span className="badge vegan">Visitato</span>}
          {i.date && <span className="badge plain">{fmtDay(i.date)}</span>}
        </div>
      </div>
      <StarBtn on={i.fav} onChange={() => patchItem(trip.id, i.id, { fav: !i.fav })} />
    </div>
  )
}

export function Places({ trip: t }: { trip: Trip }) {
  const params = new URLSearchParams(location.hash.split('?')[1])
  const [city, setCity] = useState(params.get('city') ?? '')
  const [group, setGroup] = useState<Group>('all')
  const [cat, setCat] = useState<PlaceCat | ''>('')
  const [diet, setDiet] = useState<Diet | 'unknown' | ''>('')
  const [status, setStatus] = useState<Status>((params.get('status') as Status) || 'all')
  const [near, setNear] = useState(false)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Item>()
  const { pos: me, error } = useMyPosition(near)
  const progress = useEnrichProgress()

  const all = t.items.filter((i) => i.kind === 'place')
  const inCity = all.filter((i) => !city || i.cityId === city)
  const g = GROUPS[group]
  const inGroup = inCity.filter((i) => !g.cats.length || g.cats.includes(i.placeCat ?? 'sight'))
  const list = inGroup.filter(
    (i) =>
      (!cat || i.placeCat === cat) &&
      (!diet || (diet === 'unknown' ? !i.diet : i.diet === diet)) &&
      (status === 'all' || (status === 'todo' ? !i.done : status === 'done' ? i.done : i.fav)) &&
      (!q || `${i.title} ${i.area ?? ''} ${i.notes ?? ''}`.toLowerCase().includes(q.toLowerCase())),
  )
  const dist = (i: Item) => (me && i.pos ? km(me, i.pos) : undefined)
  const sorted = near && me ? [...list].sort((a, b) => (dist(a) ?? 1e9) - (dist(b) ?? 1e9)) : list
  const cats = (Object.keys(PLACE_CAT) as PlaceCat[]).filter((c) => inGroup.some((i) => i.placeCat === c))
  const sections: [string, Item[]][] = near && me
    ? [['Più vicini a te', sorted]]
    : cats.map((c) => [PLACE_CAT[c], sorted.filter((i) => i.placeCat === c)] as [string, Item[]]).filter(([, l]) => l.length)
  const missingPos = all.filter((i) => !i.pos).length

  function pickGroup(k: Group) {
    setGroup(k)
    setCat('')
    if (k !== 'eat') setDiet('')
  }

  return (
    <main className="content wide">
      <Top back={`#/t/${t.id}`}>
        <button className="icon-btn accent" aria-label="Nuovo posto"
          onClick={() => setOpen({ id: uid(), kind: 'place', title: '', cityId: city || undefined, placeCat: cat || g.cats[0] || 'food' })}>
          <Plus size={20} weight="bold" />
        </button>
      </Top>
      <div className="enter">
        <p className="eyebrow">{t.name}</p>
        <h1 className="title">Posti</h1>

        <div className="chips">
          <button className={'chip' + (!city ? ' on' : '')} onClick={() => setCity('')}>Tutte le città <span className="count">{all.length}</span></button>
          {t.cities.map((c) => (
            <button key={c.id} className={'chip' + (city === c.id ? ' on' : '')} onClick={() => setCity(c.id)}>
              {c.name} <span className="count">{all.filter((i) => i.cityId === c.id).length}</span>
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <div className="search">
            <MagnifyingGlass size={18} />
            <input type="search" placeholder="Cerca per nome, zona, note" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className={'chip near' + (near ? ' on' : '')} onClick={() => setNear(!near)} aria-pressed={near}>
            <NavigationArrow size={16} weight={near ? 'fill' : 'bold'} />Vicino a me
          </button>
        </div>
        {near && (
          <p className="small muted hint">
            {error ? error
              : !me ? 'Cerco la tua posizione…'
              : progress.running ? `Cerco la posizione dei posti: ${progress.done} di ${progress.total}…`
              : missingPos > 0 ? <>{missingPos} posti senza posizione restano in fondo. <button className="link" onClick={() => enrichTrip(t.id)}>Cerca ora</button></>
              : 'Ordinati dal più vicino.'}
          </p>
        )}

        <div className="chips" style={{ marginTop: 6 }}>
          {(Object.keys(GROUPS) as Group[]).map((k) => {
            const n = k === 'all' ? inCity.length : inCity.filter((i) => GROUPS[k].cats.includes(i.placeCat ?? 'sight')).length
            if (k !== 'all' && !n) return null
            return <button key={k} className={'chip' + (group === k ? ' on' : '')} onClick={() => pickGroup(k)}>{GROUPS[k].label} <span className="count">{n}</span></button>
          })}
        </div>

        {group === 'eat' && (
          <div className="subfilters">
            <div className="chips">
              {cats.length > 1 && cats.map((c) => (
                <button key={c} className={'chip sm' + (cat === c ? ' on' : '')} onClick={() => setCat(cat === c ? '' : c)}>{PLACE_CAT[c]}</button>
              ))}
            </div>
            <div className="chips">
              {DIETS.map((d) => {
                const n = inGroup.filter((i) => (!cat || i.placeCat === cat) && (d === 'unknown' ? !i.diet : i.diet === d)).length
                return (
                  <button key={d} className={'chip sm diet' + (diet === d ? ' on' : '')} onClick={() => setDiet(diet === d ? '' : d)} disabled={!n}>
                    {d !== 'unknown' && d !== 'options' && <Leaf size={14} weight="fill" />}
                    {d === 'unknown' ? 'Da verificare' : DIET[d]} <span className="count">{n}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{ maxWidth: 520, margin: '10px 0 0' }}>
          <Segmented<Status> options={[['all', 'Tutti'], ['todo', `Da visitare`], ['done', 'Visitati'], ['fav', 'Preferiti']]} value={status} onChange={setStatus} />
        </div>

        {sections.map(([label, l]) => (
          <section key={label}>
            <div className="pgroup-title"><h2 className="h2">{label}</h2><span>{l.length}</span></div>
            <div className="pgrid list">
              {l.map((i) => <PlaceCard key={i.id} i={i} trip={t} dist={dist(i)} showCity={!city} onOpen={() => setOpen(i)} />)}
            </div>
          </section>
        ))}
        {!list.length && (
          <div className="empty">
            <span className="ico h-sight"><MagnifyingGlass size={26} weight="duotone" /></span>
            <b>{all.length ? 'Nessun posto con questi filtri' : 'Ancora nessun posto'}</b>
            {all.length ? 'Prova a togliere qualche filtro.' : 'Tocca + per salvare ristoranti, templi, negozi.'}
          </div>
        )}
      </div>
      <ItemSheet trip={t} item={open} onClose={() => setOpen(undefined)} />
    </main>
  )
}
