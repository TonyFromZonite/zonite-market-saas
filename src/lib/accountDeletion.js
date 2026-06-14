/**
 * Règles de sécurité pour la suppression définitive du compte vendeur (RGPD).
 *
 * Le bouton n'est visible que si :
 *  - Le compte a passé la vérification email (seller_status !== "pending_verification").
 *  - Le KYC du vendeur a été validé (`statut_kyc === "valide"`).
 *  - Le vendeur n'est pas l'admin principal (Tonykodjeu@gmail.com).
 *
 * La protection admin est aussi appliquée côté serveur (Edge Function
 * `delete-seller-complete`) — défense en profondeur.
 */

export const PRIMARY_ADMIN_EMAIL = "tonykodjeu@gmail.com";
export const REQUIRED_KYC_STATUS = "valide";
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
  if (seller.statut_kyc !== REQUIRED_KYC_STATUS) return false;
  return true;
}
