import { useEffect } from 'react'
import { GearSix } from '@phosphor-icons/react'
import type { Item } from '../types'
import { km } from '../geo'
import { resolvePlaces, savePhoto, updateSettings, useGeo, usePhoto, useRates, useSettings, useTrips } from '../store'
import { countdown, diffDays, money, today, totals } from '../util'
import { Top, TripImage } from '../ui'

export function Profile() {
  const s = useSettings()
  const trips = useTrips()
  const rates = useRates()
  const avatar = usePhoto(s.avatar)
  const items = trips.flatMap((t) => t.items)
  const geo = useGeo()
  // tappe di ogni spostamento: partenza, scali, arrivo (gli "Hotel …" non sono luoghi geocodificabili)
  const legs = (i: Item) => [i.from, ...(i.stops ?? []).map((st) => st.place), i.to].filter((x): x is string => !!x && !/^hotel/i.test(x))
  const moves = items.filter((i) => (i.kind === 'flight' || i.kind === 'transport') && i.from && i.to)
  const names = [...new Set(moves.flatMap(legs))]
  useEffect(() => { resolvePlaces(names) }, [names.join('|')]) // eslint-disable-line
  // ponytail: nomi generici ("Aeroporto", "Stazione") possono essere trovati dall'altra parte del mondo;
  // una tratta via terra oltre 1.500 km è quasi sempre un errore di ricerca e non viene contata
  const distOf = (i: Item) => legs(i).reduce((sum, name, n, arr) => {
    const a = n ? geo[arr[n - 1].trim().toLowerCase()] : null, b = geo[name.trim().toLowerCase()]
    const d = a && b ? km(a, b) : 0
    return i.kind === 'transport' && d > 1500 ? sum : sum + d
  }, 0)
  const flown = moves.filter((i) => i.kind === 'flight').reduce((n, i) => n + distOf(i), 0)
  const ground = moves.filter((i) => i.kind === 'transport').reduce((n, i) => n + distOf(i), 0)
  const resolving = names.some((n) => !(n.trim().toLowerCase() in geo))
  const next = [...trips].filter((t) => t.end >= today()).sort((a, b) => a.start.localeCompare(b.start))[0]
  const stats = [
    ['Km percorsi', `${Math.round(flown + ground).toLocaleString('it-IT')}${resolving ? '…' : ''}`, `${Math.round(flown).toLocaleString('it-IT')} in volo, ${Math.round(ground).toLocaleString('it-IT')} via terra`],
    ['Viaggi', trips.length],
    ['Giorni in viaggio', trips.reduce((n, t) => n + diffDays(t.start, t.end) + 1, 0)],
    ['Città', new Set(trips.flatMap((t) => t.cities.map((c) => c.name.toLowerCase()))).size],
    ['Posti salvati', items.filter((i) => i.kind === 'place').length],
    ['Posti visitati', items.filter((i) => i.kind === 'place' && i.done).length],
    ['Budget totale', money(trips.reduce((n, t) => n + totals(t, s.home, rates).planned, 0), s.home, true)],
  ] as [string, string | number, string?][]

  async function setAvatar(f?: File) {
    if (f) updateSettings({ avatar: await savePhoto(f) })
  }

  return (
    <main className="content wide">
      <Top><a className="icon-btn glass hide-wide" href="#/settings" aria-label="Impostazioni"><GearSix size={20} /></a></Top>
      <div className="enter">
        <div className="profile-head">
          <label className="avatar" aria-label="Cambia foto profilo">
            {avatar ? <img src={avatar} alt="" /> : (s.name || '?').charAt(0).toUpperCase()}
            <input type="file" accept="image/*" hidden onChange={(e) => setAvatar(e.target.files?.[0])} />
          </label>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input className="name-input" placeholder="Il tuo nome" value={s.name} onChange={(e) => updateSettings({ name: e.target.value })} />
            <p className="muted">{trips.length} {trips.length === 1 ? 'viaggio' : 'viaggi'} in programma o fatti</p>
          </div>
        </div>

        <div className="bento">
          {stats.map(([k, v, sub], n) => (
            <div key={k} className={'tile' + (n === 0 ? ' span2' : '')} style={{ minHeight: 120 }}>
              <div className="k">{k}</div><div className="big">{v}</div>{sub && <div className="sub">{sub}</div>}
            </div>
          ))}
        </div>

        {next && (
          <section className="section">
            <div className="section-head"><h2 className="h2">Prossimo viaggio</h2></div>
            <a className="bezel" href={`#/t/${next.id}`} style={{ display: 'block', maxWidth: 520 }}>
              <div className="trip-card" style={{ aspectRatio: '16 / 10' }}>
                <TripImage t={next} />
                <span className="pill-glass">{countdown(next)}</span>
                <div className="body"><h2>{next.name}</h2></div>
              </div>
            </a>
          </section>
        )}
      </div>
    </main>
  )
}
