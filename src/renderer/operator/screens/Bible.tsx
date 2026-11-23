import { useEffect, useState } from 'react'
import type { TranslationInfo } from '../../../main/bible/bibleStore'
import type { Passage } from '../../../shared/slides'
import { strings } from '../../shared/strings'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { SearchBox } from '../components/SearchBox'

export function Bible(): JSX.Element {
  const [translations, setTranslations] = useState<TranslationInfo[]>([])
  const [translation, setTranslation] = useState('')
  const [ref, setRef] = useState('')
  const [passage, setPassage] = useState<Passage | null>(null)
  const [searched, setSearched] = useState(false)
  const [words, setWords] = useState('')
  const [results, setResults] = useState<{ ref: string; text: string }[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const loadTranslations = async (selectId?: string): Promise<void> => {
    const list = await window.sonora.bible.translations()
    setTranslations(list)
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
      const p = await window.sonora.bible.passage(translation, ref)
      if (!cancelled) {
        setPassage(p)
        setSearched(true)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [translation, ref])

  // busca por palavra
  useEffect(() => {
    if (!translation || words.trim().length < 2) {
      setResults(null)
      return
    }
    let cancelled = false
    const t = setTimeout(async () => {
      const r = await window.sonora.bible.search(translation, words, 50)
      if (!cancelled) setResults(r)
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [translation, words])

  const importTranslation = async (): Promise<void> => {
    setImporting(true)
    setMessage(null)
    try {
      const info = await window.sonora.bible.importTranslation()
      if (info) {
        await loadTranslations(info.id)
        setMessage(strings.bible.imported)
      }
    } catch {
      setMessage(strings.common.error)
    } finally {
      setImporting(false)
    }
  }

  return (
    <section className="screen">
      <h1 className="screen__title">{strings.bible.title}</h1>
      <div className="toolbar">
        <label className="form__row">
          <span>{strings.bible.translation}</span>
          <select className="field" value={translation} onChange={(e) => setTranslation(e.target.value)}>
            {translations.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn" disabled={importing} onClick={importTranslation}>
          {importing ? strings.bible.importing : strings.bible.importTranslation}
        </button>
        {message && <span className="hint">{message}</span>}
      </div>
      {translations.length === 0 && <p className="hint">{strings.bible.noTranslations}</p>}

      <div className="bible-grid">
        <div className="bible-col">
          <label className="form__row">
            <span>{strings.bible.reference}</span>
            <input className="field" value={ref} placeholder={strings.bible.referencePlaceholder} onChange={(e) => setRef(e.target.value)} />
          </label>
          {passage && (
            <article className="passage">
              <h2>{passage.title}</h2>
              {passage.verses.map((v) => (
                <p key={v.n}>
                  <sup>{v.n}</sup> {v.text}
                </p>
              ))}
              <AddToServiceButton data={{ kind: 'bible', ref: passage.title, translation }} />
            </article>
          )}
          {!passage && searched && <p className="hint">{strings.bible.notFound}</p>}
        </div>

        <div className="bible-col">
          <label className="form__row">
            <span>{strings.bible.wordSearch}</span>
            <SearchBox value={words} onChange={setWords} placeholder={strings.bible.wordSearchPlaceholder} label={strings.bible.wordSearch} />
          </label>
          {results && results.length === 0 && <p className="hint">{strings.bible.noResults}</p>}
          <ul className="list">
            {results?.map((r) => (
              <li key={r.ref}>
                <button type="button" className="list__item" onClick={() => setRef(r.ref)}>
                  <strong>{r.ref}</strong>
                  <small>{r.text}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
