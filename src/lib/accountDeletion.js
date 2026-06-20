/**
 * Règles de sécurité pour la suppression définitive du compte vendeur (RGPD).
 *
 * Le bouton n'est visible que si :
 *  - Le compte a passé la vérification email (seller_status !== "pending_verification").
 *  - Le vendeur n'est pas l'admin principal (Tonykodjeu@gmail.com).
 *
 * Le statut KYC n'est PAS requis : un nouveau vendeur doit pouvoir supprimer
 * son compte conformément au RGPD, même si son KYC n'a pas encore été validé.
 *
 * La protection admin est aussi appliquée côté serveur (Edge Function
 * `delete-seller-complete`) — défense en profondeur.
 */

export const PRIMARY_ADMIN_EMAIL = "tonykodjeu@gmail.com";
export const SELF_DELETE_FORBIDDEN_STATUSES = ["pending_verification"];

export function isPrimaryAdminEmail(email) {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

export function canSelfDeleteAccount(seller) {
  if (!seller) return false;
  if (isPrimaryAdminEmail(seller.email)) return false;
  const status = seller.seller_status;
  if (!status || SELF_DELETE_FORBIDDEN_STATUSES.includes(status)) return false;
  return true;
}
