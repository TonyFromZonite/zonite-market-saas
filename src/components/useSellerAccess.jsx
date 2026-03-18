import { useState, useEffect } from "react";
import { getVendeurSessionAsync } from "@/components/useSessionGuard";
import { createPageUrl } from "@/utils";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook centralisé pour récupérer le compte vendeur et calculer les droits d'accès.
 */
export function useSellerAccess() {
  const [seller, setSeller] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const session = await getVendeurSessionAsync();
      if (!session) {
        window.location.href = createPageUrl("Connexion");
        return;
      }
      // Get fresh data from DB
      const { data: freshSeller } = await supabase
        .from("sellers")
        .select("*")
        .eq("id", session.id)
        .maybeSingle();
      
      if (freshSeller) {
        setSeller(freshSeller);
      } else {
        setSeller(session);
      }
      setLoading(false);
    };
    charger();
  }, []);

  const status = seller?.seller_status;

  return {
    seller,
    loading,

    // Peut accéder à l'espace vendeur (dashboard, profil, notifs, support)
    canAccessEspace: ["kyc_pending", "kyc_rejected", "active_seller"].includes(status),

    // Peut faire des actions (commandes, commissions, paiements)
    canDoActions: status === "active_seller",

    // Peut voir le catalogue
    canSeeCatalogue: seller?.catalogue_debloque === true,

    // KYC en attente de validation
    isKycPending: status === "kyc_pending",

    // KYC rejeté — resoumission possible
    isKycRejected: status === "kyc_rejected",

    // KYC requis (pas encore soumis)
    isKycRequired: status === "kyc_required",

    // Email non vérifié
    isPendingVerification: status === "pending_verification",

    // Compte pleinement actif
    isFullyActive: status === "active_seller",
  };
}