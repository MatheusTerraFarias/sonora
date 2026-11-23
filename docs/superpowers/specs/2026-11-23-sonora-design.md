# Sonora: design do programa

Data: 2026-11-23
Status: rascunho para aprovação

## 1. Intenção

A Sonora é um **programa de computador (Windows)** para a equipe de mídia de igreja operar o culto: letras de músicas, Bíblia, avisos, vídeos do YouTube e mídias locais no telão, tudo a partir de uma ordem de culto montada antes. Numa segunda fase, a Sonora também mostra o que está acontecendo no som (canais, microfones, níveis), apenas para acompanhar, sem controlar a mesa.

**Por quê:** o autor quer uma ferramenta própria para a igreja dele, com a identidade visual Sonora (já criada em `brand/`). No futuro ela pode ser vendida ou compartilhada com outras igrejas, mas a primeira versão é para uso próprio.

**Como é o sucesso:** um culto inteiro operado pela Sonora, por um voluntário, sem travar e sem mostrar nada indesejado no telão.

## 2. Objetivos

- Operar o telão durante o culto de forma simples, rápida e confiável.
- Funcionar **sem internet** em tudo que não seja o YouTube.
- Ficar pronto para ser distribuído no futuro: instalador, atualização automática, nada fixo da igreja do autor no código.
- Seguir a identidade visual Sonora (cores e logo de `brand/`).

## 3. Fora do escopo (agora)

- Controlar a mesa de som (o operador controla na própria mesa).
- Contas, login, nuvem ou sincronização entre computadores.
- Transmissão ao vivo, OBS e câmeras.
- Aplicativo de celular ou controle remoto pelo celular.
- Versão para Mac (não pode ser impedida pelas escolhas técnicas, mas não será feita agora).
- Site de download (fica para quando houver distribuição).
- Relatórios de direitos autorais (CCLI).
- Importar músicas de outros programas de projeção (a igreja ainda não usa nenhum; as músicas serão cadastradas na própria Sonora).

## 4. O que não pode acontecer (anti-objetivos)

- O telão mostrar algo que não devia: área de trabalho do Windows, notificações, janelas de erro, anúncios, a interface do operador.
- O programa travar ou ficar lento no meio do culto.
- Depender de internet para letras, Bíblia ou mídias locais.
- Ser complicado para um voluntário sem treinamento.
- Erro no monitoramento de som (fase 2) afetar a projeção.

## 5. Restrições

- Windows 10/11 no computador da igreja, com um segundo monitor ou projetor ligado.
- Computador inicial: o notebook do autor (novo, 16 GB de RAM). Desempenho não é uma restrição forte agora. *(Decisão do construtor)* Mesmo assim, como o programa pode ir para PCs mais modestos de outras igrejas: no máximo duas janelas renderizando (operador e telão), a prévia do operador é uma miniatura leve e não uma segunda cópia do vídeo, e o vídeo usa decodificação por hardware.
- Idioma da interface: português do Brasil, com os textos centralizados para facilitar traduções futuras.
- O autor ainda não tem mesa de som; o monitoramento precisa funcionar sem saber o modelo.
- O bloqueador de anúncios do YouTube vai contra os termos de uso do YouTube. Ele é aceitável no uso próprio, mas precisa ser fácil de remover de uma versão distribuída (ver 8.6).

## 6. Abordagens consideradas

| Abordagem | A favor | Contra |
|---|---|---|
| **Electron + TypeScript + React** (escolhida) | Telão em segunda tela simples; melhor suporte para YouTube e bloqueio de anúncios; interface moderna; caminho aberto para Mac | Instalador maior (~150 MB) e mais memória |
| Tauri (Rust + webview) | Leve | Bloquear anúncios no YouTube é muito mais difícil; desenvolvimento mais lento |
| .NET / WPF (C#) | Ótimo para áudio multicanal profissional (ASIO) | Só Windows; interface moderna dá mais trabalho; YouTube limitado |

**Escolha do autor: Electron.** Ele atende melhor os dois pedidos centrais (YouTube com bloqueador e telão sincronizado). Se a leitura de muitos canais de áudio na fase 2 precisar, entra um módulo nativo.

## 7. Arquitetura geral

- **Processo principal (Electron main):** banco de dados, arquivos, janelas, monitores, bloqueador, atualização automática e, na fase 2, conexões de áudio e com a mesa.
- **Janela do operador:** a interface de trabalho (biblioteca, ordem do culto, operação).
- **Janela do telão:** sem bordas, em tela cheia no monitor escolhido, sempre por cima. Ela só renderiza o que recebe; nunca tem controles.
- **Sincronização:** o operador manda o "estado ao vivo" para o processo principal, que repassa ao telão por IPC. Tudo é local, então a resposta é imediata.
- **Banco:** SQLite local com migrações versionadas. Todos os registros usam ID UUID e têm `criado_em` e `atualizado_em`, para permitir sincronização no futuro sem reestruturar.
- **Mídias importadas** são copiadas para a pasta de dados do programa, para não quebrarem se o arquivo original for movido.

## 8. Fase 1: projeção

### 8.1 Biblioteca de músicas
- Cadastro com título, artista, tom (opcional), tags e letra.
- A letra é colada como texto; **linhas em branco separam os slides**. Marcadores opcionais (`[Refrão]`, `[Estrofe 1]`, `[Ponte]`) dão nome às partes.
- *(Decisão do construtor)* A música é guardada como **partes + arranjo**: cada parte (estrofe, refrão, ponte) é escrita uma vez, e o arranjo é a sequência em que elas aparecem (ex.: E1, R, E2, R, P, R). O arranjo padrão é a ordem em que a letra foi colada; o usuário pode editá-lo arrastando as partes. Avançar no telão segue o arranjo.
- Busca por título, artista e trecho da letra.
- Opcional por música: link de vídeo do YouTube ou mídia local associada.

### 8.2 Bíblia
- Busca por referência ("Jo 3:16", "Salmos 23") e por palavra.
- Uma passagem vira um ou mais slides (quebra automática quando o texto não cabe).
- Inclui pelo menos uma tradução em português de **domínio público ou licença aberta**, que possa ser distribuída junto com o programa. Permite que o usuário importe outras traduções que já possua.

### 8.3 Mídias
- Importar imagens, vídeos (MP4 e similares) e áudios (MP3 e similares).
- Vídeos e imagens vão para o telão; o áudio sai pela saída de som do computador.

### 8.4 Avisos
- Slides de texto livre (título + corpo), com imagem de fundo opcional.

### 8.5 Ordem do culto
- Um culto tem data, nome e uma lista ordenada de itens: música, passagem bíblica, vídeo do YouTube, mídia local, aviso.
- Reordenar arrastando; duplicar um culto anterior como ponto de partida.

### 8.6 YouTube
- Busca e navegação no YouTube dentro do programa, por um navegador embutido (sem chave de API).
- Um vídeo encontrado pode ser adicionado à ordem do culto ou aos favoritos.
- No telão, o vídeo toca em tela cheia, sem a interface do site (player incorporado).
- **Bloqueador de anúncios:** módulo isolado com opção liga/desliga nas configurações, **desligado por padrão**, e removível da versão distribuída por uma opção de compilação.
- Sem internet, os itens de YouTube aparecem como indisponíveis, sem travar nada.
- *(Decisão do construtor)* **Anúncios e o anti-objetivo do telão:** com o bloqueador desligado, a Sonora não consegue garantir um telão sem anúncios. Por isso, enquanto o vídeo não está realmente tocando o conteúdo, o telão mantém o slide anterior (ou a tela preta) e só mostra o vídeo quando ele começa de fato; o operador vê o player na prévia. Para quem não usa o bloqueador, o caminho oficial sem anúncios é estar logado com YouTube Premium no navegador embutido (a sessão fica salva) ou usar mídia local. As configurações explicam isso ao lado da opção do bloqueador.
- *(Decisão do construtor)* Vídeos que o dono não permite incorporar em outros sites são marcados como tal na busca e, ao entrar na ordem do culto, tocam pela própria página do vídeo em modo tela cheia, sem a interface do site visível. Os vídeos não são baixados (só streaming).

### 8.7 Tela de operação (durante o culto)
Disposição pensada para o voluntário:

```
┌──────────────┬──────────────────────────────┬──────────────┐
│ Ordem do     │ Slides do item selecionado   │ PRÉVIA       │
│ culto        │ ┌────┐ ┌────┐ ┌────┐ ┌────┐  │ (próximo)    │
│ ▶ Música 1   │ │ E1 │ │ R  │ │ E2 │ │ R  │  ├──────────────┤
│   Leitura    │ └────┘ └────┘ └────┘ └────┘  │ AO VIVO      │
│   Vídeo YT   │                              │ (telão agora)│
│   Aviso      │                              │              │
├──────────────┴──────────────────────────────┴──────────────┤
│ [Limpar texto] [Tela preta] [Logo] [Fundo]   Telão: Monitor 2│
└────────────────────────────────────────────────────────────┘
```

- Clicar num slide manda para o telão. Setas e espaço avançam ou voltam; avançar no último slide passa para o próximo item.
- Botões de emergência sempre visíveis: limpar o texto (mantém o fundo), tela preta e logo.
- Controles de vídeo: play, pausa, volume e posição.

### 8.8 Telão
- Escolha do monitor nas configurações; se o monitor sumir, a janela do telão fecha sem aparecer na tela do operador e volta quando o monitor reconecta.
- Fundo configurável (cor, imagem ou vídeo em loop) e estilo de texto (fonte, tamanho, sombra, alinhamento). O texto ajusta o tamanho para caber.
- Transição suave (fade) entre slides.

### 8.9 Configurações
- Nome e logo da igreja, monitor do telão, estilos padrão, saída de áudio e bloqueador.
- Backup e restauração: exportar e importar todos os dados num único arquivo.

### 8.10 Instalação e atualização
- Instalador para Windows e atualização automática pelo próprio programa.
- *(Decisão do construtor)* A atualização automática fica pronta no código, publicando pelo GitHub Releases, mas só é ligada quando o autor decidir onde publicar (repositório público ou privado). Até lá, novas versões são instaladas rodando o instalador novo, que preserva os dados.
- Sem assinatura de código por enquanto (o Windows vai mostrar um aviso na instalação); revisitar quando houver distribuição.

## 9. Fase 2: monitoramento de som (somente leitura)

Construída depois da fase 1, numa tela própria. Ela não pode afetar a projeção (ver anti-objetivos).

1. **Mapa manual (qualquer mesa):** canais com nome, quem usa cada microfone, tipo (sem fio, com fio), observações (pilha trocada) e um checklist de passagem de som. Pode ser salvo como modelo e associado a um culto.
2. **Medidores pela placa de áudio:** a Sonora lê as entradas de um dispositivo de áudio multicanal (a mesa ligada por USB, por exemplo) e mostra o nível de cada canal em tempo real, com indicação de sinal ausente e de distorção (clip). Cada entrada é ligada a um canal do mapa.
3. **Conexão direta com a mesa:** a estrutura fica preparada com um "conector" por fabricante. **Nenhum conector é feito agora**: quando a igreja comprar a mesa, o autor informa o modelo e esse conector é implementado (primeiro candidato provável: família Behringer X32/XR/Wing e Midas M32, via OSC).

## 10. Identidade visual

- Cores de `brand/` (Navy `#09124F`, Royal `#16266D`, Blue `#4169E1`, Cloud `#F5F7FC`, Mint `#19B99A` para estados positivos, como "ao vivo" e "conectado").
- Fonte Sora (já em `brand/fontes/`). Ícone do programa a partir de `brand/logo/icone-app.svg`.
- Interface do operador em tema escuro por padrão (é comum ficar numa cabine com pouca luz).

## 11. Decidido pelo autor
- Programa instalado, não site. O site fica só para download, mais tarde.
- Começa como uso próprio, mas pensado para ser vendido ou compartilhado.
- Projeção primeiro; monitoramento de som depois, somente leitura.
- Monitoramento "universal": mapa manual + medidores por áudio; conector da mesa quando houver o modelo.
- YouTube integrado, com bloqueador de anúncios.
- Electron.

## 12. Deixado para quem construir
- Bibliotecas específicas (empacotamento, banco, bloqueador, interface), estrutura de pastas e testes.
- A tradução bíblica livre a incluir, desde que a licença permita distribuir.
- Detalhes visuais das telas, seguindo a seção 10.
- A forma de ler áudio multicanal na fase 2.
