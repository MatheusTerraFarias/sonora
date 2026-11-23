import React from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/theme.css'
import { blockFileDrop } from '../shared/blockFileDrop'
import { Telao } from './Telao'

blockFileDrop()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Telao />
  </React.StrictMode>
)
