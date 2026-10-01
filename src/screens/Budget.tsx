import { useState } from 'react'
import { ArrowsClockwise, ArrowsDownUp, Bed, Plus, Receipt, WarningCircle } from '@phosphor-icons/react'
import type { BudgetCat, Item, Trip } from '../types'
import { refreshRates, uid, updateTrip, useRates, useSettings } from '../store'
import { BUDGET_CAT, budgetCat, convert, diffDays, fmtDay, money, stayTax, today, totals } from '../util'
import { CurrencyButton, ItemThumb, Top, toast } from '../ui'
import { ItemSheet } from '../ItemSheet'

const HUE: Record<BudgetCat, string> = {
  flights: '#3f6fe0', stays: '#7a5fd0', taxes: '#9b6bd8', transport: '#0f9483', passes: '#d4962a', food: '#df4a55', activities: '#ec7a2c', shopping: '#d9508f', other: '#8a8e98',
}

function Converter({ trip: t }: { trip: Trip }) {
  const home = useSettings().home
  const rates = useRates()
  const [from, setFrom] = useState(t.currency)
  const [to, setTo] = useState(home)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const n = Number(amount.replace(',', '.')) || 0
  const out = convert(n || 1, from, to, rates)

  async function refresh() {
    setLoading(true)
    try { await refreshRates(true); toast('Cambi aggiornati') } catch (e) { toast((e as Error).message) } finally { setLoading(false) }
  }

  return (
    <section className="section" style={{ marginTop: 0 }}>
      <div className="section-head">
        <h2 className="h2">Convertitore</h2>
        <button className="link" onClick={refresh}><ArrowsClockwise size={17} className={loading ? 'spin' : ''} />Aggiorna</button>
      </div>
      <div className="card converter">
        <div className="line">
          <input inputMode="decimal" placeholder="1" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={`Importo in ${from}`} />
          <CurrencyButton value={from} onChange={setFrom} />
        </div>
        <div className="line">
          <output>{out == null ? '-' : new Intl.NumberFormat('it-IT', { maximumFractionDigits: out >= 100 ? 0 : 2 }).format(out)}</output>
          <button className="icon-btn" style={{ width: 36, height: 36, background: 'var(--fill)' }} aria-label="Inverti" onClick={() => { setFrom(to); setTo(from) }}><ArrowsDownUp size={17} /></button>
          <CurrencyButton value={to} onChange={setTo} />
        </div>
      </div>
      <p className="small faint" style={{ margin: '8px 6px 0' }}>
        {rates ? `Cambi del ${new Date(rates.date).toLocaleDateString('it-IT')}` : 'Cambi non ancora scaricati, collegati a internet'}
      </p>
    </section>
  )
}

export function Budget({ trip: t }: { trip: Trip }) {
  const home = useSettings().home
  const rates = useRates()
  const [open, setOpen] = useState<Item>()
  const [expanded, setExpanded] = useState<BudgetCat>()
  const { planned, paid, unconverted, byCat } = totals(t, home, rates)
  const cats = (Object.keys(BUDGET_CAT) as BudgetCat[]).filter((c) => byCat[c])
  const expenses = t.items.filter((i) => i.kind === 'expense').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))

  const newExpense = () => {
    const d = today()
    setOpen({ id: uid(), kind: 'expense', title: '', expenseCat: 'food', currency: t.currency, date: d >= t.start && d <= t.end ? d : undefined })
  }

  return (
    <main className="content wide">
      <Top back={`#/t/${t.id}`}>
        <button className="icon-btn accent" aria-label="Nuova spesa" onClick={newExpense}><Plus size={20} weight="bold" /></button>
      </Top>
      <div className="enter">
        <p className="eyebrow">{t.name}</p>
        <h1 className="title">Budget</h1>

        <div className="budget-grid">
          <div>
            <div className="card" style={{ padding: 22 }}>
              <div className="big-money">{money(planned, home, true)}</div>
              <div className="muted" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                previsti{t.budget ? ` su ${money(t.budget, home, true)}` : ''}
                {!t.budget && (
                  <label className="link" style={{ fontSize: 14 }}>
                    · imposta budget
                    <input type="number" inputMode="decimal" placeholder={home} style={{ width: 90, border: 0, background: 'var(--fill)', borderRadius: 10, padding: '4px 8px', outline: 'none' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { const v = Number((e.target as HTMLInputElement).value); if (v > 0) updateTrip(t.id, (x) => ({ ...x, budget: v })) } }} />
                  </label>
                )}
              </div>
              {planned > 0 && (
                <div className="stack-bar">
                  {cats.map((c) => <i key={c} style={{ flexGrow: byCat[c], ['--hue' as string]: HUE[c] }} />)}
                  {t.budget && t.budget > planned && <span style={{ flexGrow: t.budget - planned }} />}
                </div>
              )}
              <div className="stats">
                <div className="stat"><b>{money(paid, home, true)}</b><span>pagato</span></div>
                <div className="stat"><b>{money(planned - paid, home, true)}</b><span>da pagare</span></div>
                <div className="stat"><b style={t.budget && planned > t.budget ? { color: 'var(--danger)' } : undefined}>{t.budget ? money(t.budget - planned, home, true) : '-'}</b><span>margine</span></div>
              </div>
              {unconverted > 0 && (
                <p className="small" style={{ marginTop: 14, display: 'flex', gap: 6, alignItems: 'center', color: 'var(--accent)' }}>
                  <WarningCircle size={16} weight="fill" />{unconverted} costi esclusi: manca il cambio, collegati a internet.
                </p>
              )}
            </div>

            <section className="section">
              <div className="section-head"><h2 className="h2">Per categoria</h2></div>
              {cats.length ? (
                <div className="list">
                  {cats.map((c) => (
                    <div key={c}>
                      <button className="row" onClick={() => setExpanded(expanded === c ? undefined : c)} aria-expanded={expanded === c}>
                        <span className="legend-dot" style={{ ['--hue' as string]: HUE[c] }} />
                        <div className="main"><div className="t">{BUDGET_CAT[c]}</div></div>
                        <b className="num">{money(byCat[c], home, true)}</b>
                        <span className="faint small num" style={{ width: 40, textAlign: 'right' }}>{Math.round((byCat[c] / planned) * 100)}%</span>
                      </button>
                      {expanded === c && t.items.filter((i) => (c === 'taxes' ? !!stayTax(i, t) : i.cost && budgetCat(i) === c)).map((i) => (
                        <button key={i.id} className="row" onClick={() => setOpen(i)} style={{ paddingLeft: 28, background: 'var(--surface-2)' }}>
                          <ItemThumb item={i} />
                          <div className="main"><div className="t">{i.title}</div><div className="s">{i.paid || i.kind === 'expense' ? 'Pagato' : 'Da pagare'}</div></div>
                          <span className="end num">{c === 'taxes' ? money(stayTax(i, t)!.total, stayTax(i, t)!.currency) : money(i.cost!, i.currency ?? t.currency)}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : <p className="muted small">Aggiungi un costo a voli, hotel, pass o posti e compariranno qui.</p>}
            </section>
          </div>

          <div>
            <Converter trip={t} />
            <TaxSection trip={t} onOpen={setOpen} />
            <section className="section">
              <div className="section-head"><h2 className="h2">Spese in viaggio</h2><button className="link" onClick={newExpense}><Plus size={16} weight="bold" />Aggiungi</button></div>
              {expenses.length ? (
                <div className="list">
                  {expenses.map((i) => (
                    <button key={i.id} className="row" onClick={() => setOpen(i)}>
                      <ItemThumb item={i} />
                      <div className="main"><div className="t">{i.title}</div><div className="s">{[i.expenseCat && BUDGET_CAT[i.expenseCat], i.date && fmtDay(i.date)].filter(Boolean).join(' · ')}</div></div>
                      <span className="end num">{i.cost != null ? money(i.cost, i.currency ?? t.currency) : ''}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="card empty" style={{ padding: 28 }}>
                  <span className="ico h-expense"><Receipt size={26} weight="duotone" /></span>
                  Durante il viaggio segna qui pranzi, biglietti e piccoli acquisti.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
      <ItemSheet trip={t} item={open} onClose={() => setOpen(undefined)} />
    </main>
  )
}

/** Tasse di soggiorno: per persona per notte su ogni alloggio, totale calcolato con notti e viaggiatori. */
function TaxSection({ trip: t, onOpen }: { trip: Trip; onOpen: (i: Item) => void }) {
  const home = useSettings().home
  const rates = useRates()
  const stays = t.items.filter((i) => i.kind === 'stay').sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
  if (!stays.length) return null
  const people = Math.max(1, t.travelers.length)
  const sum = stays.reduce((n, i) => {
    const x = stayTax(i, t)
    return n + (x ? convert(x.total, x.currency, home, rates) ?? 0 : 0)
  }, 0)
  const flat = t.items.find((i) => i.kind === 'expense' && /tass[ae] di soggiorno/i.test(i.title))
  return (
    <section className="section">
      <div className="section-head"><h2 className="h2">Tasse di soggiorno</h2>{sum > 0 && <b className="num">{money(sum, home)}</b>}</div>
      <div className="list">
        {stays.map((i) => {
          const x = stayTax(i, t)
          const nights = i.date && i.endDate ? diffDays(i.date, i.endDate) : 0
          return (
            <button key={i.id} className="row" onClick={() => onOpen(i)}>
              <span className="ico h-stay"><Bed size={20} weight="duotone" /></span>
              <div className="main">
                <div className="t">{i.title}</div>
                <div className="s">{x ? `${money(x.perNight, x.currency)} × ${people} ${people === 1 ? 'persona' : 'persone'} × ${nights} notti` : 'Tocca per inserire la tassa a notte'}</div>
              </div>
              <span className="end num">{x ? money(x.total, x.currency) : <span className="link">Aggiungi</span>}</span>
            </button>
          )
        })}
      </div>
      <p className="small faint" style={{ margin: '8px 6px 0' }}>
        Si inserisce per persona e per notte nella scheda di ogni alloggio; il totale usa le notti e i {people} viaggiatori del viaggio.
        {flat && sum > 0 && ` Hai ancora la stima forfettaria “${flat.title}” tra le spese: eliminala per non contarla due volte.`}
      </p>
    </section>
  )
}
