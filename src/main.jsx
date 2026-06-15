import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './globals.css'
import './App.css'
import { installGlobalCriticalHandlers } from '@/lib/criticalLogger'

installGlobalCriticalHandlers()

// Auto-reload sur chunks Vite périmés après déploiement.
// Un onglet ouvert avec un ancien index.html essaie de charger des hashes
// qui n'existent plus → on recharge une seule fois pour récupérer le nouveau bundle.
(function installStaleChunkReloader() {
  if (typeof window === "undefined") return;
  const FLAG = "zonite:chunk-reloaded";
  const CHUNK_ERR_RE =
    /Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed/i;

  const handle = (msg) => {
    if (!msg || !CHUNK_ERR_RE.test(msg)) return false;
    if (sessionStorage.getItem(FLAG)) return false;
    try { sessionStorage.setItem(FLAG, "1"); } catch { /* ignore */ }
    setTimeout(() => { try { window.location.reload(); } catch { /* ignore */ } }, 50);
    return true;
  };

  window.addEventListener("error", (ev) => handle(ev?.message || ev?.error?.message));
  window.addEventListener("unhandledrejection", (ev) => handle(ev?.reason?.message || String(ev?.reason || "")));

  // Si le chargement courant a réussi (DOMContentLoaded), on efface le flag pour
  // que la prochaine vraie panne puisse à nouveau déclencher un reload.
  window.addEventListener("load", () => {
    try { sessionStorage.removeItem(FLAG); } catch { /* ignore */ }
  });
})();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
