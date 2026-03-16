/**
 * Seller Status Engine
 * Controls access to features based on seller_status
 */

export const SELLER_STATUSES = {
  PENDING_VERIFICATION: "pending_verification",
  KYC_REQUIRED: "kyc_required",
  KYC_PENDING: "kyc_pending",
  KYC_APPROVED_TRAINING_REQUIRED: "kyc_approved_training_required",
  ACTIVE_SELLER: "active_seller",
};

export const STATUS_LABELS: Record<string, string> = {
  pending_verification: "Email à vérifier",
  kyc_required: "Vérification d'identité requise",
  kyc_pending: "Dossier KYC en révision",
  kyc_approved_training_required: "Formation obligatoire",
  active_seller: "Vendeur actif",
};

type AccessMap = Record<string, Record<string, boolean>>;

export const canAccessFeature = (sellerStatus: string, feature: string, trainingCompleted = false): boolean => {
  const accessMap: AccessMap = {
    dashboard: {
      [SELLER_STATUSES.PENDING_VERIFICATION]: false,
      [SELLER_STATUSES.KYC_REQUIRED]: true,
      [SELLER_STATUSES.KYC_PENDING]: true,
      [SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED]: true,
      [SELLER_STATUSES.ACTIVE_SELLER]: true,
    },
    catalog: {
      [SELLER_STATUSES.PENDING_VERIFICATION]: false,
      [SELLER_STATUSES.KYC_REQUIRED]: false,
      [SELLER_STATUSES.KYC_PENDING]: false,
      [SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED]: false,
      [SELLER_STATUSES.ACTIVE_SELLER]: true,
    },
    sales: {
      [SELLER_STATUSES.PENDING_VERIFICATION]: false,
      [SELLER_STATUSES.KYC_REQUIRED]: false,
      [SELLER_STATUSES.KYC_PENDING]: false,
      [SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED]: false,
      [SELLER_STATUSES.ACTIVE_SELLER]: true,
    },
    training: {
      [SELLER_STATUSES.PENDING_VERIFICATION]: false,
      [SELLER_STATUSES.KYC_REQUIRED]: false,
      [SELLER_STATUSES.KYC_PENDING]: false,
      [SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED]: true,
      [SELLER_STATUSES.ACTIVE_SELLER]: true,
    },
    profile: {
      [SELLER_STATUSES.PENDING_VERIFICATION]: false,
      [SELLER_STATUSES.KYC_REQUIRED]: true,
      [SELLER_STATUSES.KYC_PENDING]: true,
      [SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED]: true,
      [SELLER_STATUSES.ACTIVE_SELLER]: true,
    },
  };

  let canAccess = accessMap[feature]?.[sellerStatus] ?? false;

  if (sellerStatus === SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED && !trainingCompleted) {
    if (["catalog", "sales"].includes(feature)) {
      canAccess = false;
    }
  }

  return canAccess;
};

export const getRestrictionMessage = (sellerStatus: string, feature: string): string | null => {
  if (canAccessFeature(sellerStatus, feature)) return null;

  const messages: Record<string, string> = {
    [SELLER_STATUSES.PENDING_VERIFICATION]: "Veuillez vérifier votre email pour continuer.",
    [SELLER_STATUSES.KYC_REQUIRED]: `Veuillez soumettre votre dossier KYC pour accéder à ${feature}.`,
    [SELLER_STATUSES.KYC_PENDING]: "Votre dossier KYC est en révision. Veuillez patienter.",
    [SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED]: "Veuillez regarder et valider la vidéo de formation.",
  };

  return messages[sellerStatus] || "Accès non autorisé.";
};

export const getRequiredModal = (sellerStatus: string, trainingCompleted = false): string | null => {
  const modals: Record<string, string> = {
    [SELLER_STATUSES.PENDING_VERIFICATION]: "email_verification",
    [SELLER_STATUSES.KYC_REQUIRED]: "kyc_submission",
    [SELLER_STATUSES.KYC_PENDING]: "kyc_pending",
    [SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED]: "training_required",
  };

  if (sellerStatus === SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED && !trainingCompleted) {
    return "training_required";
  }

  return modals[sellerStatus] || null;
};

export const shouldShowTrainingModal = (sellerStatus: string, trainingCompleted = false): boolean => {
  return sellerStatus === SELLER_STATUSES.KYC_APPROVED_TRAINING_REQUIRED && !trainingCompleted;
};
