import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { NotDesktop } from './components/app/NotDesktop'
import './styles/globals.css'

const t = localStorage.getItem('theme') || 'light'
if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Preload köprüsü yoksa sayfa Electron dışında (tarayıcıda) açılmıştır */}
    {window.api ? <App /> : <NotDesktop />}
  </React.StrictMode>
)
