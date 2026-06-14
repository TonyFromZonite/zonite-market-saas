/**
 * Règles de sécurité pour la suppression définitive du compte vendeur (RGPD).
 *
 * - Le bouton n'est visible/cliquable que pour les vendeurs dont le compte
 *   a été validé (statut différent de "pending_verification").
 * - L'admin principal (Tonykodjeu@gmail.com) ne peut JAMAIS être supprimé.
 *   Cette protection est aussi appliquée côté serveur (Edge Function
 *   `delete-seller-complete`) — c'est la défense en profondeur.
 */

export const PRIMARY_ADMIN_EMAIL = "tonykodjeu@gmail.com";

export const SELF_DELETE_FORBIDDEN_STATUSES = ["pending_verification"];

export function isPrimaryAdminEmail(email) {
  if (!email || typeof email !== "string") return false;
  return email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

/**
 * Renvoie true si le vendeur a le droit de demander la suppression
 * définitive de son propre compte depuis l'app.
 */
export function canSelfDeleteAccount(seller) {
  if (!seller) return false;
  if (isPrimaryAdminEmail(seller.email)) return false;
  const status = seller.seller_status;
  if (!status) return false;
  if (SELF_DELETE_FORBIDDEN_STATUSES.includes(status)) return false;
  return true;
}
