import React from 'react'
import { createRoot } from 'react-dom/client'
import '../shared/theme.css'
import { blockFileDrop } from '../shared/blockFileDrop'
import { App } from './App'

blockFileDrop()

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
