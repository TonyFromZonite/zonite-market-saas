/**
 * Journalisation centralisée des erreurs critiques.
 *
 * - Écrit dans la table `journal_audit` (module = "systeme", action préfixée "[ALERT]")
 * - Émet un événement `window` "zonite:critical-error" que d'autres composants
 *   peuvent écouter pour afficher une alerte (toast).
 * - Ne lève JAMAIS d'exception — l'audit ne doit pas casser le flux utilisateur.
 *
 * Catégories supportées :
 *   - "auth"    : échecs d'authentification, login, OTP
 *   - "kyc"     : erreurs upload / soumission KYC
 *   - "upload"  : erreurs d'upload images (HEIC, conversion, stockage)
 *   - "sync"    : erreurs de synchronisation inter-onglets (storage event, BroadcastChannel)
 *   - "systeme" : autres erreurs critiques
 */

import { supabase } from "@/integrations/supabase/client";

const VALID_CATEGORIES = new Set(["auth", "kyc", "upload", "sync", "systeme"]);

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
 * @param {string} params.action     Action courte ex: "login_failed", "heic_unsupported"
 * @param {Error|string} [params.error]
 * @param {object} [params.context]  Contexte additionnel (sera stocké en details JSONB)
 * @param {string} [params.utilisateur] Email ou identifiant
 * @param {boolean} [params.alert=true] Émet l'événement d'alerte UI
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
  const payload = {
    category: cat,
    timestamp: new Date().toISOString(),
    error: serialized,
    ...context,
  };

  // Console — toujours
  try {
    // eslint-disable-next-line no-console
    console.error(`[CRITICAL][${cat}] ${action}`, payload);
  } catch { /* ignore */ }

  // Événement DOM pour alerte UI (toast, badge admin, etc.)
  if (alert && typeof window !== "undefined") {
    try {
      window.dispatchEvent(
        new CustomEvent("zonite:critical-error", {
          detail: { category: cat, action, message: serialized?.message, context },
        })
      );
    } catch { /* ignore */ }
  }

  // Persistance journal_audit — best-effort
  try {
    await supabase.from("journal_audit").insert({
      action: `[ALERT] ${action}`,
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
 * Installe les hooks globaux pour capturer les erreurs non gérées
 * (à appeler une seule fois depuis main.jsx).
 */
export function installGlobalCriticalHandlers() {
  if (typeof window === "undefined") return;
  if (window.__zoniteCriticalHandlersInstalled) return;
  window.__zoniteCriticalHandlersInstalled = true;

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev?.reason;
    // Filtrer le bruit (AbortError, ResizeObserver...)
    const msg = reason?.message || String(reason || "");
    if (/AbortError|ResizeObserver|NetworkError when attempting/i.test(msg)) return;
    logCritical({
      category: "systeme",
      action: "unhandled_rejection",
      error: reason,
      alert: false,
    });
  });

  window.addEventListener("error", (ev) => {
    const msg = ev?.message || "";
    if (/ResizeObserver|Script error\.?$/i.test(msg)) return;
    logCritical({
      category: "systeme",
      action: "unhandled_error",
      error: ev?.error || msg,
      context: { filename: ev?.filename, lineno: ev?.lineno, colno: ev?.colno },
      alert: false,
    });
  });
}
