# Sonora: redesenho da interface do operador

Data: 2026-11-23
Status: direção definida pelo Claude a pedido do autor ("pode começar pela sua leitura")

## Por quê

O autor achou a interface da fase 1 "horrível". Leitura do problema (screenshots em `e2e/screenshots/`):
- Campos e botões soltos, sem hierarquia; tudo tem o mesmo peso.
- A operação, que é a tela principal, parece um formulário: slides como caixinhas de texto, prévia e "ao vivo" como cartões vazios, muito espaço morto.
- Cultos mistura criar culto, lista de cultos e formulário de aviso na mesma coluna.
- Rótulos em caixa alta (ESTROFE 1), barra lateral larga só de texto, nada lembra um equipamento de transmissão.

## Assunto, público e trabalho principal

- **Assunto:** a cabine de mídia de uma igreja durante o culto. O vocabulário visual vem dos equipamentos de transmissão: mesas de corte de vídeo, monitores de prévia e de programa, luz de "no ar" (tally), teclas físicas.
- **Público:** voluntário, muitas vezes sem treino, numa cabine com pouca luz, sob pressão do ao vivo.
- **Trabalho principal:** saber num relance o que está no telão e o que vem a seguir, e mudar isso com um toque ou uma tecla.

## Tokens

Cores (base é a marca; duas cores funcionais adicionadas):

| Nome | Hex | Uso |
|---|---|---|
| Cabine | `#070C2E` | fundo do app (mais escuro que o Navy da marca, para cabine escura) |
| Navy | `#09124F` | painéis |
| Linha | `#1C2763` | divisões de 1px, bordas de campos |
| Royal | `#16266D` | seleção, hover |
| Blue | `#4169E1` | ação principal, foco |
| Mint | `#19B99A` | tally "no telão" e estados positivos |
| Âmbar | `#F2B33D` | tally "próximo" (cue), avisos |
| Alerta | `#E5566B` | telão desconectado, apagar, erro |
| Cloud | `#F5F7FC` | texto principal |
| Névoa | `#8C96C8` | texto secundário |

Tipografia: **Sora** (já da marca) em tudo, com `font-variant-numeric: tabular-nums` em tempos e contagens. Escala: 12 / 13 / 15 / 18 / 24 / 32. Pesos 400, 600 e 700. Rótulos sempre em caixa normal (sentence case), nunca em caixa alta.

Raios com hierarquia: monitores e miniaturas 6px; botões e campos 8px; chips de parte da música totalmente arredondados; painéis sem raio (separados por linhas).

## Layout

- **Trilho de navegação** estreito à esquerda: o símbolo S no topo, ícones com rótulo curto embaixo de cada um. Substitui a barra larga de texto.
- **Barra superior** em todas as telas: nome do culto selecionado e data à esquerda; à direita o estado do telão (ponto Mint + "Telão: Monitor 2", ou faixa Alerta "Telão desconectado").
- **Operação (a tela que precisa impressionar):**

```
┌──┬─────────────────────────────────────────────────────────────┐
│S │ Culto de domingo   23/11/2026            ● Telão: Monitor 2 │
│  ├──────────────┬───────────────────────────────┬──────────────┤
│♪ │ Ordem        │ Hino de teste                 │ PRÓXIMO      │
│✝ │ ▌Hino ...  ● │ ┌──────┐ ┌──────┐ ┌──────┐     │ ┌──────────┐ │
│▣ │  Leitura     │ │ 16:9 │ │ 16:9 │ │ 16:9 │     │ │  16:9    │ │
│▤ │  Vídeo       │ └──────┘ └──────┘ └──────┘     │ └──────────┘ │
│▶ │  Aviso       │  Estrofe 1  Refrão  Estrofe 2  │ NO TELÃO     │
│⚙ │              │                               │ ┌──────────┐ │
│  │              │                               │ │  16:9    │ │
│  │              │                               │ └──────────┘ │
│  ├──────────────┴───────────────────────────────┴──────────────┤
│  │ [C] Limpar texto  [B] Tela preta  [L] Logo  [Esc] Fundo      │
└──┴─────────────────────────────────────────────────────────────┘
```
  - **Monitores 16:9 de verdade:** "Próximo" e "No telão" são miniaturas do telão (mesmo fundo, mesma fonte, texto ajustado), com moldura Âmbar e Mint como luzes de tally. A moldura Mint do "No telão" é o elemento marcante da interface. Vídeos aparecem como ícone + nome + tempo (nunca um segundo player).
  - **Slides como miniaturas 16:9** com o texto renderizado como no telão; o slide no ar tem a moldura Mint, o próximo tem a Âmbar. Rótulo da parte embaixo, em caixa normal.
  - **Ordem do culto** como roteiro vertical: ícone do tipo de item, título, e um ponto Mint no item que está no ar. Item removido em cinza riscado.
  - **Teclas de emergência** na base parecem teclas físicas: o atalho do teclado aparece numa tecla (keycap) dentro do botão; o overlay ativo fica aceso.
- **Biblioteca (Músicas, Bíblia, Mídias):** lista à esquerda com busca com ícone; detalhe à direita com cabeçalho próprio e ações agrupadas; estados vazios que dizem o que fazer ("Nenhuma música ainda. Cole uma letra para começar.").
- **Cultos:** lista de cultos à esquerda agrupada por data (próximos / anteriores); à direita o roteiro do culto. "Novo culto" e "Novo aviso" abrem diálogos, em vez de formulários soltos na coluna.
- **Configurações:** seções com títulos e um índice lateral (Igreja, Telão, Aparência, Áudio, YouTube, Backup, Sobre).

Alinhamento: tudo à esquerda, exceto o conteúdo dos monitores (centralizado como no telão).

## Princípios

1. O ao vivo manda: em qualquer tela, o estado do telão está visível.
2. Gastar a ousadia num lugar só: os monitores com tally. O resto é quieto: painéis planos, linhas finas, sem sombras genéricas nem degradês decorativos.
3. Cor tem significado: Mint = no ar, Âmbar = próximo, Alerta = problema, Blue = agir. Não usar essas cores como enfeite.
4. Movimento só como resposta: transição curta ao trocar o que está no ar; nada animando sozinho. Respeitar `prefers-reduced-motion`.
5. Qualidade mínima sem alarde: foco de teclado visível, contraste AA, alvos de clique com pelo menos 36px na operação.

## Fora do escopo

- Lógica e comportamento (IPC, LiveController, repositórios) não mudam, exceto o necessário para mostrar os monitores (dados que já existem: `live.get`, `live.outline`, settings).
- Telão (janela de projeção) não muda.
- Fase 2 (monitoramento de som) vem depois.

## Restrições que continuam valendo

- Todos os textos em `src/renderer/shared/strings.ts`.
- A prévia do operador nunca cria um segundo player de vídeo.
- Sem bibliotecas de UI pesadas; ícones podem vir de um pacote leve de SVG (ex.: lucide-react) ou SVGs próprios.
- Testes, typecheck, build e e2e continuam passando; o e2e gera screenshots para conferência.
