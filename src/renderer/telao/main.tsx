import React from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/theme.css'
import { Telao } from './Telao'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Telao />
  </React.StrictMode>
)
