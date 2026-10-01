import { useEffect, useState } from 'react'
import {
  AirplaneTilt, CalendarDots, GearSix, House, ListChecks, MapPin, Plus, ShoppingBag, SuitcaseRolling, UserCircle, Wallet,
} from '@phosphor-icons/react'
import { usePhoto, useSettings, useTrip, useTrips } from './store'
import { Hosts, Img, TripImage } from './ui'
import { onNavigate } from './nav'
import { countdown } from './util'
import { Trips } from './screens/Trips'
import { Overview } from './screens/Overview'
import { Plan } from './screens/Plan'
import { Places } from './screens/Places'
import { Shopping } from './screens/Shopping'
import { Budget } from './screens/Budget'
import { Prep } from './screens/Prep'
import { Profile } from './screens/Profile'
import { Settings } from './screens/Settings'
import { City } from './screens/City'

// ponytail: router a hash, bastano due livelli
function useRoute() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const f = (e: HashChangeEvent) => {
      const y = onNavigate(new URL(e.oldURL).hash || '#/', location.hash || '#/')
      setHash(location.hash)
      requestAnimationFrame(() => window.scrollTo({ top: y }))
    }
    addEventListener('hashchange', f)
    return () => removeEventListener('hashchange', f)
  }, [])
  return [hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean), hash.split('?')[0]] as const
}

const TRIP_TABS = [
  { id: 'home', label: 'Panoramica', Icon: House },
  { id: 'plan', label: 'Programma', Icon: CalendarDots },
  { id: 'places', label: 'Posti', Icon: MapPin },
  { id: 'shop', label: 'Acquisti', Icon: ShoppingBag },
  { id: 'budget', label: 'Budget', Icon: Wallet },
] as const
const ROOT_TABS = [
  { id: 'trips', label: 'Viaggi', Icon: SuitcaseRolling, href: '#/' },
  { id: 'profile', label: 'Profilo', Icon: UserCircle, href: '#/profile' },
  { id: 'settings', label: 'Impostazioni', Icon: GearSix, href: '#/settings' },
] as const

function TabBar({ tabs, active }: { tabs: readonly { id: string; label: string; Icon: typeof House; href: string }[]; active: string }) {
  const i = tabs.findIndex((t) => t.id === active)
  return (
    <nav className="tabbar glass" style={{ ['--n' as string]: tabs.length, ['--i' as string]: Math.max(0, i) }}>
      {i >= 0 && <span className="lens" />}
      {tabs.map(({ id, label, Icon, href }) => (
        <a key={id} href={href} className={active === id ? 'on' : ''} aria-current={active === id ? 'page' : undefined}>
          <Icon size={25} weight={active === id ? 'fill' : 'regular'} />{label}
        </a>
      ))}
    </nav>
  )
}

function Sidebar({ tripId, tab, root, cityId }: { tripId?: string; tab: string; root: string; cityId?: string }) {
  const trips = [...useTrips()].sort((a, b) => a.start.localeCompare(b.start))
  const s = useSettings()
  const avatar = usePhoto(s.avatar)
  return (
    <aside className="sidebar glass">
      <a className="brand" href="#/"><i><AirplaneTilt size={17} weight="fill" /></i>Viaggi</a>
      <div className="side-scroll">
        <div className="side-label">I tuoi viaggi<a className="link" href="#/new" aria-label="Nuovo viaggio"><Plus size={16} weight="bold" /></a></div>
        {trips.map((t) => (
          <div key={t.id}>
            <a className={'side-item' + (t.id === tripId && tab === 'home' ? ' on' : '')} href={`#/t/${t.id}`}>
              <TripImage t={t} className="thumb-sm" />
              <span className="txt">{t.name}<small>{countdown(t)}</small></span>
            </a>
            {t.id === tripId && (
              <div className="side-sub">
                {[...TRIP_TABS.slice(1), { id: 'prep', label: 'Preparativi', Icon: ListChecks }].map(({ id, label, Icon }) => (
                  <a key={id} className={'side-item' + (tab === id ? ' on' : '')} href={`#/t/${t.id}/${id}`}>
                    <Icon size={19} weight={tab === id ? 'fill' : 'regular'} />{label}
                  </a>
                ))}
                {t.cities.map((c) => (
                  <a key={c.id} className={'side-item' + (tab === 'city' && cityId === c.id ? ' on' : '')} href={`#/t/${t.id}/city/${c.id}`}>
                    <Img className="thumb-city" src={c.image || undefined} />{c.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {!trips.length && <a className="side-item" href="#/new"><Plus size={19} />Nuovo viaggio</a>}
      </div>
      <div className="side-foot">
        <a className={'side-item' + (root === 'profile' ? ' on' : '')} href="#/profile">
          {avatar ? <img src={avatar} alt="" className="thumb-sm" style={{ borderRadius: '50%', objectFit: 'cover' }} /> : <UserCircle size={22} />}
          <span className="txt">{s.name || 'Profilo'}</span>
        </a>
        <a className={'side-item' + (root === 'settings' ? ' on' : '')} href="#/settings"><GearSix size={21} />Impostazioni</a>
      </div>
    </aside>
  )
}

export default function App() {
  const [[section = '', tripId, tabRaw, param], path] = useRoute()
  const trip = useTrip(tripId ?? '')
  const theme = useSettings().theme
  useEffect(() => {
    if (theme === 'auto') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
  }, [theme])

  const inTrip = section === 't' && !!trip
  const tab = inTrip ? tabRaw ?? 'home' : ''
  const root = inTrip ? '' : section === 'profile' || section === 'settings' ? section : 'trips'
  const TripScreen = { home: Overview, plan: Plan, places: Places, shop: Shopping, budget: Budget, prep: Prep }[tab] ?? Overview

  return (
    <div className="shell">
      <Sidebar tripId={inTrip ? trip.id : undefined} tab={tab} root={root} cityId={param} />
      <div key={path} style={{ minWidth: 0 }}>
        {inTrip && tab === 'city' ? <City trip={trip} cityId={param ?? ''} />
          : inTrip ? <TripScreen trip={trip} />
          : root === 'profile' ? <Profile />
          : root === 'settings' ? <Settings />
          : <Trips adding={section === 'new'} />}
      </div>
      {inTrip
        ? <TabBar tabs={TRIP_TABS.map((t) => ({ ...t, href: `#/t/${trip.id}/${t.id}` }))} active={tab} />
        : <TabBar tabs={ROOT_TABS} active={root} />}
      <Hosts />
    </div>
  )
}
