import { useState } from 'react'
import { CalendarBlank, Plus } from '@phosphor-icons/react'
import type { CheckItem, Trip } from '../types'
import { uid, updateTrip } from '../store'
import { fmtDay } from '../util'
import { CheckBtn, DocCard, FileList, Top } from '../ui'

const GROUPS: [CheckItem['group'], string][] = [['prima', 'Prima di partire'], ['valigia', 'In valigia']]

export function Prep({ trip: t }: { trip: Trip }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const setList = (fn: (l: CheckItem[]) => CheckItem[]) => updateTrip(t.id, (x) => ({ ...x, checklist: fn(x.checklist) }))
  const patch = (id: string, p: Partial<CheckItem>) => setList((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)))
  const attached = t.items.flatMap((i) => (i.files ?? []).map((f) => ({ f, owner: i.title })))

  function add(group: CheckItem['group']) {
    const text = drafts[group]?.trim()
    if (!text) return
    setList((l) => [...l, { id: uid(), group, text }])
    setDrafts((d) => ({ ...d, [group]: '' }))
  }

  return (
    <main className="content">
      <Top back={`#/t/${t.id}`} />
      <div className="enter">
        <p className="eyebrow">{t.name}</p>
        <h1 className="title">Preparativi</h1>
        {GROUPS.map(([g, label]) => {
          const list = t.checklist.filter((c) => c.group === g)
          return (
            <section key={g} className="section" style={{ marginTop: 20 }}>
              <div className="section-head"><h2 className="h2">{label}</h2><span className="faint num">{list.filter((c) => c.done).length}/{list.length}</span></div>
              <div className="list">
                {list.map((c) => (
                  <div key={c.id} className={'row' + (c.done ? ' done' : '')}>
                    <CheckBtn on={c.done} label={c.text} onChange={() => patch(c.id, { done: !c.done })} />
                    <div className="main">
                      <textarea className="check-text" rows={1} value={c.text} aria-label="Testo"
                        onChange={(e) => patch(c.id, { text: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
                        onBlur={(e) => !e.target.value.trim() && setList((l) => l.filter((x) => x.id !== c.id))} />
                      {c.due && <div className="s" style={{ color: 'var(--accent)' }}>entro il {fmtDay(c.due)}</div>}
                    </div>
                    <label className="due-btn" aria-label="Scadenza">
                      <CalendarBlank size={20} weight={c.due ? 'fill' : 'regular'} color={c.due ? 'var(--accent)' : undefined} />
                      <input type="date" value={c.due ?? ''} onChange={(e) => patch(c.id, { due: e.target.value || undefined })} />
                    </label>
                  </div>
                ))}
                <div className="inline-add">
                  <Plus size={20} />
                  <input placeholder="Aggiungi" value={drafts[g] ?? ''} onChange={(e) => setDrafts((d) => ({ ...d, [g]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && add(g)} onBlur={() => add(g)} />
                </div>
              </div>
            </section>
          )
        })}
        <section className="section">
          <div className="section-head"><h2 className="h2">Documenti</h2></div>
          <FileList files={t.docs} travelers={t.travelers} collapsible onChange={(docs) => updateTrip(t.id, (x) => ({ ...x, docs }))} addLabel="Aggiungi passaporto, assicurazione…" />
          {attached.length > 0 && (
            <>
              <div className="group-title">Allegati alle attività</div>
              <div className="doc-list">{attached.map(({ f, owner }) => <DocCard key={f.id} doc={f} travelers={t.travelers} sub={owner} collapsible />)}</div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
