/**
 * Seller Status Engine
 * Controls access to features based on seller_status
 * SIMPLIFIED: After registration + code verification → active_seller
 * KYC only required for payment requests
 * Catalogue locked by training only
 */

export const SELLER_STATUSES = {
  PENDING_VERIFICATION: "pending_verification",
  KYC_REQUIRED: "kyc_required",
  KYC_PENDING: "kyc_pending",
  KYC_REJECTED: "kyc_rejected",
  KYC_APPROVED_TRAINING_REQUIRED: "kyc_approved_training_required",
  ACTIVE_SELLER: "active_seller",
};

export const STATUS_LABELS = {
  pending_verification: "Vérification en cours",
  kyc_required: "Vendeur actif",
  kyc_pending: "KYC en révision",
  kyc_rejected: "KYC rejeté",
  kyc_approved_training_required: "Formation requise",
  active_seller: "Vendeur actif",
};

/**
 * Check if seller can access a feature based on their status and training completion
 */
export const canAccessFeature = (sellerStatus, feature, trainingCompleted = false) => {
  // Dashboard, profile, support → always accessible for all statuses
  if (["dashboard", "profile"].includes(feature)) {
    return sellerStatus !== SELLER_STATUSES.PENDING_VERIFICATION;
  }

  // Training → accessible for active sellers or those needing training
  if (feature === "training") {
    return sellerStatus === SELLER_STATUSES.ACTIVE_SELLER || 
           sellerStatus === SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED ||
           sellerStatus === SELLER_STATUSES.KYC_REQUIRED ||
           sellerStatus === SELLER_STATUSES.KYC_PENDING;
  }

  // Catalog & sales → only if training completed
  if (["catalog", "sales"].includes(feature)) {
    if (!trainingCompleted) return false;
    return sellerStatus === SELLER_STATUSES.ACTIVE_SELLER ||
           sellerStatus === SELLER_STATUSES.KYC_REQUIRED ||
           sellerStatus === SELLER_STATUSES.KYC_PENDING;
  }

  return false;
};

/**
 * Get restriction message for restricted feature
 */
export const getRestrictionMessage = (sellerStatus, feature) => {
  if (canAccessFeature(sellerStatus, feature)) return null;

  if (sellerStatus === SELLER_STATUSES.PENDING_VERIFICATION) {
    return "Veuillez vérifier votre numéro pour continuer.";
  }

  if (["catalog", "sales"].includes(feature)) {
    return "Veuillez compléter la formation pour accéder à cette fonctionnalité.";
  }

  return "Accès non autorisé.";
};

/**
 * Get the modal to show based on seller status
 * SIMPLIFIED: No KYC modal on load anymore
 */
export const getRequiredModal = (sellerStatus, trainingCompleted = false) => {
  if (sellerStatus === SELLER_STATUSES.PENDING_VERIFICATION) {
    return "email_verification";
  }
  // KYC modals removed from auto-show
  // KYC_REQUIRED and KYC_PENDING no longer show modals
  if (sellerStatus === SELLER_STATUSES.KYC_REQUIRED) return "kyc_submission";
  if (sellerStatus === SELLER_STATUSES.KYC_PENDING) return "kyc_pending";
  return null;
};

/**
 * Check if seller needs training modal
 * Only show if NOT completed training yet
 */
export const shouldShowTrainingModal = (sellerStatus, trainingCompleted = false) => {
  return false; // Disabled - we use catalogue lock screen instead
};
