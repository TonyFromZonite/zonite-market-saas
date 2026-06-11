import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './globals.css'
import './App.css'
import { installGlobalCriticalHandlers } from '@/lib/criticalLogger'

installGlobalCriticalHandlers()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
