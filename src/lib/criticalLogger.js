/**
 * Journalisation centralisée des erreurs critiques.
 *
 * - Écrit dans la table `journal_audit`. Le préfixe "[ALERT]" est appliqué
 *   uniquement quand `alert: true` (les entrées sans préfixe n'apparaissent pas
 *   dans la bannière admin temps-réel).
 * - Émet un événement `window` "zonite:critical-error" pour les toasts UI.
 * - Ne lève JAMAIS d'exception.
 *
 * Catégories : "auth" | "kyc" | "upload" | "sync" | "systeme"
 */

import { supabase } from "@/integrations/supabase/client";

const VALID_CATEGORIES = new Set(["auth", "kyc", "upload", "sync", "systeme"]);

// Bruit connu — jamais loggué, jamais alerté.
// Inclut : extensions navigateur (Google Translate, Grammarly) qui cassent la réconciliation React,
// chunks Vite périmés après déploiement (gérés par le handler dédié dans main.jsx),
// erreurs réseau transitoires, et permissions navigateur refusées.
const GLOBAL_NOISE_RE =
  /AbortError|ResizeObserver|NetworkError when attempting|NotAllowedError|not allowed by the user agent|Failed to fetch dynamically imported module|Loading chunk \d+ failed|Importing a module script failed|Failed to execute '(insertBefore|removeChild)' on 'Node'|The node (to be removed|before which the new node is to be inserted) is not a child of this node/i;

function serializeError(err) {
  if (!err) return null;
  if (typeof err === "string") return { message: err };
  return {
    message: err.message || String(err),
    name: err.name || undefined,
    code: err.code || err.status || undefined,
    cause: err.cause?.message || undefined,
    heicBrand: err.heicBrand || undefined,
  };
}

/**
 * @param {object} params
 * @param {"auth"|"kyc"|"upload"|"sync"|"systeme"} params.category
 * @param {string} params.action
 * @param {Error|string} [params.error]
 * @param {object} [params.context]
 * @param {string} [params.utilisateur]
 * @param {boolean} [params.alert=true] true → action préfixée "[ALERT]" + event UI ;
 *                                       false → logué silencieusement (pas de bannière admin).
 */
export async function logCritical({
  category = "systeme",
  action,
  error,
  context = {},
  utilisateur = null,
  alert = true,
} = {}) {
  const cat = VALID_CATEGORIES.has(category) ? category : "systeme";
  const serialized = serializeError(error);

  // Faux positifs auth : email non confirmé, mauvais mot de passe → silence total.
  if (
    cat === "auth" &&
    (serialized?.code === "email_not_confirmed" || serialized?.code === "invalid_credentials")
  ) {
    return;
  }

  const payload = {
    category: cat,
    timestamp: new Date().toISOString(),
    error: serialized,
    ...context,
  };

  try {
    // eslint-disable-next-line no-console
    console.error(`[CRITICAL][${cat}] ${action}`, payload);
  } catch { /* ignore */ }

  if (alert && typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("zonite:critical-error", {
          detail: { category: cat, action, message: serialized?.message, context },
        })
      );
    } catch { /* ignore */ }
  }

  try {
    await supabase.from("journal_audit").insert({
      action: alert ? `[ALERT] ${action}` : action,
      module: "systeme",
      details: payload,
      utilisateur: utilisateur || null,
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[criticalLogger] insert journal_audit failed:", e);
  }
}

/**
 * Hooks globaux pour erreurs non gérées (à appeler une seule fois depuis main.jsx).
 */
export function installGlobalCriticalHandlers() {
  if (typeof window === "undefined") return;
  if (window.__zoniteCriticalHandlersInstalled) return;
  window.__zoniteCriticalHandlersInstalled = true;

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev?.reason;
    const msg = reason?.message || String(reason || "");
    if (GLOBAL_NOISE_RE.test(msg)) return;
    if (reason?.name === "NotAllowedError" || reason?.name === "NotFoundError") return;
    logCritical({
      category: "systeme",
      action: "unhandled_rejection",
      error: reason,
      alert: false,
    });
  });

  window.addEventListener("error", (ev) => {
    const msg = ev?.message || ev?.error?.message || "";
    if (/ResizeObserver|Script error\.?$/i.test(msg)) return;
    if (GLOBAL_NOISE_RE.test(msg)) return;
    if (ev?.error?.name === "NotFoundError") return;
    logCritical({
      category: "systeme",
      action: "unhandled_error",
      error: ev?.error || msg,
      context: { filename: ev?.filename, lineno: ev?.lineno, colno: ev?.colno },
      alert: false,
    });
  });
}
