import { useState } from 'react'
import { ArrowsClockwise, DownloadSimple, GoogleLogo, MapPin, Trash, UploadSimple } from '@phosphor-icons/react'
import type { Settings as S } from '../types'
import { enrichTrip, exportBackup, importBackup, refreshRates, updateSettings, useEnrichProgress, useRates, useSettings, useTrips, wipeAll } from '../store'
import { currencyName } from '../util'
import { CurrencyButton, Field, Segmented, Top, ask, toast } from '../ui'

export function Settings() {
  const s = useSettings()
  const rates = useRates()
  const [loading, setLoading] = useState(false)
  const [key, setKey] = useState(s.googleKey ?? '')
  const [guide, setGuide] = useState(false)
  const trips = useTrips()
  const progress = useEnrichProgress()

  async function enrichAll() {
    for (const t of trips) await enrichTrip(t.id, true)
    toast('Posti aggiornati')
  }

  async function restore(f?: File) {
    if (!f || !(await ask('Ripristinare il backup?', 'Ripristina', 'I dati attuali su questo dispositivo verranno sostituiti.'))) return
    try { await importBackup(f); toast('Backup ripristinato') } catch (e) { toast((e as Error).message) }
  }

  return (
    <main className="content">
      <Top />
      <div className="enter">
        <h1 className="title">Impostazioni</h1>

        <div className="group-title">Preferenze</div>
        <div className="form">
          <div className="field"><span className="lbl" style={{ flex: 1 }}>Valuta di casa<br /><small className="faint">{currencyName(s.home)}</small></span><CurrencyButton value={s.home} onChange={(home) => updateSettings({ home })} /></div>
          <div className="field col" style={{ paddingBottom: 12 }}>
            <span className="lbl">Aspetto</span>
            <Segmented<S['theme']> options={[['auto', 'Automatico'], ['light', 'Chiaro'], ['dark', 'Scuro']]} value={s.theme} onChange={(theme) => updateSettings({ theme })} />
          </div>
        </div>

        <div className="group-title">Foto, orari e posizione dei posti</div>
        <div className="form">
          <Field label="Chiave Google">
            <input type="password" autoComplete="off" spellCheck={false} placeholder="Facoltativa" value={key} onChange={(e) => setKey(e.target.value.trim())}
              onBlur={() => {
                if (key === (s.googleKey ?? '')) return
                updateSettings({ googleKey: key || undefined })
                toast(key ? 'Chiave salvata, cerco foto e orari' : 'Chiave rimossa')
                if (key) (async () => { for (const t of trips) await enrichTrip(t.id) })()
              }} />
          </Field>
        </div>
        <p className="small muted" style={{ margin: '-4px 6px 10px' }}>
          {s.googleKey
            ? 'Con la chiave l\'app prende da Google fino a 6 foto, voto, orari, sito e posizione esatta di ogni posto.'
            : 'Senza chiave l\'app trova solo la posizione dei posti con OpenStreetMap (gratis). Con una chiave Google arrivano anche foto, orari e recensioni.'}
          {' '}<button className="link" onClick={() => setGuide(!guide)}>{guide ? 'Chiudi la guida' : 'Come ottenere la chiave'}</button>
        </p>
        {guide && (
          <ol className="card guide">
            <li>Vai su <a className="link" href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">console.cloud.google.com</a> e accedi con il tuo account Google.</li>
            <li>In alto crea un nuovo progetto e chiamalo, per esempio, “Viaggi”.</li>
            <li>Apri <b>Fatturazione</b> e collega una carta. Google la chiede sempre, ma sotto la soglia gratuita mensile non paghi nulla.</li>
            <li>In <b>API e servizi → Libreria</b> cerca <b>Places API (New)</b> e premi Abilita.</li>
            <li>In <b>API e servizi → Credenziali</b> premi Crea credenziali → Chiave API. Poi in “Limitazioni API” scegli solo Places API (New).</li>
            <li>Per stare tranquillo: in <b>Places API (New) → Quote</b> imposta un limite di 100 richieste al giorno, e in <b>Fatturazione → Budget e avvisi</b> crea un avviso a 1 €.</li>
            <li>Copia la chiave e incollala qui sopra.</li>
          </ol>
        )}
        <div className="list">
          <button className="row" onClick={enrichAll} disabled={progress.running}>
            <span className="ico h-sight">{s.googleKey ? <GoogleLogo size={20} weight="bold" /> : <MapPin size={20} weight="duotone" />}</span>
            <div className="main">
              <div className="t">{progress.running ? `Aggiorno i posti: ${progress.done} di ${progress.total}` : 'Aggiorna tutti i posti'}</div>
              <div className="s">{progress.error ?? (s.googleKey ? 'Foto, orari, voto e posizione da Google' : 'Posizione da OpenStreetMap, circa un posto al secondo')}</div>
            </div>
          </button>
        </div>

        <div className="group-title">Cambi valuta</div>
        <div className="list">
          <button className="row" onClick={async () => { setLoading(true); try { await refreshRates(true); toast('Cambi aggiornati') } catch (e) { toast((e as Error).message) } finally { setLoading(false) } }}>
            <span className="ico h-transport"><ArrowsClockwise size={20} className={loading ? 'spin' : ''} /></span>
            <div className="main"><div className="t">Aggiorna i cambi</div><div className="s">{rates ? `Ultimo aggiornamento ${new Date(rates.date).toLocaleDateString('it-IT')}, ${Object.keys(rates.rates).length} valute` : 'Mai scaricati'}</div></div>
          </button>
        </div>

        <div className="group-title">Backup</div>
        <div className="list">
          <button className="row" onClick={exportBackup}>
            <span className="ico h-flight"><DownloadSimple size={20} /></span>
            <div className="main"><div className="t">Esporta backup</div><div className="s">Un file con viaggi, foto e documenti, da mettere nella cartella condivisa</div></div>
          </button>
          <label className="row" style={{ cursor: 'pointer' }}>
            <span className="ico h-stay"><UploadSimple size={20} /></span>
            <div className="main"><div className="t">Ripristina backup</div><div className="s">Carica un file esportato in precedenza</div></div>
            <input type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = '' }} />
          </label>
        </div>

        <div className="group-title">Dati</div>
        <div className="list">
          <button className="row" style={{ color: 'var(--danger)' }} onClick={async () => { if (await ask('Cancellare tutti i dati?', 'Cancella', 'Viaggi, foto e documenti su questo dispositivo verranno eliminati. Esporta prima un backup.')) wipeAll() }}>
            <span className="ico" style={{ ['--hue' as string]: 'var(--danger)' }}><Trash size={20} /></span>
            <div className="main"><div className="t">Cancella tutti i dati</div></div>
          </button>
        </div>
      </div>
    </main>
  )
}
