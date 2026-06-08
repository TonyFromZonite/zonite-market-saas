// Helper de simulation admin du statut KYC d'un vendeur.
// N'écrit RIEN en base : l'override est stocké en localStorage et appliqué
// uniquement quand un admin/sous-admin est connecté dans le même navigateur.
// Permet aux écrans vendeur (bandeau jaune, blocage KYC, demande paiement, etc.)
// de refléter instantanément les 4 états (non_soumis, en_attente, valide, rejete).

const KEY = "admin_kyc_sim_override";
export const KYC_SIM_EVENT = "kyc-sim-change";

export function isAdminViewer() {
  try {
    const s = JSON.parse(localStorage.getItem("admin_session") || "null");
    return !!(s?.email && (s?.role === "admin" || s?.role === "sous_admin"));
  } catch { return false; }
}

export function getKycSimOverride() {
  if (typeof window === "undefined") return null;
  if (!isAdminViewer()) return null;
  const v = localStorage.getItem(KEY);
  return v && v !== "null" ? v : null;
}

export function setKycSimOverride(value) {
  if (value) localStorage.setItem(KEY, value);
  else localStorage.removeItem(KEY);
  try { window.dispatchEvent(new CustomEvent(KYC_SIM_EVENT, { detail: value || null })); } catch {}
}

const STATUT_TO_SELLER_STATUS = {
  non_soumis: "kyc_required",
  en_attente: "kyc_pending",
  valide: "active_seller",
  rejete: "kyc_rejected",
};

// Mutateur idempotent : retourne un nouvel objet vendeur avec le statut simulé.
// Si pas d'override (ou pas admin), renvoie l'objet inchangé.
export function applyKycSimOverride(seller) {
  const ov = getKycSimOverride();
  if (!seller || !ov) return seller;
  return {
    ...seller,
    statut_kyc: ov === "non_soumis" ? null : ov,
    seller_status: STATUT_TO_SELLER_STATUS[ov] || seller.seller_status,
    catalogue_debloque: ov === "valide" ? true : seller.catalogue_debloque,
    kyc_raison_rejet:
      ov === "rejete"
        ? (seller.kyc_raison_rejet || "Simulation admin : documents non conformes")
        : seller.kyc_raison_rejet,
  };
}

// S'abonner aux changements de simulation (callback appelé à chaque toggle).
export function subscribeKycSim(cb) {
  if (typeof window === "undefined") return () => {};
  const h = (e) => { try { cb(e?.detail ?? getKycSimOverride()); } catch {} };
  window.addEventListener(KYC_SIM_EVENT, h);
  window.addEventListener("storage", h);
  return () => {
    window.removeEventListener(KYC_SIM_EVENT, h);
    window.removeEventListener("storage", h);
  };
}
