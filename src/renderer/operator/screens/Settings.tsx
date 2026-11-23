import { useCallback, useEffect, useState } from 'react'
import type { Background, MediaItem, Settings as SettingsData, TextStyle } from '../../../shared/types'
import type { DisplayInfo } from '../../../shared/displays'
import type { TranslationInfo } from '../../../main/bible/bibleStore'
import { strings } from '../../shared/strings'
import { MediaThumb } from '../components/MediaThumb'
import { ErrorBanner, useSafe } from '../components/useSafe'
import './Settings.css'

const S = strings.settings
const FONT_MIN = 12
const FONT_MAX = 400

/** valida tamanhos de fonte; devolve a mensagem de erro ou null */
export function validateStyle(style: Pick<TextStyle, 'maxFontPx' | 'minFontPx'>): string | null {
  const { maxFontPx: max, minFontPx: min } = style
  const ok = (n: number): boolean => Number.isFinite(n) && n >= FONT_MIN && n <= FONT_MAX
  if (!ok(max) || !ok(min)) return S.fontRange(FONT_MIN, FONT_MAX)
  if (min > max) return S.fontOrder
  return null
}

export function Settings(): JSX.Element {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [churchName, setChurchName] = useState('')
  const [background, setBackground] = useState<Background | null>(null)
  const [style, setStyle] = useState<TextStyle | null>(null)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [translations, setTranslations] = useState<TranslationInfo[]>([])
  const [version, setVersion] = useState('')
  const [identifying, setIdentifying] = useState(false)
  const [busy, setBusy] = useState<'export' | 'restore' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [styleError, setStyleError] = useState<string | null>(null)
  const { error, run } = useSafe()
  const adblockAvailable = window.sonora.youtube.adblockAvailable()

  const apply = useCallback((s: SettingsData): void => {
    setSettings(s)
    setChurchName(s.churchName)
    setBackground(s.background)
    setStyle(s.style)
  }, [])

  useEffect(() => {
    void (async () => {
      const [s, m, d, t, v] = await Promise.all([
        run(() => window.sonora.settings.get()),
        run(() => window.sonora.media.list()),
        run(() => window.sonora.displays.list()),
        run(() => window.sonora.bible.translations()),
        run(() => window.sonora.app.version())
      ])
      if (s.ok) apply(s.value)
      if (m.ok) setMedia(m.value)
      if (d.ok) setDisplays(d.value)
      if (t.ok) setTranslations(t.value)
      if (v.ok) setVersion(String(v.value))
      const devices = await run(() => navigator.mediaDevices.enumerateDevices())
      if (devices.ok) setAudioDevices(devices.value.filter((x) => x.kind === 'audiooutput'))
    })()
    return window.sonora.displays.onChange(setDisplays)
  }, [run, apply])

  const update = async (patch: Partial<SettingsData>): Promise<boolean> => {
    setMessage(null)
    const r = await run(() => window.sonora.settings.update(patch))
    if (r.ok) setSettings(r.value)
    return r.ok
  }

  if (!settings || !background || !style) {
    return (
      <section className="screen">
        <h1 className="screen__title">{S.title}</h1>
        <ErrorBanner show={error} />
        {!error && <p className="hint">{strings.common.loading}</p>}
      </section>
    )
  }

  const images = media.filter((m) => m.kind === 'image')
  const bgKind = background.type === 'video' ? 'video' : 'image'
  const bgOptions = media.filter((m) => m.kind === bgKind)
  const logo = images.find((m) => m.id === settings.logoMediaId) ?? null

  const saveChurch = async (): Promise<void> => {
    if (await update({ churchName: churchName.trim() })) setMessage(strings.common.saved)
  }

  const saveStyle = async (): Promise<void> => {
    const bad = validateStyle(style) ?? (background.type !== 'color' && !background.mediaId ? S.bgMediaRequired : null)
    setStyleError(bad)
    if (bad) return
    if (await update({ background, style })) setMessage(strings.common.saved)
  }

  const identify = async (): Promise<void> => {
    setIdentifying(true)
    await run(() => window.sonora.displays.identify())
    setTimeout(() => setIdentifying(false), 3000)
  }

  const exportBackup = async (): Promise<void> => {
    setBusy('export')
    setMessage(null)
    const r = await run(() => window.sonora.backup.export())
    if (r.ok && r.value) setMessage(S.exported)
    setBusy(null)
  }

  const restoreBackup = async (): Promise<void> => {
    setBusy('restore')
    setMessage(null)
    const r = await run(() => window.sonora.backup.restore())
    // o main rejeita (InvalidBackupError) sem tocar nos dados; o aviso explica o motivo provável
    if (!r.ok) setMessage(S.restoreInvalid)
    setBusy(null)
  }

  const num = (v: string): number => (v.trim() === '' ? NaN : Number(v))

  return (
    <section className="screen settings">
      <h1 className="screen__title">{S.title}</h1>
      <ErrorBanner show={error} />
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}

      <fieldset className="settings__group">
        <legend>{S.churchSection}</legend>
        <label className="settings__row">
          <span>{S.churchName}</span>
          <input className="field" value={churchName} onChange={(e) => setChurchName(e.target.value)} />
        </label>
        <label className="settings__row">
          <span>{S.logo}</span>
          <select
            className="field"
            value={settings.logoMediaId ?? ''}
            onChange={(e) => void update({ logoMediaId: e.target.value || null })}
          >
            <option value="">{S.noLogo}</option>
            {images.map((m) => (
              <option key={m.id} value={m.id}>
                {m.originalName}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{S.logoHelp}</p>
        {logo && <MediaThumb media={logo} />}
        <div>
          <button type="button" className="btn btn--primary" onClick={saveChurch}>
            {strings.common.save}
          </button>
        </div>
      </fieldset>

      <fieldset className="settings__group">
        <legend>{S.displaySection}</legend>
        <div className="toolbar">
          <select
            className="field"
            aria-label={S.displaySection}
            value={settings.projectionDisplayId ?? ''}
            onChange={(e) => void update({ projectionDisplayId: e.target.value === '' ? null : Number(e.target.value) })}
          >
            <option value="">{S.displayAuto}</option>
            {displays.map((d) => (
              <option key={d.id} value={d.id} disabled={d.isOperator}>
                {d.label}
                {d.primary ? ` · ${S.displayPrimary}` : ''}
                {d.isOperator ? ` · ${S.displayOperator}` : ''}
              </option>
            ))}
          </select>
          <button type="button" className="btn" disabled={identifying} onClick={identify}>
            {identifying ? S.identifying : S.identify}
          </button>
        </div>
        <p className="hint">{S.displayHelp}</p>
      </fieldset>

      <fieldset className="settings__group">
        <legend>{S.styleSection}</legend>
        <label className="settings__row">
          <span>{S.bgType}</span>
          <select
            className="field"
            value={background.type}
            onChange={(e) => setBackground({ ...background, type: e.target.value as Background['type'], mediaId: null })}
          >
            <option value="color">{S.bgColor}</option>
            <option value="image">{S.bgImage}</option>
            <option value="video">{S.bgVideo}</option>
          </select>
        </label>
        {background.type === 'color' ? (
          <label className="settings__row">
            <span>{S.bgColor}</span>
            <input
              type="color"
              value={background.color}
              onChange={(e) => setBackground({ ...background, color: e.target.value })}
            />
          </label>
        ) : (
          <label className="settings__row">
            <span>{S.bgMedia}</span>
            <select
              className="field"
              value={background.mediaId ?? ''}
              onChange={(e) => setBackground({ ...background, mediaId: e.target.value || null })}
            >
              <option value="">{S.bgNoMedia}</option>
              {bgOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.originalName}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="settings__row">
          <span>{S.maxFont}</span>
          <input
            className="field"
            type="number"
            min={FONT_MIN}
            max={FONT_MAX}
            value={Number.isNaN(style.maxFontPx) ? '' : style.maxFontPx}
            onChange={(e) => setStyle({ ...style, maxFontPx: num(e.target.value) })}
          />
        </label>
        <label className="settings__row">
          <span>{S.minFont}</span>
          <input
            className="field"
            type="number"
            min={FONT_MIN}
            max={FONT_MAX}
            value={Number.isNaN(style.minFontPx) ? '' : style.minFontPx}
            onChange={(e) => setStyle({ ...style, minFontPx: num(e.target.value) })}
          />
        </label>
        <label className="settings__row">
          <span>{S.textColor}</span>
          <input type="color" value={style.color} onChange={(e) => setStyle({ ...style, color: e.target.value })} />
        </label>
        <label className="settings__row settings__row--check">
          <input type="checkbox" checked={style.shadow} onChange={(e) => setStyle({ ...style, shadow: e.target.checked })} />
          <span>{S.shadow}</span>
        </label>
        <label className="settings__row">
          <span>{S.align}</span>
          <select
            className="field"
            value={style.align}
            onChange={(e) => setStyle({ ...style, align: e.target.value as TextStyle['align'] })}
          >
            <option value="left">{S.alignLeft}</option>
            <option value="center">{S.alignCenter}</option>
            <option value="right">{S.alignRight}</option>
          </select>
        </label>
        {styleError && (
          <p className="hint hint--error" role="alert">
            {styleError}
          </p>
        )}
        <div>
          <button type="button" className="btn btn--primary" onClick={saveStyle}>
            {strings.common.save}
          </button>
        </div>
      </fieldset>

      <fieldset className="settings__group">
        <legend>{S.audioSection}</legend>
        <select
          className="field"
          aria-label={S.audioSection}
          value={settings.audioOutputDeviceId ?? ''}
          onChange={(e) => void update({ audioOutputDeviceId: e.target.value || null })}
        >
          <option value="">{S.audioDefault}</option>
          {audioDevices
            .filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')
            .map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || S.audioUnnamed}
              </option>
            ))}
        </select>
        <p className="hint">{S.audioHelp}</p>
      </fieldset>

      {adblockAvailable && (
        <fieldset className="settings__group">
          <legend>{S.adblockSection}</legend>
          <label className="settings__row settings__row--check">
            <input
              type="checkbox"
              checked={settings.adblockEnabled}
              onChange={(e) => void update({ adblockEnabled: e.target.checked })}
            />
            <span>{S.adblock}</span>
          </label>
          <p className="hint">{S.adblockWarning}</p>
        </fieldset>
      )}

      <fieldset className="settings__group">
        <legend>{S.backupSection}</legend>
        <p className="hint">{S.backupHelp}</p>
        <div className="toolbar">
          <button type="button" className="btn" disabled={busy !== null} onClick={exportBackup}>
            {busy === 'export' ? S.exporting : S.export}
          </button>
          <button type="button" className="btn btn--danger" disabled={busy !== null} onClick={restoreBackup}>
            {S.restore}
          </button>
        </div>
      </fieldset>

      <fieldset className="settings__group">
        <legend>{S.aboutSection}</legend>
        <p>
          {strings.app.name} · {S.version} {version}
        </p>
        <h2 className="settings__sub">{S.bibleLicenses}</h2>
        {translations.length === 0 && <p className="hint">{S.noTranslations}</p>}
        <ul className="settings__licenses">
          {translations.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong>
              <span className="hint">{t.license}</span>
            </li>
          ))}
        </ul>
      </fieldset>
    </section>
  )
}
