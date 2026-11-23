/** Textos visíveis gerados pelo processo main (pt-BR). */
export const strings = {
  startup: {
    failedTitle: 'O Sonora não conseguiu iniciar',
    failedMessage: (dir: string, detail: string) =>
      `Não foi possível abrir os dados do Sonora.

Pasta de dados: ${dir || '(desconhecida)'}

` +
      `Se outro Sonora estiver aberto, feche-o e tente de novo. Se o problema continuar, restaure um backup ` +
      `ou leve essa pasta a quem dá suporte.

Detalhe: ${detail}`
  },
  bible: {
    importTitle: 'Importar tradução da Bíblia',
    filterName: 'Bíblia (JSON)'
  },
  media: {
    importTitle: 'Importar mídias',
    filterName: 'Imagens, vídeos e áudios'
  },
  displays: {
    monitor: (n: number, w: number, h: number) => `Monitor ${n} (${w}×${h})`
  },
  backup: {
    exportTitle: 'Exportar backup',
    restoreTitle: 'Restaurar backup',
    filterName: 'Backup do Sonora',
    confirmTitle: 'Restaurar backup',
    confirmMessage: 'Restaurar este backup vai substituir todos os dados atuais (músicas, cultos, mídias e Bíblias).',
    confirmDetail: 'O Sonora será reiniciado. Esta ação não pode ser desfeita.',
    confirmYes: 'Restaurar e reiniciar',
    confirmNo: 'Cancelar',
    failedTitle: 'Falha ao restaurar',
    failedMessage: 'Não foi possível concluir a restauração. O Sonora será reiniciado.',
    failedOk: 'Reiniciar'
  },
  services: {
    removedItem: 'Item removido'
  }
}
