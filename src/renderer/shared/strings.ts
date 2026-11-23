/** Todos os textos visíveis da interface (pt-BR). */
export const strings = {
  app: {
    name: 'Sonora',
    tagline: 'Projeção para igrejas'
  },
  operator: {
    welcome: 'Bem-vindo ao Sonora',
    ready: 'Tudo pronto para começar.'
  },
  telao: {
    title: 'Telão'
  },
  nav: {
    songs: 'Músicas',
    bible: 'Bíblia',
    media: 'Mídias',
    notices: 'Avisos',
    services: 'Cultos',
    operation: 'Operação',
    youtube: 'YouTube',
    settings: 'Configurações',
    ariaLabel: 'Navegação principal'
  },
  common: {
    soon: 'Em breve',
    soonHint: 'Esta seção será liberada em uma próxima etapa.',
    search: 'Buscar',
    save: 'Salvar',
    saving: 'Salvando…',
    saved: 'Salvo',
    cancel: 'Cancelar',
    remove: 'Remover',
    delete: 'Apagar',
    loading: 'Carregando…',
    error: 'Algo deu errado. Tente novamente.',
    none: 'Nenhum'
  },
  addToService: {
    button: 'Adicionar ao culto',
    added: 'Adicionado ao culto',
    noService: 'Escolha um culto em Cultos para adicionar itens.'
  },
  songs: {
    title: 'Músicas',
    searchPlaceholder: 'Buscar por título, artista ou letra',
    newSong: 'Nova música',
    empty: 'Nenhuma música encontrada.',
    pickOrCreate: 'Selecione uma música ou crie uma nova.',
    fieldTitle: 'Título',
    fieldArtist: 'Artista',
    fieldKey: 'Tom',
    fieldTags: 'Tags (separadas por vírgula)',
    fieldLyrics: 'Letra',
    lyricsHelp: 'Use marcadores como [Estrofe 1] e [Refrão]. Linhas em branco separam os slides. Ao salvar, o arranjo é refeito a partir da letra.',
    arrangement: 'Arranjo',
    arrangementHelp: 'Arraste os blocos para mudar a ordem.',
    arrangementEmpty: 'O arranjo aparece depois de salvar a letra.',
    addPart: 'Adicionar parte ao arranjo',
    addPartButton: 'Adicionar',
    removeChip: 'Remover do arranjo',
    dragChip: 'Arrastar',
    attachment: 'Vídeo ou mídia da música',
    attachmentNone: 'Nenhum',
    attachmentYoutube: 'Link do YouTube',
    attachmentMedia: 'Mídia da biblioteca',
    attachmentYoutubePlaceholder: 'Cole o link do vídeo',
    attachmentInvalid: 'Link do YouTube inválido.',
    attachmentPickMedia: 'Escolha uma mídia',
    deleteSong: 'Excluir música',
    confirmDelete: 'Excluir esta música? Esta ação não pode ser desfeita.',
    titleRequired: 'Informe o título da música.',
    previewParts: 'Partes'
  },
  bible: {
    title: 'Bíblia',
    translation: 'Tradução',
    noTranslations: 'Nenhuma tradução instalada. Importe uma para começar.',
    importTranslation: 'Importar tradução',
    importing: 'Importando…',
    imported: 'Tradução importada.',
    reference: 'Referência',
    referencePlaceholder: 'Ex.: Jo 3:16',
    notFound: 'Passagem não encontrada.',
    wordSearch: 'Buscar por palavra',
    wordSearchPlaceholder: 'Ex.: amor',
    noResults: 'Nenhum resultado.'
  },
  media: {
    title: 'Mídias',
    import: 'Importar arquivos',
    importing: 'Importando…',
    empty: 'Nenhuma mídia importada ainda.',
    confirmDelete: 'Apagar esta mídia? Ela deixará de aparecer onde estiver em uso.',
    kindImage: 'Imagem',
    kindVideo: 'Vídeo',
    kindAudio: 'Áudio'
  },
  notices: {
    title: 'Avisos',
    fieldTitle: 'Título',
    fieldBody: 'Texto do aviso',
    fieldBackground: 'Fundo (opcional)',
    noBackground: 'Sem fundo de mídia',
    submit: 'Adicionar aviso ao culto',
    titleRequired: 'Informe o título do aviso.',
    added: 'Aviso adicionado ao culto.'
  }
} as const
