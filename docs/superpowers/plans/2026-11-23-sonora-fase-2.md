# Sonora Fase 2 (Monitoramento de som): Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela "Som" no operador com o mapa manual dos canais (funciona com qualquer mesa) e medidores de nível ao vivo lidos de um dispositivo de áudio, somente leitura, sem nunca afetar a projeção.

**Architecture:** Mapas de som ficam no SQLite (repo + IPC no main, como os outros). A captura e a medição de áudio rodam **no renderer do operador** com Web Audio (`getUserMedia` + `ChannelSplitterNode` + um `AnalyserNode` por entrada), isoladas num motor próprio; a lógica de nível é pura em `src/shared/meter.ts`. Conectores de mesa (caminho 3) ficam só como tipo/interface, sem implementação.

**Tech Stack:** o mesmo da fase 1 (Electron, React, TypeScript, better-sqlite3, zustand, @dnd-kit, Vitest, Playwright). **Nenhum módulo nativo novo** (a máquina não tem Visual Studio para compilar).

**Spec:** `docs/superpowers/specs/2026-11-23-sonora-design.md` (seção 9) e, para o visual, `docs/superpowers/specs/2026-11-23-sonora-ui-redesign.md`.

## Global Constraints

- Somente leitura: a Sonora nunca envia nada para a mesa.
- "Ela não pode afetar a projeção": nenhum código de áudio roda no processo main nem no telão; qualquer erro do motor de medição fica contido na tela Som.
- Funciona sem internet.
- Todos os textos visíveis em `src/renderer/shared/strings.ts` (caixa normal, nunca caixa alta).
- Visual segue o redesenho: tokens de `theme.css`, primitivas de `components/ui/`; Mint = sinal ok, Âmbar = sinal alto, Alerta = clip/sem sinal/desconectado.
- Todo registro novo tem `id` UUID, `created_at`, `updated_at`; mudanças de esquema só por migração nova anexada.
- Sem módulos nativos novos; sem bibliotecas de UI.

## Review Focus

1. **Dispositivo de áudio desconectado com os medidores ligados:** os medidores param, a tela mostra "Dispositivo desconectado" e volta sozinha quando ele reaparece; nada trava (teste na Task 3).
2. **Dispositivo com menos entradas do que o mapa usa** (ex.: notebook com 2 canais e mapa com 16): canais sem entrada correspondente mostram "Sem entrada", não um medidor parado em zero (teste na Task 3).
3. **Permissão de microfone negada ou dispositivo ocupado:** mensagem clara do que fazer, sem erro técnico (teste na Task 3).
4. **Pico curto (clip) que some em milissegundos:** a indicação de clip fica acesa tempo suficiente para o operador ver (`CLIP_HOLD_MS`) (teste na Task 2).
5. **Mapa editado ou culto trocado com os medidores rodando:** os medidores seguem as novas ligações sem reiniciar a captura (teste na Task 3).

---

## Estrutura de arquivos

```
src/shared/sound.ts            # tipos SoundMap, SoundChannel, ChecklistItem, MixerConnector
src/shared/meter.ts            # nível em dB, estado, pico com retenção
src/main/repos/sound.ts        # repositório de mapas + vínculo com culto
src/renderer/operator/sound/meterEngine.ts   # captura Web Audio (sem React)
src/renderer/operator/sound/useMeters.ts     # hook React sobre o motor
src/renderer/operator/screens/Sound.tsx + Sound.css
src/renderer/operator/components/sound/{ChannelTable,MeterBar,Checklist,DevicePicker}.tsx
tests/shared/meter.test.ts  tests/main/repos/sound.test.ts  tests/renderer/meterEngine.test.ts
```

---

### Task 1: Modelo de dados dos mapas de som

**Files:** Create `src/shared/sound.ts`, `src/main/repos/sound.ts`; Modify `src/main/db/migrations.ts` (nova migração), `src/main/index.ts` (IPC), `src/preload/index.ts`, `src/shared/types.ts` + `src/shared/defaults.ts` (setting `soundInputDeviceId: string | null`, padrão `null`); Test `tests/main/repos/sound.test.ts`

**Interfaces (Produces):**

```ts
type ChannelKind = 'wireless' | 'wired' | 'line' | 'other';
interface SoundChannel { id: ID; number: number; name: string; person: string; kind: ChannelKind;
  notes: string; inputIndex: number | null }          // inputIndex = entrada do dispositivo (0-based)
interface ChecklistItem { id: ID; text: string }
interface SoundMap { id: ID; name: string; channels: SoundChannel[]; checklist: ChecklistItem[];
  createdAt: string; updatedAt: string }
interface ServiceSound { serviceId: ID; mapId: ID | null; checked: ID[]; channelNotes: Record<ID, string> }
interface MixerConnector { id: string; label: string }   // caminho 3: só o tipo, nenhuma implementação
```

- Tabelas: `sound_maps(id, name, channels TEXT json, checklist TEXT json, created_at, updated_at)` e `service_sound(service_id PK FK→services ON DELETE CASCADE, map_id NULL FK→sound_maps ON DELETE SET NULL, checked TEXT json, channel_notes TEXT json, updated_at)`.
- `createSoundRepo(db)` → `{ list(): SoundMap[]; get(id): SoundMap | null; create(name: string): SoundMap; save(map: SoundMap): SoundMap; duplicate(id, name): SoundMap; remove(id): void; getForService(serviceId): ServiceSound; setForService(serviceId, patch: Partial<Omit<ServiceSound,'serviceId'>>): ServiceSound }`.
- `save` normaliza: `number` contínuo 1..n na ordem do array; `inputIndex` inteiro ≥ 0 ou `null`; ids novos para itens sem id. JSON corrompido numa linha → mapa com listas vazias, sem lançar (mesmo padrão dos cultos).
- IPC grupo `sound` (`sound:<método>`), tipado no preload. Duplicar um culto (services.duplicate) **não** copia o checklist marcado, só o `mapId` (decisão: marcar de novo a cada culto).

- [ ] **Step 1: Testes que falham:** criar mapa vazio; `save` com canais fora de ordem renumera 1..n; `inputIndex` negativo vira `null`; `getForService` de culto sem registro → `{mapId:null, checked:[], channelNotes:{}}`; apagar o mapa deixa `mapId` null no culto; apagar o culto remove o registro; linha com JSON corrompido não lança; duplicar culto copia `mapId` e zera `checked`.
- [ ] **Step 2:** `npm test -- tests/main/repos/sound` → FAIL.
- [ ] **Step 3: Implementar** tipos, migração, repo, IPC, preload e o setting.
- [ ] **Step 4:** PASS; `npm run typecheck` limpo.
- [ ] **Step 5: Commit** `feat: mapas de som e vínculo com o culto`

---

### Task 2: Cálculo de nível (puro)

**Files:** Create `src/shared/meter.ts`; Test `tests/shared/meter.test.ts`

**Interfaces (Produces):**
- Constantes: `SILENCE_DB = -60`, `HOT_DB = -6`, `CLIP_LEVEL = 0.989` (amostra absoluta ≈ -0,1 dBFS), `CLIP_HOLD_MS = 1500`, `PEAK_HOLD_MS = 1000`, `PEAK_DECAY_DB_PER_S = 20`, `NO_SIGNAL_AFTER_MS = 10000`.
- `measure(samples: Float32Array): { rmsDb: number; peakDb: number; clipped: boolean }`: dBFS com piso em `SILENCE_DB` (silêncio absoluto → `SILENCE_DB`, nunca `-Infinity`/`NaN`).
- `levelState(rmsDb: number): 'silent' | 'ok' | 'hot'` (`< SILENCE_DB + 1` silent, `≥ HOT_DB` hot).
- `type MeterTrack = { peakDb: number; peakAt: number; clipUntil: number; lastSignalAt: number }` e `stepTrack(prev: MeterTrack | null, m: ReturnType<typeof measure>, now: number): MeterTrack`: pico retém `PEAK_HOLD_MS` e depois cai `PEAK_DECAY_DB_PER_S`; clip fica aceso até `now + CLIP_HOLD_MS`; `lastSignalAt` atualiza quando `rmsDb > SILENCE_DB + 1`.
- `channelStatus(track: MeterTrack, now: number): 'signal' | 'no-signal' | 'clip'`: `clip` se `now < clipUntil`; `no-signal` se `now - lastSignalAt > NO_SIGNAL_AFTER_MS`.

- [ ] **Step 1: Testes que falham**

```ts
test('silêncio absoluto vira SILENCE_DB', () => expect(measure(new Float32Array(1024)).rmsDb).toBe(SILENCE_DB));
test('senoide de amplitude 0,5 ≈ -9 dBFS rms', () => expect(measure(sine(0.5)).rmsDb).toBeCloseTo(-9.03, 1));
test('amostra em 1,0 marca clip', () => expect(measure(Float32Array.of(0, 1, 0)).clipped).toBe(true));
test('clip de um quadro fica aceso por CLIP_HOLD_MS', () => { /* stepTrack com clip em t=0, depois silêncio: status 'clip' em t=1400, 'signal'/'no-signal' em t=1600 */ });
test('pico retém e depois decai 20 dB/s', () => { /* pico -3 em t=0; em t=900 ainda -3; em t=1500 ≈ -13 */ });
test('sem sinal por mais de 10 s → no-signal', () => { /* ... */ });
```

- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5: Commit** `feat: cálculo de nível dos medidores`

---

### Task 3: Motor de captura

**Files:** Create `src/renderer/operator/sound/meterEngine.ts`, `src/renderer/operator/sound/useMeters.ts`; Modify `src/main/index.ts` (permissão de mídia); Test `tests/renderer/meterEngine.test.ts`

**Interfaces:**
- Consumes: `measure`, `stepTrack`, `channelStatus` (Task 2); `SoundChannel` (Task 1); setting `soundInputDeviceId`.
- Produces:

```ts
type EngineState =
  | { kind: 'idle' } | { kind: 'starting' }
  | { kind: 'running'; deviceLabel: string; inputCount: number }
  | { kind: 'error'; reason: 'permission' | 'busy' | 'not-found' | 'disconnected' | 'unknown' };
interface InputReading { rmsDb: number; peakDb: number; status: 'signal' | 'no-signal' | 'clip' }
interface MeterEngine {
  start(deviceId: string | null): Promise<void>; stop(): void;
  onState(cb: (s: EngineState) => void): () => void;
  onFrame(cb: (inputs: InputReading[]) => void): () => void;   // ~30 Hz
}
createMeterEngine(deps: { mediaDevices: MediaDevices; createContext: () => AudioContext;
  now: () => number; schedule: (cb: () => void) => () => void }): MeterEngine
useMeters(channels: SoundChannel[]): { state: EngineState; byChannel: Record<ID, InputReading | 'no-input'> }
```

- `start`: `getUserMedia({ audio: { deviceId: exact quando houver, channelCount: { ideal: 32 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })`; `inputCount` = `track.getSettings().channelCount ?? 1`; um `ChannelSplitterNode(inputCount)` e um `AnalyserNode` (fftSize 2048) por entrada; nada é ligado ao `destination` (sem retorno de som).
- Erros do `getUserMedia` mapeados: `NotAllowedError` → `permission`, `NotReadableError` → `busy`, `NotFoundError`/`OverconstrainedError` → `not-found`; track `ended` ou `devicechange` sem o dispositivo → `disconnected`, e o motor tenta `start` de novo a cada 3 s enquanto a tela estiver aberta.
- `useMeters` liga cada canal ao seu `inputIndex`; `inputIndex` nulo ou ≥ `inputCount` → `'no-input'`. Trocar `channels` não reinicia a captura.
- Main: `session.defaultSession.setPermissionRequestHandler` permite `media` (áudio) **só** para a URL do renderer do operador; continua negando para o telão e para webviews.

- [ ] **Step 1: Testes que falham** (fakes de `mediaDevices`/`AudioContext`; sem DOM real): permissão negada → estado `error/permission`; dispositivo com 2 entradas e canais com `inputIndex` 0, 1 e 5 → o terceiro fica `'no-input'`; track `ended` → `error/disconnected` e nova tentativa após 3 s que volta a `running`; trocar a lista de canais não chama `getUserMedia` de novo; `stop` fecha o contexto e para as tracks.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; typecheck limpo.
- [ ] **Step 5: Commit** `feat: motor de captura dos medidores`

---

### Task 4: Tela Som

**Files:** Create `src/renderer/operator/screens/Sound.tsx`, `Sound.css`, `src/renderer/operator/components/sound/{ChannelTable,MeterBar,Checklist,DevicePicker}.tsx`; Modify `store.ts` (`Section` ganha `'sound'`), `components/shell/NavRail.tsx` (item "Som" entre Cultos e Músicas), `strings.ts`, `e2e/screens.spec.ts`

Layout (mesma linguagem do redesenho):

```
┌ Som ─────────────────────────── [Mapa: Domingo ▾] [Dispositivo: Mesa USB ▾] ● Lendo 16 entradas ┐
│ #  Canal          Quem        Tipo      Entrada   Nível                          Obs.            │
│ 1  Mic pastor     Pr. João    Sem fio   1        ▮▮▮▮▮▮▮▯▯▯  -18 dB              pilha trocada   │
│ 2  Violão         Ana         Linha     2        ▮▮▯▯▯▯▯▯▯▯  sem sinal                           │
│ 3  Vocal 2        —           Com fio   —        sem entrada                                     │
├──────────────────────────────────────────┬────────────────────────────────────────────────────┤
│ Passagem de som (checklist do culto)      │ [+ Canal] [Duplicar mapa] [Novo mapa]             │
└──────────────────────────────────────────┴────────────────────────────────────────────────────┘
```

- Mapa escolhido é o do culto selecionado (`sound.getForService(currentServiceId)`); sem culto, edita o mapa escolhido no seletor sem checklist. Trocar o mapa do culto grava `setForService`.
- Tabela editável no lugar (nome, quem, tipo, entrada 1-based na tela / 0-based no dado, observações), reordenável com @dnd-kit; salvar com debounce de 500 ms e `useSafe`/`ErrorBanner`.
- `MeterBar` horizontal com escala de `SILENCE_DB` a 0 dB, marca de pico, cores Mint/Âmbar/Alerta pelos estados; "sem sinal", "sem entrada" e "clip" escritos por extenso (não só cor). Atualização visual via `requestAnimationFrame`, sem re-render React por quadro (usar refs/estilo direto).
- Estados do motor na barra do topo da tela: iniciando, lendo N entradas, e cada erro com texto de ação (ex.: permissão → "Permita o acesso ao microfone nas configurações do Windows"; ocupado → "Feche outro programa que esteja usando a placa de áudio").
- Checklist do culto: marcar/desmarcar grava `checked`; itens editáveis no mapa.
- Escolha do dispositivo grava `settings.soundInputDeviceId`; a lista vem de `enumerateDevices()` (`audioinput`), com "Padrão do sistema" = null.
- Os medidores só rodam com a tela Som aberta (o motor para ao sair), para não gastar CPU durante a projeção.
- e2e: semear um mapa com 3 canais e salvar `e2e/screenshots/11-som.png` (no CI o dispositivo pode não existir; a tela deve mostrar o estado de erro bem escrito).

- [ ] **Step 1: Verificação:** `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` passam; conferir `11-som.png` contra o layout acima e o redesenho.
- [ ] **Step 2: Commit** `feat: tela Som com mapa de canais e medidores`
