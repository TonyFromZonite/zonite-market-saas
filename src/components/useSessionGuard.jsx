/**
 * Module centralisé de gestion des sessions.
 * SOURCE DE VÉRITÉ pour toutes les vérifications de session dans l'app.
 * 
 * Sessions stockées dans sessionStorage :
 *   - "admin_session"   → admin principal
 *   - "sous_admin"      → sous-administrateur
 *   - "vendeur_session" → vendeur
 */

import { createPageUrl } from "@/utils";
import { supabase } from "@/integrations/supabase/client";

// ─── Lecture des sessions ────────────────────────────────────────────────────

export function getAdminSession() {
  try {
    const data = sessionStorage.getItem("admin_session");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'admin' ? parsed : null;
  } catch (_) { return null; }
}

export function getSousAdminSession() {
  try {
    const data = sessionStorage.getItem("sous_admin");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'sous_admin' ? parsed : null;
  } catch (_) { return null; }
}

export function getVendeurSession() {
  try {
    const data = sessionStorage.getItem("vendeur_session");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'vendeur' ? parsed : null;
  } catch (_) { return null; }
}

/**
 * Async version: tries sessionStorage first, then falls back to Supabase auth + sellers table.
 * Use this in pages that load vendor data to handle session edge cases.
 */
export async function getVendeurSessionAsync() {
  // Try sessionStorage first
  const stored = getVendeurSession();
  if (stored?.id) return stored;

  // Fallback: get from Supabase auth
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try by user_id
    let seller = null;
    const { data: sellerByUserId } = await supabase
      .from("sellers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    seller = sellerByUserId;

    // Fallback by email
    if (!seller) {
      const { data: sellerByEmail } = await supabase
        .from("sellers")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (sellerByEmail) {
        // Fix missing user_id
        await supabase
          .from("sellers")
          .update({ user_id: user.id })
          .eq("id", sellerByEmail.id);
        seller = { ...sellerByEmail, user_id: user.id };
      }
    }

    if (!seller) return null;

    // Rebuild and save session
    const session = {
      id: seller.id,
      user_id: user.id,
      email: seller.email,
      nom_complet: seller.full_name,
      role: "vendeur",
      seller_status: seller.seller_status,
      statut_kyc: seller.statut_kyc,
      telephone: seller.telephone,
      catalogue_debloque: seller.catalogue_debloque,
      training_completed: seller.training_completed,
      solde_commission: seller.solde_commission,
    };

    sessionStorage.setItem("vendeur_session", JSON.stringify(session));
    return session;
  } catch (_) {
    return null;
  }
}

/**
 * Retourne la session active : { type, data } ou null
 */
export function getActiveSession() {
  const admin = getAdminSession();
  if (admin) return { type: 'admin', data: admin };

  const sousAdmin = getSousAdminSession();
  if (sousAdmin) return { type: 'sous_admin', data: sousAdmin };

  const vendeur = getVendeurSession();
  if (vendeur) return { type: 'vendeur', data: vendeur };

  return null;
}

// ─── Guards (à utiliser dans useEffect) ─────────────────────────────────────

/**
 * Protège une page admin/sous-admin.
 * Redirige vers /Connexion si aucun admin ou sous-admin connecté.
 * Retourne true si l'accès est autorisé.
 */
export function requireAdminOrSousAdmin() {
  const admin = getAdminSession();
  const sousAdmin = getSousAdminSession();
  if (!admin && !sousAdmin) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

/**
 * Protège une page sous-admin seulement (pas l'admin principal).
 * Redirige si pas de session sous_admin.
 */
export function requireSousAdminSession() {
  const sousAdmin = getSousAdminSession();
  if (!sousAdmin) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

/**
 * Protège une page vendeur.
 * Redirige vers /Connexion si pas de session vendeur.
 */
export function requireVendeurSession() {
  const vendeur = getVendeurSession();
  if (!vendeur) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

/**
 * Vérifie qu'un sous-admin a la permission pour une page donnée.
 * L'admin principal a toujours accès.
 */
export function hasPermission(sousAdminData, page) {
  if (!page) return false;
  // Admin principal : accès total
  if (getAdminSession()) return true;
  // Sous-admin : vérifier les permissions
  if (!sousAdminData) return false;
  return (sousAdminData.permissions || []).includes(page);
}

/**
 * Déconnexion complète (toutes sessions)
 */
export function clearAllSessions() {
  sessionStorage.removeItem("admin_session");
  sessionStorage.removeItem("sous_admin");
  sessionStorage.removeItem("vendeur_session");
}