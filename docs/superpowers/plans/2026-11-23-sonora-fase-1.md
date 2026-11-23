# Sonora Fase 1 (Projeção): Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Programa Electron para Windows que opera o telão da igreja (músicas, Bíblia, mídias, avisos, YouTube) a partir de uma ordem de culto, funcionando offline.

**Architecture:** O processo principal (main) guarda tudo: SQLite, arquivos de mídia, janelas, estado ao vivo e o bloqueador. Duas janelas React: **operador** (trabalho) e **telão** (só renderiza o `LiveState` recebido por IPC). Lógica pura (parser de letra, referências bíblicas, navegação, ajuste de texto, escolha de monitor) fica em `src/shared` ou módulos sem Electron, testados com Vitest.

**Tech Stack:** Electron + electron-vite + React 18 + TypeScript; better-sqlite3; zustand; @dnd-kit/sortable; @ghostery/adblocker-electron; electron-builder (NSIS) + electron-updater; adm-zip; Vitest; Playwright (`_electron`) para o teste de fumaça.

**Spec:** `docs/superpowers/specs/2026-11-23-sonora-design.md`

## Global Constraints

- Windows 10/11; a escolha técnica não pode impedir um build futuro para Mac (nada de API exclusiva do Windows fora de `electron-builder`).
- Tudo funciona **sem internet**, exceto o YouTube.
- Interface em pt-BR, com **todos os textos visíveis em `src/renderer/shared/strings.ts`** (nenhuma string de UI solta em componente).
- Nada da igreja do autor fixo no código: nome, logo, monitor e estilos vêm de `settings`.
- Todo registro tem `id` UUID (`crypto.randomUUID()`), `created_at` e `updated_at` (ISO 8601).
- Cores: Navy `#09124F`, Royal `#16266D`, Blue `#4169E1`, Cloud `#F5F7FC`, Mint `#19B99A` (estados "ao vivo" e "conectado"). Fonte Sora de `brand/fontes/`. Operador em tema escuro.
- A janela do telão **nunca** aparece no monitor do operador e nunca tem controles.
- No máximo duas janelas renderizando (operador e telão). A prévia do operador é uma miniatura leve, nunca uma segunda cópia do vídeo.
- Bloqueador de anúncios: **desligado por padrão** e excluído do build quando `SONORA_ADBLOCK=0`.
- Vídeos do YouTube nunca são baixados.
- Mídias importadas são copiadas para `<userData>/media/`.

## Review Focus

1. **Projetor desconectado no meio do culto ou ausente ao abrir:** o telão some e não aparece na tela do operador; volta sozinho quando o monitor reconecta (teste na Task 9).
2. **Slide grande demais** (estrofe longa, passagem bíblica comprida): o texto encolhe até o tamanho mínimo e, na Bíblia, a passagem é quebrada em mais slides; nunca é cortado (testes nas Tasks 4 e 10).
3. **Sem internet na hora do culto:** os itens do YouTube aparecem como indisponíveis, são pulados na navegação e os demais funcionam sem travar (teste na Task 13).
4. **Música ou mídia apagada que estava numa ordem de culto:** o item aparece como "Item removido" e é pulado na navegação; nada quebra (testes nas Tasks 6 e 8).
5. **Letra colada de qualquer lugar** (quebras CRLF, espaços sobrando, várias linhas em branco seguidas, marcador em minúsculas ou com `:`): o parser normaliza (teste na Task 3).

---

## Estrutura de arquivos

```
src/
  shared/                 # sem Electron, testável
    types.ts              # Song, SongPart, MediaItem, Service, ServiceItem, Slide, LiveState, Settings...
    lyrics.ts             # parseLyrics, serializeLyrics
    bibleRef.ts           # parseReference, BOOKS
    slides.ts             # buildSlides(item, deps)
    navigation.ts         # nextPosition, prevPosition
    fitText.ts            # fitFontSize
    displays.ts           # pickProjectionDisplay
  main/
    index.ts              # bootstrap, janelas, protocolo, ipc
    db/database.ts        # openDatabase + migrações
    db/migrations.ts
    repos/songs.ts  repos/media.ts  repos/services.ts  repos/favorites.ts  repos/settings.ts
    bible/bibleStore.ts   # carrega e busca a Bíblia
    media/protocol.ts     # sonora-media://
    live/liveController.ts
    windows/operatorWindow.ts  windows/projectionWindow.ts
    youtube/session.ts  youtube/adblock.ts
    backup.ts  updater.ts
    ipc.ts                # handle(channel, fn) tipado
  preload/index.ts        # window.sonora (API tipada)
  renderer/
    shared/strings.ts  shared/theme.css  shared/api.ts
    operator/ (main.tsx, App.tsx, screens/..., components/...)
    telao/    (main.tsx, Telao.tsx, YouTubePlayer.tsx)
resources/bible/          # tradução incluída + LICENSE
tests/                    # espelha src/
e2e/smoke.spec.ts
```

---

### Task 1: Projeto base e banco de dados

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig*.json`, `vitest.config.ts`, `electron-builder.yml`, `.gitignore`
- Create: `src/main/index.ts`, `src/main/ipc.ts`, `src/main/db/database.ts`, `src/main/db/migrations.ts`, `src/preload/index.ts`
- Create: `src/renderer/operator/{index.html,main.tsx,App.tsx}`, `src/renderer/telao/{index.html,main.tsx,Telao.tsx}`, `src/renderer/shared/{theme.css,strings.ts}`
- Create: `scripts/build-icons.mjs` (gera `build/icon.ico` e `build/icon.png` de `brand/logo/icone-app.svg` com `@resvg/resvg-js` + `png-to-ico`)
- Test: `tests/main/db/database.test.ts`

**Interfaces:**
- Produces: `openDatabase(file: string): Database` (better-sqlite3, `journal_mode=WAL`, `foreign_keys=ON`, aplica migrações pendentes registradas em `schema_version`).
- Produces: `handle<T extends (...a: any[]) => any>(channel: string, fn: T): void` em `src/main/ipc.ts` e, no preload, `window.sonora` montado com `ipcRenderer.invoke`. Cada task seguinte adiciona um grupo (`songs`, `bible`, `media`, `services`, `favorites`, `settings`, `live`, `displays`, `backup`).
- Produces: tabelas `songs(id, title, artist, song_key, tags TEXT json, arrangement TEXT json, attachment TEXT json NULL, search_text, created_at, updated_at)`, `song_parts(id, song_id FK cascade, label, slides TEXT json, position)`, `media(id, kind, original_name, file_name, mime, created_at, updated_at)`, `services(id, name, date, created_at, updated_at)`, `service_items(id, service_id FK cascade, position, kind, ref_id NULL, data TEXT json, created_at, updated_at)`, `youtube_favorites(id, video_id UNIQUE, title, channel, thumbnail, created_at, updated_at)`, `settings(key PRIMARY KEY, value TEXT json)`.

Os testes rodam no Node do Electron para o better-sqlite3 usar o mesmo ABI do app: script `"test": "cross-env ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run"` e `"postinstall": "electron-builder install-app-deps"`.

- [ ] **Step 1: Criar o projeto com electron-vite (template react-ts), com duas entradas de renderer (`operator`, `telao`) e instalar as dependências do Tech Stack.**
- [ ] **Step 2: Escrever o teste que falha**

```ts
test('openDatabase cria todas as tabelas e é idempotente', () => {
  const file = tmpFile('sonora.db');
  openDatabase(file).close();
  const db = openDatabase(file); // segunda vez não reaplica
  const tables = db.prepare("select name from sqlite_master where type='table'").all().map(r => r.name);
  expect(tables).toEqual(expect.arrayContaining(['songs','song_parts','media','services','service_items','youtube_favorites','settings','schema_version']));
  expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
});
```

- [ ] **Step 3:** `npm test -- tests/main/db` → FAIL (`openDatabase` não existe).
- [ ] **Step 4: Implementar `openDatabase` e `migrations.ts` (array de `{version, sql}`).**
- [ ] **Step 5:** `npm test -- tests/main/db` → PASS.
- [ ] **Step 6: `npm run dev` abre a janela do operador em tema escuro com o logo e a fonte Sora** (`@font-face` apontando para a cópia de `Sora-Variable.ttf` em `src/renderer/shared/fonts/`). Rodar `node scripts/build-icons.mjs` e conferir `build/icon.ico`.
- [ ] **Step 7: Commit** `feat: projeto Electron base com banco SQLite`

---

### Task 2: Tipos compartilhados

**Files:** Create `src/shared/types.ts`. Sem teste próprio (verificado por `tsc` e pelas tasks seguintes).

**Interfaces (Produces, usadas por todas as tasks):**

```ts
type ID = string;
interface SongPart { id: ID; label: string; slides: string[] }
type SongAttachment = { kind: 'youtube'; videoId: string; title: string } | { kind: 'media'; mediaId: ID } | null;
interface Song { id: ID; title: string; artist: string; key: string | null; tags: string[];
  parts: SongPart[]; arrangement: ID[]; attachment: SongAttachment; createdAt: string; updatedAt: string }
type MediaKind = 'image' | 'video' | 'audio';
interface MediaItem { id: ID; kind: MediaKind; originalName: string; fileName: string; mime: string }
type ServiceItemData =
  | { kind: 'song'; songId: ID }
  | { kind: 'bible'; ref: string; translation: string }
  | { kind: 'media'; mediaId: ID }
  | { kind: 'youtube'; videoId: string; title: string; thumbnail: string }
  | { kind: 'notice'; title: string; body: string; backgroundMediaId: ID | null };
interface ServiceItem { id: ID; serviceId: ID; position: number; data: ServiceItemData }
interface Service { id: ID; name: string; date: string; items: ServiceItem[] }
interface Slide { label: string; text: string; title?: string }   // title = rodapé (ex.: "João 3:16")
type LiveContent =
  | { type: 'slide'; slide: Slide }
  | { type: 'media'; media: MediaItem; playing: boolean; volume: number; position: number }
  | { type: 'youtube'; videoId: string; playing: boolean; volume: number; position: number }
  | { type: 'none' };
type Overlay = 'none' | 'clear' | 'black' | 'logo';   // clear = esconde texto, mantém fundo
interface Background { type: 'color' | 'image' | 'video'; color: string; mediaId: ID | null }
interface TextStyle { fontFamily: string; maxFontPx: number; minFontPx: number; color: string;
  shadow: boolean; align: 'left' | 'center' | 'right' }
interface LiveState { content: LiveContent; overlay: Overlay; background: Background; style: TextStyle;
  logoMediaId: ID | null; cursor: { itemId: ID | null; slideIndex: number } }
interface Settings { churchName: string; logoMediaId: ID | null; projectionDisplayId: number | null;
  background: Background; style: TextStyle; audioOutputDeviceId: string | null;
  adblockEnabled: boolean; updatesEnabled: boolean }
```

Valores padrão de `Settings` (em `src/shared/defaults.ts`): `churchName: ''`, `background: {type:'color', color:'#09124F', mediaId:null}`, `style: {fontFamily:'Sora', maxFontPx:96, minFontPx:32, color:'#FFFFFF', shadow:true, align:'center'}`, `adblockEnabled: false`, `updatesEnabled: false`.

- [ ] **Step 1: Criar `types.ts` e `defaults.ts`; `npx tsc --noEmit` passa.**
- [ ] **Step 2: Commit** `feat: tipos compartilhados`

---

### Task 3: Letras (parser) e repositório de músicas

**Files:** Create `src/shared/lyrics.ts`, `src/main/repos/songs.ts`; Test `tests/shared/lyrics.test.ts`, `tests/main/repos/songs.test.ts`

**Interfaces:**
- Produces: `parseLyrics(text: string): { parts: Omit<SongPart,'id'>[]; arrangement: number[] }` (arranjo como índices em `parts`).
- Produces: `serializeLyrics(parts: SongPart[], arrangement: ID[]): string` (inverso, para editar: cada parte aparece com o conteúdo na primeira vez e só o marcador nas repetições).
- Produces: `createSongsRepo(db)` → `{ list(query?: string): Song[]; get(id): Song | null; create(input: SongInput): Song; update(id, input: SongInput): Song; setArrangement(id, arrangement: ID[]): Song; remove(id): void }` com `SongInput = { title; artist; key; tags; lyrics: string; attachment: SongAttachment }`. IPC: grupo `songs`.

Regras do parser:
- Normaliza `\r\n` → `\n`, remove espaços no fim das linhas, junta 2+ linhas em branco em uma.
- Marcador = linha inteira no formato `[Nome]` ou `Nome:` quando `Nome` começa com Estrofe, Verso, Refrão, Coro, Ponte, Pré-refrão, Intro, Final (sem diferenciar maiúsculas; o rótulo salvo mantém o texto do usuário sem `[]`/`:`).
- Dentro de uma parte, blocos separados por linha em branco são slides.
- Marcador repetido sem conteúdo, ou com conteúdo idêntico, **reutiliza** a parte existente no arranjo.
- Texto sem nenhum marcador: cada bloco vira uma parte `Parte 1`, `Parte 2`...

- [ ] **Step 1: Testes que falham**

```ts
test('marcadores, slides e repetição', () => {
  const r = parseLyrics('[Estrofe 1]\nA\nB\n\nC\n\n[Refrão]\nR1\n\n[Estrofe 2]\nD\n\n[Refrão]');
  expect(r.parts.map(p => p.label)).toEqual(['Estrofe 1', 'Refrão', 'Estrofe 2']);
  expect(r.parts[0].slides).toEqual(['A\nB', 'C']);
  expect(r.arrangement).toEqual([0, 1, 2, 1]);
});
test('normaliza texto colado', () => {
  const r = parseLyrics('refrão:\r\nX  \r\n\r\n\r\n\r\nY\r\n');
  expect(r.parts).toEqual([{ label: 'refrão', slides: ['X', 'Y'] }]);
});
test('sem marcadores vira Parte N', () => {
  expect(parseLyrics('A\n\nB').parts.map(p => p.label)).toEqual(['Parte 1', 'Parte 2']);
});
test('serialize → parse preserva partes e arranjo', () => { /* ida e volta com a música do 1º teste */ });
test('repo: create, busca por trecho da letra, update troca as partes, remove', () => { /* ... */ });
```

- [ ] **Step 2:** `npm test -- tests/shared/lyrics tests/main/repos/songs` → FAIL.
- [ ] **Step 3: Implementar `parseLyrics`, `serializeLyrics` e `createSongsRepo`.** A busca usa `LIKE` em `title`, `artist` e na concatenação dos `slides` das partes, sem diferenciar maiúsculas nem acentos (normalizar com `normalize('NFD')` numa coluna `search_text` mantida pelo repo).
- [ ] **Step 4:** testes → PASS.
- [ ] **Step 5: Commit** `feat: parser de letras e repositório de músicas`

---

### Task 4: Bíblia

**Files:** Create `src/shared/bibleRef.ts`, `src/main/bible/bibleStore.ts`, `resources/bible/<sigla>.json` + `resources/bible/LICENSE-<sigla>.txt`; Test `tests/shared/bibleRef.test.ts`, `tests/main/bible/bibleStore.test.ts`

**Tradução incluída:** uma tradução em português com licença que permita redistribuição (ex.: **Bíblia Livre**, CC BY-SA). Conferir a licença antes e incluir o arquivo de licença e a atribuição nas configurações ("Sobre"). Converter para o formato abaixo com um script em `scripts/` (o script vai para o repositório).

```json
{ "id": "BLIVRE", "name": "Bíblia Livre", "license": "CC BY-SA 4.0",
  "books": [{ "id": "JHN", "name": "João", "abbrev": ["jo", "joão", "joao"], "chapters": [["v1", "v2"]] }] }
```

**Interfaces:**
- Produces: `parseReference(input: string): { bookId: string; chapter: number; verseStart: number | null; verseEnd: number | null } | null`. Aceita `Jo 3:16`, `jo 3.16-18`, `João 3`, `Salmos 23`, `1 Co 13:4-7`, `1Co 13`, sem diferenciar acentos.
- Produces: `createBibleStore(dir: string)` → `{ translations(): {id; name; license}[]; importTranslation(file: string): void /* copia para <userData>/bible */; passage(translationId, ref: string): { title: string; verses: {n: number; text: string}[] } | null; search(translationId, words: string, limit = 50): { ref: string; text: string }[] }`. IPC: grupo `bible`.
- Produces: `bibleSlides(passage, maxChars = 400): Slide[]` em `src/shared/slides.ts` (Task 8 usa): agrupa versículos em slides de até `maxChars`; um versículo sozinho maior que `maxChars` é quebrado na fronteira de palavra mais próxima. O `title` do slide é a referência do trecho (ex.: `João 3:16-17`).

- [ ] **Step 1: Testes que falham**

```ts
test.each([
  ['Jo 3:16', { bookId: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 }],
  ['joao 3.16-18', { bookId: 'JHN', chapter: 3, verseStart: 16, verseEnd: 18 }],
  ['Salmos 23', { bookId: 'PSA', chapter: 23, verseStart: null, verseEnd: null }],
  ['1Co 13:4-7', { bookId: '1CO', chapter: 13, verseStart: 4, verseEnd: 7 }],
])('parseReference(%s)', (input, expected) => expect(parseReference(input)).toEqual(expected));
test('referência inválida', () => expect(parseReference('Xyz 99')).toBeNull());
test('capítulo inexistente → passage null', () => { /* Jo 99 */ });
test('passagem longa vira vários slides e nenhum passa de 400 caracteres', () => { /* Salmos 119:1-40 */ });
test('busca por palavra sem acento acha versículo com acento', () => { /* "graca" acha "graça" */ });
```

- [ ] **Step 2:** testes → FAIL. **Step 3:** implementar (índice de busca em memória com texto normalizado sem acentos). **Step 4:** testes → PASS.
- [ ] **Step 5: Commit** `feat: Bíblia com referência, busca e slides`

---

### Task 5: Mídias locais

**Files:** Create `src/main/repos/media.ts`, `src/main/media/protocol.ts`; Test `tests/main/repos/media.test.ts`

**Interfaces:**
- Produces: `createMediaRepo(db, mediaDir: string)` → `{ list(kind?: MediaKind): MediaItem[]; importFile(path: string): MediaItem; remove(id): void; filePath(id): string | null }`. `importFile` copia para `mediaDir` como `<uuid><ext>`, detecta `kind`/`mime` pela extensão (imagens: png jpg jpeg webp gif; vídeo: mp4 webm mov mkv; áudio: mp3 wav ogg m4a aac); extensão desconhecida lança `UnsupportedMediaError`. `remove` apaga registro e arquivo. IPC: grupo `media` (+ `media.pickAndImport()` com `dialog.showOpenDialog`, várias seleções).
- Produces: protocolo `sonora-media://<id>` registrado como privilegiado (`stream: true`, `supportFetchAPI: true`), servindo o arquivo com suporte a `Range` (via `net.fetch(pathToFileURL(...))`) para o vídeo poder avançar.

- [ ] **Step 1: Testes que falham:** importa um `.mp4` de teste → arquivo existe em `mediaDir`, `kind === 'video'`; apagar o original não afeta; `.exe` lança `UnsupportedMediaError`; `remove` apaga o arquivo.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: biblioteca de mídias locais`

---

### Task 6: Ordem do culto e favoritos do YouTube

**Files:** Create `src/main/repos/services.ts`, `src/main/repos/favorites.ts`; Test `tests/main/repos/services.test.ts`

**Interfaces:**
- Produces: `createServicesRepo(db)` → `{ list(): Omit<Service,'items'>[]; get(id): Service | null; create(name, date): Service; rename(id, name, date): Service; duplicate(id, newDate: string): Service; remove(id): void; addItem(serviceId, data: ServiceItemData, position?: number): ServiceItem; updateItem(itemId, data): ServiceItem; moveItem(itemId, toPosition: number): Service; removeItem(itemId): void }`. Posições sempre contínuas `0..n-1`. IPC: grupo `services`.
- Produces: `resolveItem(item, deps): ResolvedItem` em `src/main/repos/services.ts`, com `ResolvedItem = { item: ServiceItem; missing: boolean; title: string }`. `missing = true` quando a música ou mídia referenciada não existe mais.
- Produces: `createFavoritesRepo(db)` → `{ list(); add(v: {videoId; title; channel; thumbnail}); remove(videoId) }` (adicionar repetido não duplica). IPC: grupo `favorites`.

- [ ] **Step 1: Testes que falham:** reordenar mantém posições contínuas; `duplicate` copia itens com novos ids; apagar uma música usada → `resolveItem(...).missing === true` e título `"Item removido"` (de `strings.ts` do main: `src/main/strings.ts`); favorito repetido não duplica.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat: ordem do culto e favoritos`

---

### Task 7: Configurações

**Files:** Create `src/main/repos/settings.ts`; Test `tests/main/repos/settings.test.ts`

**Interfaces:**
- Produces: `createSettingsRepo(db)` → `{ get(): Settings; update(patch: Partial<Settings>): Settings; onChange(cb: (s: Settings) => void): () => void }`. Chaves ausentes vêm de `defaults.ts`. IPC: grupo `settings`; o main reenvia `settings:changed` às duas janelas.

- [ ] **Step 1: Teste que falha:** banco vazio → `get()` igual aos padrões (`adblockEnabled === false`); `update({churchName:'X'})` persiste e chama `onChange`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `feat: configurações`

---

### Task 8: Slides e navegação ao vivo

**Files:** Create `src/shared/slides.ts` (completa o da Task 4), `src/shared/navigation.ts`, `src/main/live/liveController.ts`; Test `tests/shared/navigation.test.ts`, `tests/main/live/liveController.test.ts`

**Interfaces:**
- Consumes: `Song`, `ServiceItem`, `bibleSlides`, `resolveItem`.
- Produces: `buildSlides(item: ResolvedItem, deps: { song(id): Song | null; passage(tr, ref) }): Slide[]`. Música → um slide por slide de cada parte, **seguindo o arranjo**, com `label` = rótulo da parte. Aviso → 1 slide (`title` = título, `text` = corpo). Mídia/YouTube → `[]`. Item `missing` → `[]`.
- Produces: `nextPosition(items: {slideCount: number; skip: boolean}[], cur: {item: number; slide: number}): {item; slide} | null` e `prevPosition(...)`. `skip` = item ausente **ou** YouTube sem internet. Avançar no último slide vai para o slide 0 do próximo item sem `skip`; mídia/YouTube conta como 1 posição; no fim do culto retorna `null` (fica onde está).
- Produces: `class LiveController` (main) com `get(): LiveState`, `setOnline(online: boolean)` (recalcula `skip` dos itens do YouTube; `goTo` num item com `skip` é ignorado), `goTo(itemId: ID, slideIndex: number)`, `next()`, `prev()`, `setOverlay(o: Overlay)`, `media(cmd: {play?: boolean; volume?: number; position?: number})`, `loadService(serviceId)`, `subscribe(cb: (s: LiveState) => void)`. Cada mudança é enviada ao telão pelo canal `live:state` e ao operador por `live:state` também. IPC: grupo `live`.

- [ ] **Step 1: Testes que falham**

```ts
test('arranjo E1 R E2 R gera slides na ordem do arranjo', () => { /* labels: E1,E1,R,E2,R */ });
test('next pula item ausente e passa ao próximo item', () => {
  expect(nextPosition([{slideCount:2,skip:false},{slideCount:0,skip:true},{slideCount:1,skip:false}], {item:0, slide:1}))
    .toEqual({ item: 2, slide: 0 });
});
test('next no último slide do culto retorna null', () => { /* ... */ });
test('prev no slide 0 vai para o último slide do item anterior', () => { /* ... */ });
test('LiveController: overlay black mantém content; goTo emite estado', () => { /* ... */ });
```

- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `feat: slides e navegação ao vivo`

---

### Task 9: Janela do telão e monitores

**Files:** Create `src/shared/displays.ts`, `src/main/windows/projectionWindow.ts`, `src/main/windows/operatorWindow.ts`; Test `tests/shared/displays.test.ts`

**Interfaces:**
- Produces: `pickProjectionDisplay(displays: {id: number; primary: boolean}[], savedId: number | null, operatorDisplayId: number): number | null`. Regra: se `savedId` existe e ≠ operador → `savedId`; senão o primeiro monitor ≠ operador; se só houver o do operador → `null`.
- Produces: `ProjectionWindowManager` com `sync()`: chamado na inicialização, em `screen` `display-added` / `display-removed` / `display-metrics-changed` e quando `projectionDisplayId` muda. Se `pickProjectionDisplay` der `null`, **destrói** a janela; senão cria ou move: `BrowserWindow({ frame:false, show:false, skipTaskbar:true, focusable:false, backgroundColor:'#000000' })`, `setBounds(display.bounds)`, `setFullScreen(true)`, `setAlwaysOnTop(true, 'screen-saver')`, `showInactive()` após `ready-to-show`. Ao fechar a janela do operador, o app encerra.
- Produces: IPC `displays.list(): {id; label; primary; isOperator}[]`.

- [ ] **Step 1: Testes que falham:** só um monitor → `null`; monitor salvo sumiu → outro monitor que não seja o do operador; monitor salvo igual ao do operador → ignora.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Verificação manual:** com um segundo monitor (ou monitor virtual), desconectar com o telão aberto → janela some; reconectar → volta no monitor certo, nunca no do operador.
- [ ] **Step 6: Commit** `feat: janela do telão com troca de monitor`

---

### Task 10: Renderização do telão

**Files:** Create `src/shared/fitText.ts`, `src/renderer/telao/Telao.tsx`, `src/renderer/telao/Background.tsx`; Test `tests/shared/fitText.test.ts`

**Interfaces:**
- Consumes: `LiveState` via `window.sonora.live.onState(cb)`.
- Produces: `fitFontSize(measure: (px: number) => {width: number; height: number}, box: {width; height}, minPx: number, maxPx: number): number`, busca binária pelo maior tamanho inteiro que cabe; se nem `minPx` cabe, retorna `minPx`.

Comportamento: fundo (cor, imagem ou vídeo em loop, mudo, de `sonora-media://`), texto centralizado na área segura (90% da tela) com o estilo de `LiveState.style`, rodapé com `slide.title` quando existir, **fade de 300 ms** entre slides; `overlay`: `clear` esconde o texto, `black` cobre tudo de preto, `logo` mostra o logo da igreja sobre Navy. Mídia local: `<video>`/`<img>`/`<audio>` controlados pelo estado (`playing`, `volume`, `position`); áudio sai pelo `audioOutputDeviceId` (`setSinkId`). Cursor escondido. Nenhum controle visível.

- [ ] **Step 1: Testes que falham:** texto curto → `maxPx`; texto que só cabe em 50 → 50; nada cabe → `minPx`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Verificação manual:** estrofe de 12 linhas cabe sem cortar; `black` e `logo` cobrem tudo; trocar slide faz fade.
- [ ] **Step 6: Commit** `feat: renderização do telão`

---

### Task 11: Operador, biblioteca

**Files:** Create `src/renderer/operator/screens/{Songs,SongEditor,Bible,Media,Notices}.tsx`, `src/renderer/operator/components/{Sidebar,SearchBox,SlideThumb}.tsx`, `src/renderer/operator/store.ts` (zustand); Modify `src/renderer/shared/strings.ts`

Telas:
- **Músicas:** lista com busca; editor com título, artista, tom, tags e um campo de letra (`serializeLyrics`/`parseLyrics`); abaixo, o **arranjo** como chips arrastáveis (`@dnd-kit/sortable`), com botões para adicionar uma parte ao arranjo e remover um chip. Campo opcional "Vídeo ou mídia da música" (link do YouTube ou mídia da biblioteca); na operação, o item da música mostra um atalho para tocá-lo.
- **Bíblia:** escolha da tradução, campo de referência (mostra a passagem ao digitar) e busca por palavra; botão "Adicionar ao culto" e importação de tradução (`bible.importTranslation`).
- **Mídias:** grade com miniaturas, importar (vários arquivos) e apagar.
- **Avisos:** os avisos são criados direto como item do culto (título, corpo, fundo opcional); esta tela é o formulário reutilizado pela Task 12.

- [ ] **Step 1: Verificação:** `npm run dev`; cadastrar a música do teste da Task 3 colando a letra → as partes e o arranjo aparecem; arrastar um chip muda a ordem e persiste após reiniciar; Bíblia `Jo 3:16` mostra o versículo; importar uma imagem e um vídeo.
- [ ] **Step 2:** `npx tsc --noEmit` e `npm test` passam.
- [ ] **Step 3: Commit** `feat: biblioteca no operador`

---

### Task 12: Operador, ordem do culto e operação

**Files:** Create `src/renderer/operator/screens/{Services,Operate}.tsx`, `src/renderer/operator/components/{ServiceList,SlideGrid,PreviewPanel,EmergencyBar,MediaControls}.tsx`, `src/renderer/operator/useShortcuts.ts`

- **Cultos:** lista; criar (nome + data), duplicar, apagar; editar a lista de itens arrastando; adicionar itens vindos das telas da Task 11 e da Task 13.
- **Operação** (layout do design 8.7): à esquerda a ordem do culto (item ausente em cinza com "Item removido"); no centro a grade de slides do item selecionado, com o rótulo da parte; à direita **Prévia** (próximo slide, em miniatura) e **Ao vivo** (miniatura do estado atual, borda Mint); na barra inferior **Limpar texto**, **Tela preta**, **Logo**, **Fundo** e o monitor atual (ou "Telão desconectado" em destaque).
- Atalhos (`useShortcuts`, ignorados quando o foco está num campo de texto): `→`/`Espaço`/`PageDown` = `live.next()`; `←`/`PageUp` = `live.prev()`; `B` = preto; `C` = limpar; `L` = logo; `Esc` = tira o overlay.
- Item de mídia ou YouTube selecionado mostra os `MediaControls` (play/pausa, volume, barra de posição) e, na prévia, só a miniatura e o tempo, nunca o vídeo.

- [ ] **Step 1: Verificação:** com dois monitores, montar um culto com música, Bíblia, aviso e vídeo local; operar só pelo teclado do começo ao fim; os botões de emergência funcionam a qualquer momento; desconectar o projetor mostra "Telão desconectado".
- [ ] **Step 2:** `npx tsc --noEmit` e `npm test` passam. **Step 3: Commit** `feat: ordem do culto e tela de operação`

---

### Task 13: YouTube e bloqueador

**Files:** Create `src/main/youtube/session.ts`, `src/main/youtube/adblock.ts`, `src/renderer/operator/screens/YouTube.tsx`, `src/renderer/telao/YouTubePlayer.tsx`, `src/shared/youtube.ts`; Test `tests/shared/youtube.test.ts`

**Interfaces:**
- Produces: `parseVideoId(urlOrId: string): string | null` (aceita `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/` e o id puro de 11 caracteres).
- Produces: partição de sessão `persist:youtube`, usada pelo navegador do operador e pelo player do telão (o login no YouTube Premium fica salvo).
- Produces: `setAdblock(enabled: boolean): Promise<void>` em `adblock.ts`, usando `ElectronBlocker` de `@ghostery/adblocker-electron` na sessão `persist:youtube`, com as listas em cache em `<userData>/adblock-cache.bin`. O módulo só é importado (`import()` dinâmico) quando a constante de build `__ADBLOCK__` é `true`. `electron.vite.config.ts` define `__ADBLOCK__ = process.env.SONORA_ADBLOCK !== '0'`; com `false`, a opção nem aparece nas configurações.
- Produces: `onlineStatus` no store do operador (`navigator.onLine` + eventos `online`/`offline`), enviado ao main por `live.setOnline(online)`.

Comportamento:
- **Operador:** um `<webview partition="persist:youtube">` com youtube.com e um botão "Adicionar ao culto"/"Favoritar" que usa a URL atual (`parseVideoId`). Título e miniatura via `https://www.youtube.com/oembed?url=...&format=json`, que também diz se o vídeo existe. Lista de favoritos ao lado.
- **Telão (`YouTubePlayer`):** `<webview partition="persist:youtube">` carregando `https://www.youtube.com/embed/<id>?autoplay=1&controls=0&rel=0&modestbranding=1&enablejsapi=1`. **Portão:** a webview fica invisível (o telão mantém o conteúdo anterior) até que o `<video>` da página tenha `currentTime > 0`, não esteja pausado e o player não tenha a classe `ad-showing`; essa checagem é feita por `executeJavaScript` a cada 250 ms. Se aparecer um anúncio depois, a webview fica invisível de novo até ele terminar. play/pausa/volume/posição via `executeJavaScript` no elemento `video`.
- **Vídeo que não permite incorporar** (erro 101/150 no player): carrega `https://www.youtube.com/watch?v=<id>` na mesma webview e injeta CSS (`insertCSS`) que esconde tudo menos o `<video>` em tela cheia; o mesmo portão vale.
- **Sem internet:** itens do YouTube aparecem na operação com o rótulo "Sem internet" e não vão ao telão; os demais itens seguem normais.
- **Configurações:** a opção "Bloquear anúncios do YouTube" tem um texto ao lado explicando que vai contra os termos do YouTube e que as alternativas oficiais são o YouTube Premium e a mídia local.

- [ ] **Step 1: Testes que falham:** `parseVideoId` para os 5 formatos e `null` para URL sem vídeo; em `tests/main/live/liveController.test.ts`, culto [música, YouTube, aviso] com `setOnline(false)`: `next()` a partir do último slide da música vai direto ao aviso, e `goTo(<item YouTube>)` não muda o estado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Verificação manual:** com o bloqueador desligado e um vídeo com anúncio, o telão não mostra o anúncio (mantém o slide anterior) e mostra o vídeo quando ele começa; ligado, o vídeo entra direto; desligar o Wi-Fi marca os itens como "Sem internet" e o resto do culto opera normal; `SONORA_ADBLOCK=0 npm run build` gera um build sem `@ghostery` no bundle (`grep -r ghostery out/` vazio).
- [ ] **Step 6: Commit** `feat: YouTube com portão de anúncios e bloqueador opcional`

---

### Task 14: Tela de configurações e backup

**Files:** Create `src/main/backup.ts`, `src/renderer/operator/screens/Settings.tsx`; Test `tests/main/backup.test.ts`

**Interfaces:**
- Produces: `exportBackup(db, dataDir: string, target: string): Promise<void>`: usa `db.backup()` para uma cópia consistente e gera um `.sonora` (zip com `adm-zip`) com `sonora.db`, `media/`, `bible/` e `manifest.json` `{app:'sonora', version, createdAt}`.
- Produces: `restoreBackup(file: string, dataDir: string): Promise<void>`: valida o `manifest`; arquivo inválido lança `InvalidBackupError` sem tocar nos dados atuais; se válido, extrai para uma pasta temporária, troca a pasta de dados e reinicia o app (`app.relaunch(); app.exit()`).
- Tela: nome e logo da igreja, monitor do telão (`displays.list`, com "Identificar" mostrando um número grande em cada tela por 3 s), fundo e estilo padrão, saída de áudio (`navigator.mediaDevices.enumerateDevices`), bloqueador (Task 13), backup/restauração e "Sobre" (versão e licença da Bíblia).

- [ ] **Step 1: Testes que falham:** exportar → restaurar em outra pasta reproduz músicas e mídias; zip sem `manifest` lança `InvalidBackupError` e não altera a pasta de destino.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `feat: configurações e backup`

---

### Task 15: Instalador, atualização e teste de fumaça

**Files:** Modify `electron-builder.yml`, `package.json`; Create `src/main/updater.ts`, `e2e/smoke.spec.ts`, `playwright.config.ts`

- `electron-builder.yml`: `appId: app.sonora.desktop`, `productName: Sonora`, `win.target: nsis`, `nsis.oneClick: false`, `allowToChangeInstallationDirectory: true`, ícone `build/icon.ico`, `publish: { provider: github }` (o dono/repositório ficam para quando o autor decidir onde publicar). Os dados do usuário ficam em `userData` e não são apagados ao desinstalar ou atualizar.
- `updater.ts`: `initUpdater(settings)` só chama `autoUpdater.checkForUpdatesAndNotify()` se `settings.updatesEnabled` **e** `app.isPackaged`; com a opção desligada, não faz nenhuma requisição.
- `e2e/smoke.spec.ts` (Playwright `_electron.launch`, `userData` temporário): abre o app, cadastra uma música colando letra, cria um culto, adiciona a música, entra em Operação e aperta `→`. Confere que o `LiveState` (exposto por `window.sonora.live.get()`) tem o texto do segundo slide.

- [ ] **Step 1:** escrever `smoke.spec.ts`; `npm run build && npx playwright test` → FAIL até a ligação estar completa, depois PASS.
- [ ] **Step 2:** `npm run dist` gera `dist/Sonora-Setup-<versão>.exe`; instalar, abrir, fechar; instalar uma versão nova por cima e conferir que as músicas continuam lá.
- [ ] **Step 3: Commit** `build: instalador Windows, atualização opcional e teste de fumaça`
