import { useEffect, useMemo, useState } from 'react'
import type { TranslationInfo } from '../../../main/bible/bibleStore'
import { bibleSlides, type Passage } from '../../../shared/slides'
import { strings } from '../../shared/strings'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { Button } from '../components/ui/Button'
import { EmptyState, Notice } from '../components/ui/EmptyState'
import { Field, SearchField } from '../components/ui/Field'
import { PanelHeader } from '../components/ui/PanelHeader'
import { SlideCanvas } from '../components/ui/SlideCanvas'
import { useSafe } from '../components/useSafe'
import { useLiveState } from '../hooks'
import './Bible.css'

export function Bible(): JSX.Element {
  const [translations, setTranslations] = useState<TranslationInfo[]>([])
  const [loaded, setLoaded] = useState(false)
  const [translation, setTranslation] = useState('')
  const [ref, setRef] = useState('')
  const [passage, setPassage] = useState<Passage | null>(null)
  const [searched, setSearched] = useState(false)
  const [words, setWords] = useState('')
  const [results, setResults] = useState<{ ref: string; text: string }[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const { error, run } = useSafe()
  const live = useLiveState()

  const loadTranslations = async (selectId?: string): Promise<void> => {
    const res = await run(() => window.sonora.bible.translations())
    if (!res.ok) return
    const list = res.value
    setTranslations(list)
    setLoaded(true)
    setTranslation((cur) => selectId ?? (list.some((t) => t.id === cur) ? cur : (list[0]?.id ?? '')))
  }

  useEffect(() => {
    void loadTranslations()
  }, [])

  // mostra a passagem enquanto digita
  useEffect(() => {
    if (!translation || !ref.trim()) {
      setPassage(null)
      setSearched(false)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await run(() => window.sonora.bible.passage(translation, ref))
      if (!cancelled && res.ok) {
        setPassage(res.value)
        setSearched(true)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translation, ref])

  // busca por palavra
  useEffect(() => {
    if (!translation || words.trim().length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const res = await run(() => window.sonora.bible.search(translation, words, 50))
      if (!cancelled && res.ok) setResults(res.value)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translation, words])

  const importTranslation = async (): Promise<void> => {
    setImporting(true)
    setMessage(null)
    try {
      const info = await window.sonora.bible.importTranslation()
      if (info) {
        await loadTranslations(info.id)
        setMessage({ tone: 'ok', text: strings.bible.imported })
      }
    } catch {
      setMessage({ tone: 'error', text: strings.common.error })
    } finally {
      setImporting(false)
    }
  }

  const slides = useMemo(() => (passage ? bibleSlides(passage) : []), [passage])
  const translationName = translations.find((t) => t.id === translation)?.name ?? ''
  const importButton = (
    <Button variant="primary" icon="upload" disabled={importing} onClick={importTranslation}>
      {importing ? strings.bible.importing : strings.bible.importTranslation}
    </Button>
  )
  const noTranslations = loaded && translations.length === 0

  return (
    <section className="split bible">
      <aside className="split__list">
        <PanelHeader
          level={1}
          title={strings.bible.title}
          meta={translationName || undefined}
          actions={
            noTranslations ? undefined : (
              <Button variant="ghost" icon="upload" iconOnly disabled={importing} onClick={importTranslation}>
                {importing ? strings.bible.importing : strings.bible.importTranslation}
              </Button>
            )
          }
        />
        <div className="split__tools">
          <Field label={strings.bible.translation}>
            <select className="input" value={translation} disabled={noTranslations} onChange={(e) => setTranslation(e.target.value)}>
              {translations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={strings.bible.reference}>
            <input
              className="input bible__ref"
              value={ref}
              disabled={noTranslations}
              placeholder={strings.bible.referencePlaceholder}
              onChange={(e) => setRef(e.target.value)}
            />
          </Field>
          <Field label={strings.bible.wordSearch}>
            <SearchField value={words} onChange={setWords} placeholder={strings.bible.wordSearchPlaceholder} label={strings.bible.wordSearch} />
          </Field>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          {error && <Notice tone="error">{strings.common.error}</Notice>}
        </div>
        <div className="split__scroll">
          {results && (
            <>
              <p className="group-label">{strings.bible.resultsTitle}</p>
              {results.length === 0 && <p className="bible__noresults hint">{strings.bible.noResults}</p>}
              <ul className="rows">
                {results.map((r) => (
                  <li key={r.ref}>
                    <button type="button" className={r.ref === ref ? 'row row--active' : 'row'} onClick={() => setRef(r.ref)}>
                      <span className="row__text">
                        <span className="row__title">{r.ref}</span>
                        <span className="bible__snippet">{r.text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </aside>

      <div className="split__detail">
        {noTranslations ? (
          <div className="detail__empty">
            <EmptyState
              icon="book"
              title={strings.bible.noTranslationsTitle}
              text={strings.bible.noTranslationsHint}
              action={importButton}
            />
          </div>
        ) : passage ? (
          <>
            <PanelHeader
              title={passage.title}
              meta={`${translationName} · ${strings.bible.verseCount(passage.verses.length)}`}
              actions={<AddToServiceButton data={{ kind: 'bible', ref: passage.title, translation }} />}
            />
            <div className="detail__scroll">
              <div className="detail__body">
                <article className="passage">
                  {passage.verses.map((v) => (
                    <p key={v.n}>
                      <sup className="tnum">{v.n}</sup>
                      {v.text}
                    </p>
                  ))}
                </article>
                {live && slides.length > 0 && (
                  <div>
                    <h3 className="section-title">{strings.bible.previewSection}</h3>
                    <ul className="preview-grid">
                      {slides.map((s, i) => (
                        <li key={i} className="preview-grid__item">
                          <SlideCanvas slide={s} background={live.background} style={live.style} />
                          <span className="preview-grid__caption">
                            <strong>{s.title}</strong>
                            <span className="tnum">
                              {i + 1}/{slides.length}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="detail__empty">
            {searched ? (
              <EmptyState icon="search" title={strings.bible.notFound} text={strings.bible.notFoundHint} />
            ) : (
              <EmptyState icon="book" title={strings.bible.pickTitle} text={strings.bible.pickHint} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
