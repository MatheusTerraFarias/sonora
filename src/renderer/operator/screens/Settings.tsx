import { useCallback, useEffect, useRef, useState } from 'react'
import type { Background, MediaItem, Settings as SettingsData, TextStyle } from '../../../shared/types'
import type { DisplayInfo } from '../../../shared/displays'
import type { TranslationInfo } from '../../../main/bible/bibleStore'
import { strings } from '../../shared/strings'
import { MediaThumb } from '../components/MediaThumb'
import { Button } from '../components/ui/Button'
import { Notice } from '../components/ui/EmptyState'
import { Field, Toggle } from '../components/ui/Field'
import { PanelHeader } from '../components/ui/PanelHeader'
import { SlideCanvas } from '../components/ui/SlideCanvas'
import { useSafe } from '../components/useSafe'
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

type SectionId = 'church' | 'telao' | 'appearance' | 'audio' | 'youtube' | 'backup' | 'about'

function Section({ id, title, help, children }: { id: SectionId; title: string; help?: string; children: React.ReactNode }): JSX.Element {
  return (
    <section id={`settings-${id}`} data-section={id} className="settings-section" aria-labelledby={`settings-${id}-title`}>
      <header className="settings-section__head">
        <h2 id={`settings-${id}-title`} className="settings-section__title">
          {title}
        </h2>
        {help && <p className="settings-section__help">{help}</p>}
      </header>
      <div className="settings-section__body">{children}</div>
    </section>
  )
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<SectionId>('church')

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

  // índice lateral: acompanha a seção visível
  useEffect(() => {
    const root = scrollRef.current
    if (!root || !settings) return
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        const id = top?.target.getAttribute('data-section') as SectionId | null
        if (id) setActive(id)
      },
      { root, rootMargin: '0px 0px -65% 0px' }
    )
    root.querySelectorAll('[data-section]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [settings])

  if (!settings || !background || !style) {
    return (
      <section className="workspace settings">
        <PanelHeader level={1} title={S.title} />
        <div className="detail__empty">
          {error ? <Notice tone="error">{strings.common.error}</Notice> : <p className="hint">{strings.common.loading}</p>}
        </div>
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
    // o IPC perde a classe do erro: o main marca backups inválidos com um prefixo reconhecível
    if (!r.ok) setMessage(r.message.includes('INVALID_BACKUP:') ? S.restoreInvalid : S.restoreFailed)
    setBusy(null)
  }

  const num = (v: string): number => (v.trim() === '' ? NaN : Number(v))

  const index: { id: SectionId; label: string }[] = [
    { id: 'church', label: S.churchSection },
    { id: 'telao', label: S.telaoSection },
    { id: 'appearance', label: S.appearanceSection },
    { id: 'audio', label: S.audioSection },
    ...(adblockAvailable ? [{ id: 'youtube' as const, label: S.youtubeSection }] : []),
    { id: 'backup', label: S.backupSection },
    { id: 'about', label: S.aboutSection }
  ]
  const jump = (id: SectionId): void => {
    setActive(id)
    // rola só a coluna das seções (scrollIntoView rolaria também a moldura do app)
    const root = scrollRef.current
    const el = root?.querySelector<HTMLElement>(`#settings-${id}`)
    if (root && el) root.scrollTo({ top: el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop })
  }
  const isError = message === S.restoreInvalid || message === S.restoreFailed
  // tamanhos inválidos ainda não salvos: a prévia usa os salvos
  const previewStyle = validateStyle(style) ? { ...style, minFontPx: settings.style.minFontPx, maxFontPx: settings.style.maxFontPx } : style

  return (
    <section className="workspace settings">
      <PanelHeader
        level={1}
        title={S.title}
        actions={
          error || message ? (
            <>
              {error && <Notice tone="error">{strings.common.error}</Notice>}
              {message && <Notice tone={isError ? 'error' : 'ok'}>{message}</Notice>}
            </>
          ) : undefined
        }
      />
      <div className="settings__layout">
        <nav className="settings__index" aria-label={S.indexLabel}>
          <ul>
            {index.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  className={it.id === active ? 'settings__index-item settings__index-item--active' : 'settings__index-item'}
                  aria-current={it.id === active ? 'true' : undefined}
                  onClick={() => jump(it.id)}
                >
                  {it.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="settings__scroll" ref={scrollRef}>
          <div className="settings__sections">
            <Section id="church" title={S.churchSection} help={S.churchHelp}>
              <Field inline label={S.churchName}>
                <input className="input" value={churchName} onChange={(e) => setChurchName(e.target.value)} />
              </Field>
              <Field inline label={S.logo} hint={S.logoHelp}>
                <select className="input" value={settings.logoMediaId ?? ''} onChange={(e) => void update({ logoMediaId: e.target.value || null })}>
                  <option value="">{S.noLogo}</option>
                  {images.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.originalName}
                    </option>
                  ))}
                </select>
              </Field>
              {logo && (
                <div className="settings__offset settings__logo">
                  <MediaThumb media={logo} />
                </div>
              )}
              <div className="settings__offset">
                <Button variant="primary" onClick={saveChurch}>
                  {strings.common.save}
                </Button>
              </div>
            </Section>

            <Section id="telao" title={S.telaoSection} help={S.telaoHelp}>
              <Field inline label={S.displaySection} hint={S.displayHelp}>
                <span className="settings__control-row">
                  <select
                    className="input"
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
                  <Button icon="monitor" disabled={identifying} onClick={identify}>
                    {identifying ? S.identifying : S.identify}
                  </Button>
                </span>
              </Field>
            </Section>

            <Section id="appearance" title={S.appearanceSection} help={S.appearanceHelp}>
              <div className="settings__appearance">
                <div className="settings__appearance-fields">
                  <div className="settings__pair">
                    <Field label={S.bgType}>
                      <select
                        className="input"
                        value={background.type}
                        onChange={(e) => setBackground({ ...background, type: e.target.value as Background['type'], mediaId: null })}
                      >
                        <option value="color">{S.bgColor}</option>
                        <option value="image">{S.bgImage}</option>
                        <option value="video">{S.bgVideo}</option>
                      </select>
                    </Field>
                    {background.type === 'color' ? (
                      <Field label={S.bgColor}>
                        <input className="input" type="color" value={background.color} onChange={(e) => setBackground({ ...background, color: e.target.value })} />
                      </Field>
                    ) : (
                      <Field label={S.bgMedia}>
                        <select className="input" value={background.mediaId ?? ''} onChange={(e) => setBackground({ ...background, mediaId: e.target.value || null })}>
                          <option value="">{S.bgNoMedia}</option>
                          {bgOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.originalName}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                  </div>
                  <div className="settings__pair">
                    <Field label={S.maxFont}>
                      <input
                        className="input tnum"
                        type="number"
                        min={FONT_MIN}
                        max={FONT_MAX}
                        value={Number.isNaN(style.maxFontPx) ? '' : style.maxFontPx}
                        onChange={(e) => setStyle({ ...style, maxFontPx: num(e.target.value) })}
                      />
                    </Field>
                    <Field label={S.minFont}>
                      <input
                        className="input tnum"
                        type="number"
                        min={FONT_MIN}
                        max={FONT_MAX}
                        value={Number.isNaN(style.minFontPx) ? '' : style.minFontPx}
                        onChange={(e) => setStyle({ ...style, minFontPx: num(e.target.value) })}
                      />
                    </Field>
                  </div>
                  <div className="settings__pair">
                    <Field label={S.textColor}>
                      <input className="input" type="color" value={style.color} onChange={(e) => setStyle({ ...style, color: e.target.value })} />
                    </Field>
                    <Field label={S.align}>
                      <select className="input" value={style.align} onChange={(e) => setStyle({ ...style, align: e.target.value as TextStyle['align'] })}>
                        <option value="left">{S.alignLeft}</option>
                        <option value="center">{S.alignCenter}</option>
                        <option value="right">{S.alignRight}</option>
                      </select>
                    </Field>
                  </div>
                  <Toggle label={S.shadow} checked={style.shadow} onChange={(v) => setStyle({ ...style, shadow: v })} />
                  {styleError && <Notice tone="error">{styleError}</Notice>}
                  <div>
                    <Button variant="primary" onClick={saveStyle}>
                      {strings.common.save}
                    </Button>
                  </div>
                </div>
                <figure className="settings__preview">
                  <SlideCanvas slide={{ label: '', text: S.previewSample }} background={background} style={previewStyle} />
                  <figcaption className="hint">{S.previewLabel}</figcaption>
                </figure>
              </div>
            </Section>

            <Section id="audio" title={S.audioSection} help={S.audioHelpSection}>
              <Field inline label={S.audioDevice} hint={S.audioHelp}>
                <select className="input" value={settings.audioOutputDeviceId ?? ''} onChange={(e) => void update({ audioOutputDeviceId: e.target.value || null })}>
                  <option value="">{S.audioDefault}</option>
                  {audioDevices
                    .filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')
                    .map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || S.audioUnnamed}
                      </option>
                    ))}
                </select>
              </Field>
            </Section>

            {adblockAvailable && (
              <Section id="youtube" title={S.youtubeSection} help={S.adblockSection}>
                <Toggle label={S.adblock} hint={S.adblockWarning} checked={settings.adblockEnabled} onChange={(v) => void update({ adblockEnabled: v })} />
              </Section>
            )}

            <Section id="backup" title={S.backupSection} help={S.backupHelpSection}>
              <p className="settings__text">{S.backupHelp}</p>
              <div className="inline-actions">
                <Button icon="download" disabled={busy !== null} onClick={exportBackup}>
                  {busy === 'export' ? S.exporting : S.export}
                </Button>
                <Button variant="danger" icon="restore" disabled={busy !== null} onClick={restoreBackup}>
                  {S.restore}
                </Button>
              </div>
            </Section>

            <Section id="about" title={S.aboutSection} help={S.aboutHelp}>
              <dl className="settings__facts">
                <dt>{S.version}</dt>
                <dd className="tnum">
                  {strings.app.name} {version}
                </dd>
              </dl>
              <Toggle label={S.updates} hint={S.updatesHelp} checked={settings.updatesEnabled} onChange={(v) => void update({ updatesEnabled: v })} />
              <div>
                <h3 className="section-title">{S.bibleLicenses}</h3>
                {translations.length === 0 && <p className="hint">{S.noTranslations}</p>}
                <ul className="settings__licenses">
                  {translations.map((t) => (
                    <li key={t.id}>
                      <strong>{t.name}</strong>
                      <span className="hint">{t.license}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </section>
  )
}
