/**
 * Module centralisé de gestion des sessions.
 * SOURCE DE VÉRITÉ pour toutes les vérifications de session dans l'app.
 * 
 * Sessions stockées dans localStorage (persistent) :
 *   - "admin_session"   → admin principal
 *   - "sous_admin"      → sous-administrateur
 *   - "vendeur_session" → vendeur
 */

import { createPageUrl } from "@/utils";
import { supabase } from "@/integrations/supabase/client";

// ─── Lecture des sessions ────────────────────────────────────────────────────

export function getAdminSession() {
  try {
    const data = localStorage.getItem("admin_session");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'admin' ? parsed : null;
  } catch (_) { return null; }
}

export function getSousAdminSession() {
  try {
    const data = localStorage.getItem("sous_admin");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'sous_admin' ? parsed : null;
  } catch (_) { return null; }
}

export function getVendeurSession() {
  try {
    const data = localStorage.getItem("vendeur_session");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return (parsed?.id || parsed?.email) ? parsed : null;
  } catch (_) { return null; }
}

/**
 * Async version: tries localStorage first, then falls back to Supabase auth + sellers table.
 */
export async function getVendeurSessionAsync() {
  const stored = getVendeurSession();
  if (stored?.id) return stored;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let seller = null;
    const { data: sellerByUserId } = await supabase
      .from("sellers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    
    seller = sellerByUserId;

    if (!seller) {
      const { data: sellerByEmail } = await supabase
        .from("sellers")
        .select("*")
        .eq("email", user.email)
        .maybeSingle();

      if (sellerByEmail) {
        await supabase
          .from("sellers")
          .update({ user_id: user.id })
          .eq("id", sellerByEmail.id);
        seller = { ...sellerByEmail, user_id: user.id };
      }
    }

    if (!seller) return null;

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
      wizard_completed: seller.wizard_completed || false,
    };

    localStorage.setItem("vendeur_session", JSON.stringify(session));
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

// ─── Guards ─────────────────────────────────────

export function requireAdminOrSousAdmin() {
  const admin = getAdminSession();
  const sousAdmin = getSousAdminSession();
  if (!admin && !sousAdmin) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

export function requireSousAdminSession() {
  const sousAdmin = getSousAdminSession();
  if (!sousAdmin) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

export function requireVendeurSession() {
  const vendeur = getVendeurSession();
  if (!vendeur) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

export function hasPermission(sousAdminData, page) {
  if (!page) return false;
  if (getAdminSession()) return true;
  if (!sousAdminData) return false;
  return (sousAdminData.permissions || []).includes(page);
}

/**
 * Déconnexion complète (toutes sessions)
 */
export function clearAllSessions() {
  localStorage.removeItem("admin_session");
  localStorage.removeItem("sous_admin");
  localStorage.removeItem("vendeur_session");
}
