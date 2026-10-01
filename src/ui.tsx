import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  AirplaneTilt, Bed, Train, TrainSimple, Subway, Bus, Taxi, PersonSimpleWalk, Boat, Car, Ticket, Receipt, ShoppingBag,
  Binoculars, ForkKnife, Coffee, Cake, Martini, Sparkle, Basket, Storefront, Check, Camera, Leaf, X, CaretLeft,
  FilePdf, FileImage, File as FileIcon, Paperclip, ShareNetwork, DownloadSimple, Trash, MagnifyingGlass, CaretDown, Bicycle, CableCar, Star,
} from '@phosphor-icons/react'
import type { Currency, Diet, Doc, Item, Traveler, Trip } from './types'
import { DIET, currencyList, currencyName, fileSize } from './util'
import { goBack } from './nav'
import { deleteFile, deletePhoto, getFile, saveFile, savePhoto, useFileUrl, usePhoto, useRates } from './store'

// =========================================================
// Icone e miniature
// =========================================================

const MODE_ICON = { plane: AirplaneTilt, shinkansen: TrainSimple, train: Train, metro: Subway, bus: Bus, taxi: Taxi, walk: PersonSimpleWalk, ferry: Boat, car: Car, bike: Bicycle, cable: CableCar }
const PLACE_ICON = { sight: Binoculars, food: ForkKnife, cafe: Coffee, sweets: Cake, bar: Martini, experience: Sparkle, market: Basket, shop: Storefront }
const KIND_ICON = { flight: AirplaneTilt, stay: Bed, transport: Train, place: Binoculars, buy: ShoppingBag, pass: Ticket, expense: Receipt }

type IconItem = Pick<Item, 'kind' | 'placeCat' | 'mode'>
export const hueClass = (i: IconItem) => 'h-' + (i.kind === 'place' ? (i.placeCat ?? 'sight') : i.kind)
export function iconFor(i: IconItem) {
  return i.kind === 'place' ? PLACE_ICON[i.placeCat ?? 'sight'] : i.kind === 'transport' && i.mode ? MODE_ICON[i.mode] : KIND_ICON[i.kind]
}

export function KindIcon({ item, size = 21 }: { item: IconItem; size?: number }) {
  const Icon = iconFor(item)
  return <span className={'ico ' + hueClass(item)}><Icon size={size} weight="duotone" /></span>
}

/** Prima foto dell'elemento, altrimenti icona colorata. */
export function ItemThumb({ item }: { item: Item }) {
  const url = usePhoto(item.photos?.[0])
  return url ? <img className="thumb" src={url} alt="" /> : <KindIcon item={item} />
}

/** Immagine remota con dissolvenza all'arrivo. */
export function Img({ src, className = '', alt = '' }: { src?: string; className?: string; alt?: string }) {
  const [ok, setOk] = useState(false)
  return (
    <div className={'img ' + className}>
      {src && <img src={src} alt={alt} loading="lazy" decoding="async" className={ok ? 'ok' : ''} onLoad={() => setOk(true)} />}
    </div>
  )
}

/** Copertina del viaggio: foto caricata, altrimenti la foto della prima città. */
export function TripImage({ t, className = '' }: { t: Trip; className?: string }) {
  const own = usePhoto(t.cover)
  return <Img className={className} src={own ?? t.cities.find((c) => c.image)?.image} />
}

export function DietBadge({ diet, showUnknown }: { diet?: Diet; showUnknown?: boolean }) {
  if (!diet) return showUnknown ? <span className="badge unknown">Da verificare</span> : null
  if (diet === 'none') return null
  return <span className={'badge ' + diet}>{diet !== 'options' && <Leaf size={12} weight="fill" />}{DIET[diet]}</span>
}

export function Ring({ value, size = 46 }: { value: number; size?: number }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <svg className="ring" width={size} height={size} aria-hidden>
      <circle className="track" cx={size / 2} cy={size / 2} r={r} />
      <circle className="val" cx={size / 2} cy={size / 2} r={r} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))} />
    </svg>
  )
}

// =========================================================
// Controlli
// =========================================================

export function CheckBtn({ on, onChange, label }: { on?: boolean; onChange: () => void; label: string }) {
  return (
    <button className={'check' + (on ? ' on' : '')} onClick={(e) => (e.stopPropagation(), onChange())} role="checkbox" aria-checked={!!on} aria-label={label}>
      <Check size={15} weight="bold" />
    </button>
  )
}

export function StarBtn({ on, onChange, size = 22 }: { on?: boolean; onChange: () => void; size?: number }) {
  return (
    <button className={'star' + (on ? ' on' : '')} onClick={(e) => (e.stopPropagation(), onChange())} aria-pressed={!!on} aria-label={on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}>
      <Star size={size} weight={on ? 'fill' : 'regular'} />
    </button>
  )
}

export function Switch({ checked, onChange, label }: { checked?: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" className="switch" role="switch" aria-checked={!!checked} aria-label={label} onClick={() => onChange(!checked)} />
}

export function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  const i = Math.max(0, options.findIndex(([k]) => k === value))
  return (
    <div className="seg" style={{ ['--n' as string]: options.length, ['--i' as string]: i }} role="tablist">
      <span className="lens" />
      {options.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={k === value} className={k === value ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  )
}

export function Options<T extends string>({ options, value, onChange, allowNone }: { options: Record<T, string>; value?: T; onChange: (v?: T) => void; allowNone?: boolean }) {
  return (
    <div className="opts">
      {(Object.keys(options) as T[]).map((k) => (
        <button key={k} type="button" className={'chip' + (value === k ? ' on' : '')} onClick={() => onChange(allowNone && value === k ? undefined : k)}>
          {options[k]}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, col }: { label: string; children: ReactNode; col?: boolean }) {
  return <label className={'field' + (col ? ' col' : '')}><span className="lbl">{label}</span>{children}</label>
}

export function SwitchRow({ label, checked, onChange }: { label: string; checked?: boolean; onChange: (v: boolean) => void }) {
  return <div className="field switch-row"><span className="lbl">{label}</span><Switch label={label} checked={checked} onChange={onChange} /></div>
}

// =========================================================
// Barra in alto
// =========================================================

export function Top({ back, children }: { back?: string; children?: ReactNode }) {
  return (
    <header className="top">
      {back && <button className="icon-btn glass" onClick={() => goBack(back)} aria-label="Indietro"><CaretLeft size={20} weight="bold" /></button>}
      <div className="spacer" />
      {children}
    </header>
  )
}

// =========================================================
// Sheet (dialog nativo nel top layer)
// =========================================================

export function Sheet({ open, onClose, children, center }: { open: boolean; onClose: () => void; children: ReactNode; center?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  // ponytail: tiene l'ultimo contenuto durante l'animazione di chiusura, poi lo smonta
  const [shown, setShown] = useState<ReactNode>(null)
  useEffect(() => {
    if (open) return setShown(children)
    const t = setTimeout(() => setShown(null), 500)
    return () => clearTimeout(t)
  }, [open, children])
  useEffect(() => {
    const d = ref.current!
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className={'sheet' + (center ? ' center' : '')} onClose={onClose} onCancel={(e) => (e.preventDefault(), onClose())}
      onClick={(e) => e.target === ref.current && onClose()}>
      {open ? children : shown}
    </dialog>
  )
}

export function SheetTop({ title, onClose, onDone, right }: { title: string; onClose: () => void; onDone?: () => void; right?: ReactNode }) {
  return (
    <div className="sheet-top">
      <button className="icon-btn glass" onClick={onClose} aria-label="Chiudi"><X size={19} weight="bold" /></button>
      <b>{title}</b>
      {right ?? (onDone ? <button className="icon-btn solid" onClick={onDone} aria-label="Conferma"><Check size={19} weight="bold" /></button> : <span />)}
    </div>
  )
}

// =========================================================
// Conferme e toast globali (niente confirm/alert del browser)
// =========================================================

type Ask = { title: string; message?: string; action: string; resolve: (ok: boolean) => void }
let asking: Ask | null = null
let toastMsg = ''
const hostSubs = new Set<() => void>()
const emit = () => hostSubs.forEach((f) => f())
const subscribeHost = (f: () => void) => (hostSubs.add(f), () => hostSubs.delete(f))

export function ask(title: string, action: string, message?: string) {
  return new Promise<boolean>((resolve) => { asking = { title, message, action, resolve }; emit() })
}

let toastTimer = 0
export function toast(msg: string) {
  toastMsg = msg
  emit()
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toastMsg = ''; emit() }, 2600)
}

export function Hosts() {
  const a = useSyncExternalStore(subscribeHost, () => asking)
  const t = useSyncExternalStore(subscribeHost, () => toastMsg)
  const dlg = useRef<HTMLDialogElement>(null)
  const pop = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (a && !dlg.current!.open) dlg.current!.showModal()
    if (!a && dlg.current!.open) dlg.current!.close()
  }, [a])
  useEffect(() => {
    const p = pop.current
    if (!p?.showPopover) return
    if (t) { p.hidePopover?.(); p.showPopover() } else if (p.matches(':popover-open')) p.hidePopover()
  }, [t])

  const done = (ok: boolean) => { asking?.resolve(ok); asking = null; emit() }
  return (
    <>
      <dialog ref={dlg} className="confirm" onCancel={(e) => (e.preventDefault(), done(false))}>
        {a && (
          <>
            <h3>{a.title}</h3>
            {a.message && <p>{a.message}</p>}
            <div className="btns">
              <button onClick={() => done(false)}>Annulla</button>
              <button className="destructive" onClick={() => done(true)} autoFocus>{a.action}</button>
            </div>
          </>
        )}
      </dialog>
      <div ref={pop} popover="manual" className="toast" role="status">{t}</div>
    </>
  )
}

// =========================================================
// Visualizzatore a schermo intero (documenti e foto)
// =========================================================

function Viewer({ open, onClose, title, url, type, docId, onShare, onDelete }: {
  open: boolean; onClose: () => void; title: string; url?: string; type: string; docId?: string; onShare?: () => void; onDelete?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current!
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="viewer" onClose={onClose} onCancel={(e) => (e.preventDefault(), onClose())}>
      {open && (
        <>
          <div className="bar">
            <button className="icon-btn glass" onClick={onClose} aria-label="Chiudi"><X size={19} weight="bold" /></button>
            <b>{title}</b>
            {onShare && <button className="icon-btn glass" onClick={onShare} aria-label="Condividi o salva"><ShareNetwork size={19} /></button>}
            {url && <a className="icon-btn glass hide-narrow" href={url} download={title} aria-label="Scarica"><DownloadSimple size={19} /></a>}
            {onDelete && <button className="icon-btn glass" onClick={onDelete} aria-label="Elimina" style={{ color: 'var(--danger)' }}><Trash size={19} /></button>}
          </div>
          <div className="body">
            {type === 'application/pdf' && docId ? <div className="viewer-pages"><PdfPages id={docId} name={title} /></div>
              : !url ? <span className="muted">Carico…</span>
              : type.startsWith('image/') ? <img src={url} alt={title} />
              : <div className="empty"><b>Anteprima non disponibile</b>Usa condividi per aprirlo con un'altra app.</div>}
          </div>
        </>
      )}
    </dialog>
  )
}

export async function shareFile(doc: Doc) {
  const blob = await getFile(doc.id)
  if (!blob) return toast('File non trovato su questo dispositivo')
  const file = new File([blob], doc.name, { type: doc.type })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: doc.name }).catch(() => {})
  } else {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(file)
    a.download = doc.name
    a.click()
  }
}

// =========================================================
// Anteprima dei file direttamente nella pagina (PDF disegnati con pdf.js)
// =========================================================

// ponytail: pagine già disegnate restano in memoria per la sessione; massimo 6 pagine per file
const pdfCache = new Map<string, string[]>()

function PdfPages({ id, name }: { id: string; name: string }) {
  const [pages, setPages] = useState(pdfCache.get(id))
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (pdfCache.has(id)) return
    let live = true
    ;(async () => {
      const blob = await getFile(id)
      if (!blob) throw new Error('missing')
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
      const out: string[] = []
      for (let n = 1; n <= Math.min(pdf.numPages, 6); n++) {
        const page = await pdf.getPage(n)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvas, viewport }).promise
        out.push(await new Promise<string>((r) => canvas.toBlob((b) => r(URL.createObjectURL(b!)), 'image/jpeg', 0.88)))
      }
      pdfCache.set(id, out)
      if (live) setPages(out)
    })().catch(() => live && setFailed(true))
    return () => { live = false }
  }, [id])
  if (failed) return <div className="doc-msg">Non riesco a mostrare questo PDF. Usa condividi per aprirlo.</div>
  if (!pages) return <div className="doc-msg">Preparo l'anteprima…</div>
  return <>{pages.map((src, i) => <img key={i} src={src} alt={`${name}, pagina ${i + 1}`} />)}</>
}

function DocPreview({ doc }: { doc: Doc }) {
  const url = useFileUrl(doc.type.startsWith('image/') ? doc.id : undefined)
  if (doc.type === 'application/pdf') return <PdfPages id={doc.id} name={doc.name} />
  if (doc.type.startsWith('image/')) return url ? <img src={url} alt={doc.name} /> : <div className="doc-msg">Carico…</div>
  return <div className="doc-msg">Anteprima non disponibile per questo tipo di file. Usa condividi per aprirlo.</div>
}

const docIcon = (d: Doc) => (d.type === 'application/pdf' ? FilePdf : d.type.startsWith('image/') ? FileImage : FileIcon)

/** Scheda di un file: intestazione con proprietario e azioni, anteprima sotto (aperta o a scomparsa). */
export function DocCard({ doc, travelers = [], onChange, onDelete, sub, collapsible }: {
  doc: Doc; travelers?: Traveler[]; onChange?: (d: Doc) => void; onDelete?: () => void; sub?: string; collapsible?: boolean
}) {
  const [open, setOpen] = useState(!collapsible)
  const Icon = docIcon(doc)
  const owner = travelers.find((t) => t.id === doc.travelerId)
  const askOwner = !!onChange && travelers.length > 1 && !owner
  return (
    <div className="doc-card">
      <div className="doc-head">
        <button className="doc-title" onClick={() => collapsible && setOpen(!open)} aria-expanded={open}>
          <span className="ico h-flight"><Icon size={20} weight="duotone" /></span>
          <span className="main">
            <span className="t">{doc.name}</span>
            <span className="s">{[owner?.name, sub, fileSize(doc.size)].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
        <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => shareFile(doc)} aria-label="Condividi o salva"><ShareNetwork size={19} /></button>
        {onDelete && <button className="icon-btn" style={{ width: 38, height: 38, color: 'var(--danger)' }} onClick={onDelete} aria-label="Elimina"><Trash size={19} /></button>}
      </div>
      {onChange && travelers.length > 1 && (
        <div className={'owner' + (askOwner ? ' ask' : '')}>
          <span>{askOwner ? 'Di chi è?' : 'Di'}</span>
          {travelers.map((t) => (
            <button key={t.id} className={'chip' + (doc.travelerId === t.id ? ' on' : '')} onClick={() => onChange({ ...doc, travelerId: doc.travelerId === t.id ? undefined : t.id })}>{t.name}</button>
          ))}
        </div>
      )}
      {open && <div className="doc-preview"><DocPreview doc={doc} /></div>}
    </div>
  )
}

/** Apre un file a schermo intero (es. dal pulsante "Biglietto di …"). */
export function useDocOpener() {
  const [doc, setDoc] = useState<Doc>()
  const url = useFileUrl(doc && !doc.type.includes('pdf') ? doc.id : undefined)
  const viewer = (
    <Viewer open={!!doc} onClose={() => setDoc(undefined)} title={doc?.name ?? ''} url={url} type={doc?.type ?? ''} docId={doc?.id}
      onShare={() => doc && shareFile(doc)} />
  )
  return [setDoc, viewer] as const
}

export function FileList({ files, onChange, addLabel = 'Allega file', travelers, collapsible }: {
  files: Doc[]; onChange: (f: Doc[]) => void; addLabel?: string; travelers?: Traveler[]; collapsible?: boolean
}) {
  const [busy, setBusy] = useState(false)

  async function add(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    try {
      const added = await Promise.all([...list].map(saveFile))
      // con un solo viaggiatore il file è suo; con più viaggiatori la scheda chiede "di chi è?"
      onChange([...files, ...added.map((d) => (travelers?.length === 1 ? { ...d, travelerId: travelers[0].id } : d))])
    } catch { toast('Non sono riuscito a salvare il file') }
    finally { setBusy(false) }
  }

  async function remove(doc: Doc) {
    if (!(await ask(`Eliminare ${doc.name}?`, 'Elimina', 'Il file verrà rimosso da questo dispositivo.'))) return
    await deleteFile(doc.id)
    pdfCache.delete(doc.id)
    onChange(files.filter((f) => f.id !== doc.id))
  }

  return (
    <div className="doc-list">
      {files.map((f) => (
        <DocCard key={f.id} doc={f} travelers={travelers} collapsible={collapsible}
          onChange={(d) => onChange(files.map((x) => (x.id === d.id ? d : x)))} onDelete={() => remove(f)} />
      ))}
      <label className="add-file">
        <Paperclip size={19} weight="bold" />{busy ? 'Salvo…' : addLabel}
        <input type="file" accept="application/pdf,image/*,.pkpass" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </label>
    </div>
  )
}

// =========================================================
// Foto
// =========================================================

function GalleryImg({ id, onOpen }: { id: string; onOpen: () => void }) {
  const url = usePhoto(id)
  return url ? <img src={url} alt="" onClick={onOpen} /> : null
}

export function Gallery({ ids = [], remote = [], onChange, readOnly }: { ids?: string[]; remote?: string[]; onChange: (ids: string[]) => void; readOnly?: boolean }) {
  const [view, setView] = useState<string>() // id foto caricata oppure URL remoto
  const [busy, setBusy] = useState(false)
  const isRemote = !!view?.startsWith('http')
  const ownUrl = usePhoto(isRemote ? undefined : view)

  async function add(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    try { onChange([...ids, ...(await Promise.all([...files].map(savePhoto)))]) }
    catch { toast('Non riesco a leggere la foto. Prova con un JPG o PNG.') }
    finally { setBusy(false) }
  }

  const count = ids.length + remote.length
  if (readOnly && !count) return null
  return (
    <>
      <div className={'gallery' + (count === 1 && readOnly ? ' solo' : '') + (!count ? ' empty-g' : '')}>
        {ids.map((id) => <GalleryImg key={id} id={id} onOpen={() => setView(id)} />)}
        {remote.map((src) => <img key={src} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onClick={() => setView(src)} />)}
        {!readOnly && (
          <label className="add-photo">
            <Camera size={26} weight="duotone" />
            {busy ? 'Carico…' : count ? 'Aggiungi' : 'Aggiungi foto'}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
          </label>
        )}
      </div>
      <Viewer open={!!view} onClose={() => setView(undefined)} title={isRemote ? 'Foto da Google' : 'Foto'} url={isRemote ? view : ownUrl} type="image/jpeg"
        onDelete={readOnly || isRemote ? undefined : async () => {
          if (!view || !(await ask('Eliminare questa foto?', 'Elimina'))) return
          deletePhoto(view)
          onChange(ids.filter((i) => i !== view))
          setView(undefined)
        }} />
    </>
  )
}

// =========================================================
// Valuta
// =========================================================

export function CurrencyButton({ value, onChange, className = 'cur-btn' }: { value: Currency; onChange: (c: Currency) => void; className?: string }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const rates = useRates()
  const list = currencyList(rates).filter((c) => !q || `${c} ${currencyName(c)}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>{value}<CaretDown size={13} weight="bold" /></button>
      <Sheet open={open} onClose={() => setOpen(false)} center>
        <SheetTop title="Valuta" onClose={() => setOpen(false)} />
        <div className="sheet-body">
          <div className="search" style={{ marginBottom: 14 }}>
            <MagnifyingGlass size={18} />
            <input placeholder="Cerca valuta o paese" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="list cur-list">
            {list.slice(0, 80).map((c) => (
              <button key={c} className="row" style={{ minHeight: 52 }} onClick={() => { onChange(c); setOpen(false); setQ('') }}>
                <span className="code">{c}</span>
                <div className="main"><div className="t" style={{ fontWeight: 500 }}>{currencyName(c)}</div></div>
                {c === value && <Check size={18} weight="bold" color="var(--accent)" />}
              </button>
            ))}
            {!list.length && <div className="empty">Nessuna valuta trovata</div>}
          </div>
        </div>
      </Sheet>
    </>
  )
}
