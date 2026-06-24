/**
 * Extrait proprement le payload d'erreur d'un appel `supabase.functions.invoke`.
 * Évite l'affichage du message générique "Edge Function returned a non-2xx status code".
 *
 * Retourne toujours { message, status, payload }.
 */
export async function extractFunctionError(
  error,
  fallback = "Une erreur est survenue. Réessayez dans un instant."
) {
  const ctx = error?.context;
  const status = ctx?.status;
  let payload = null;
  let rawText = "";

  try {
    if (ctx && typeof ctx.clone === "function") {
      try {
        payload = await ctx.clone().json();
      } catch (_) {
        try {
          rawText = await ctx.clone().text();
          if (rawText) {
            try {
              payload = JSON.parse(rawText);
            } catch (_) {
              /* not JSON */
            }
          }
        } catch (_) {
          /* unreadable */
        }
      }
    }
  } catch (_) {
    /* defensive */
  }

  const isGeneric = !error?.message || /non-2xx/i.test(error.message);
  const message =
    payload?.error ||
    (rawText && !rawText.trim().startsWith("{") ? rawText : null) ||
    (isGeneric ? fallback : error?.message) ||
    fallback;

  if (typeof console !== "undefined") {
    console.error("[edge-fn error]", { status, payload, rawText, message });
  }

  return { message, status, payload: payload || {} };
}

export default extractFunctionError;
