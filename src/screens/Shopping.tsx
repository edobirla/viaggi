import { useState } from 'react'
import { MapPin, Plus, ShoppingBag } from '@phosphor-icons/react'
import type { Item, Trip } from '../types'
import { patchItem, uid, usePhoto } from '../store'
import { BUY_CAT, money } from '../util'
import { CheckBtn, Segmented, Top } from '../ui'
import { ItemSheet } from '../ItemSheet'

function Row({ i, trip, showCity, onOpen }: { i: Item; trip: Trip; showCity: boolean; onOpen: () => void }) {
  const url = usePhoto(i.photos?.[0])
  const city = showCity ? trip.cities.find((c) => c.id === i.cityId)?.name : undefined
  return (
    <div className={'row' + (i.done ? ' done' : '')} onClick={onOpen} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <CheckBtn on={i.done} label={i.done ? `${i.title}: segna come da comprare` : `${i.title}: segna come comprato`} onChange={() => patchItem(trip.id, i.id, { done: !i.done })} />
      <div className="main">
        <div className="t">{i.title}</div>
        {(i.notes || city) && <div className="s">{city && <span style={{ color: 'var(--accent)', fontWeight: 620 }}>Solo a {city}{i.notes ? ' · ' : ''}</span>}{i.notes}</div>}
      </div>
      {i.cost != null && <span className="end num">{money(i.cost, i.currency ?? trip.currency)}</span>}
      {url && <img className="thumb" src={url} alt="" />}
    </div>
  )
}

export function Shopping({ trip: t }: { trip: Trip }) {
  const [by, setBy] = useState<'store' | 'cat'>('store')
  const [city, setCity] = useState(new URLSearchParams(location.hash.split('?')[1]).get('city') ?? '')
  const [only, setOnly] = useState('') // negozio o tipo scelto
  const [open, setOpen] = useState<Item>()
  const all = t.items.filter((i) => i.kind === 'buy')
  const local = city ? all.filter((i) => i.cityId === city) : []
  const rest = city ? all.filter((i) => !i.cityId) : all
  const key = (i: Item) => (by === 'store' ? i.store || 'Ovunque' : BUY_CAT[i.buyCat ?? 'other'])
  const sortDone = (l: Item[]) => [...l].sort((a, b) => Number(!!a.done) - Number(!!b.done))
  // ponytail: gruppi nell'ordine in cui compaiono, così resta l'ordine della lista originale
  const names = [...new Set(rest.map(key))]
  const groups = names.filter((g) => !only || g === only).map((g) => [g, sortDone(rest.filter((i) => key(i) === g))] as const)
  const got = all.filter((i) => i.done).length
  const cityName = t.cities.find((c) => c.id === city)?.name

  return (
    <main className="content wide">
      <Top back={`#/t/${t.id}`}>
        <button className="icon-btn accent" aria-label="Nuova cosa da comprare"
          onClick={() => setOpen({ id: uid(), kind: 'buy', title: '', buyCat: 'other', cityId: city || undefined })}>
          <Plus size={20} weight="bold" />
        </button>
      </Top>
      <div className="enter">
        <p className="eyebrow">{t.name}</p>
        <h1 className="title">Acquisti</h1>

        <div className="chips">
          <button className={'chip' + (!city ? ' on' : '')} onClick={() => { setCity(''); setOnly('') }}>Ovunque <span className="count">{all.length}</span></button>
          {t.cities.map((c) => (
            <button key={c.id} className={'chip' + (city === c.id ? ' on' : '')} onClick={() => { setCity(c.id); setOnly('') }}>
              <MapPin size={15} weight={city === c.id ? 'fill' : 'regular'} />{c.name}
              <span className="count">{all.filter((i) => i.cityId === c.id).length}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', margin: '10px 0 4px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', maxWidth: 420 }}>
            <Segmented options={[['store', 'Per negozio'], ['cat', 'Per tipo']]} value={by} onChange={(v) => { setBy(v); setOnly('') }} />
          </div>
          {all.length > 0 && <span className="muted small num">{got} di {all.length} presi</span>}
        </div>

        {names.length > 1 && (
          <div className="chips" style={{ marginTop: 10 }}>
            <button className={'chip sm' + (!only ? ' on' : '')} onClick={() => setOnly('')}>{by === 'store' ? 'Tutti i negozi' : 'Tutti i tipi'}</button>
            {names.map((g) => (
              <button key={g} className={'chip sm' + (only === g ? ' on' : '')} onClick={() => setOnly(only === g ? '' : g)}>
                {g} <span className="count">{rest.filter((i) => key(i) === g).length}</span>
              </button>
            ))}
          </div>
        )}

        {city && !only && (
          <section className="shop-group">
            <div className="pgroup-title"><h2 className="h2">Solo a {cityName}</h2><span>{local.length}</span></div>
            {local.length ? (
              <div className="list">{sortDone(local).map((i) => <Row key={i.id} i={i} trip={t} showCity={false} onOpen={() => setOpen(i)} />)}</div>
            ) : <p className="muted small" style={{ margin: '0 6px' }}>Niente di specifico per {cityName}. Aggiungi con + quello che trovi solo qui.</p>}
          </section>
        )}

        <div className="shop-cols">
          {groups.map(([g, list]) => (
            <section key={g} className="shop-group">
              <div className="pgroup-title"><h2 className="h2">{g}</h2><span className="num">{list.filter((i) => i.done).length}/{list.length}</span></div>
              <div className="list">{list.map((i) => <Row key={i.id} i={i} trip={t} showCity={!city} onOpen={() => setOpen(i)} />)}</div>
            </section>
          ))}
        </div>
        {!all.length && (
          <div className="empty">
            <span className="ico h-buy"><ShoppingBag size={26} weight="duotone" /></span>
            <b>Lista vuota</b>Snack dei combini, souvenir, cosmetici: tutto qui.
          </div>
        )}
      </div>
      <ItemSheet trip={t} item={open} onClose={() => setOpen(undefined)} />
    </main>
  )
}
