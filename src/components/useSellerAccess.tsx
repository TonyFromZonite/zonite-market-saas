import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVendeurSession } from "@/components/useSessionGuard";
import { createPageUrl } from "@/utils";

export function useSellerAccess() {
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      const session = getVendeurSession();
      if (!session) {
        window.location.href = createPageUrl("Connexion");
        return;
      }
      if (session.id && session.nom_complet) {
        setSeller(session);
        setLoading(false);
        return;
      }
      const { data: sellers } = await supabase
        .from('sellers')
        .select('*')
        .eq('email', session.email as string)
        .limit(1);
      if (sellers && sellers.length > 0) {
        setSeller(sellers[0]);
      } else {
        window.location.href = createPageUrl("Connexion");
      }
      setLoading(false);
    };
    charger();
  }, []);

  const status = seller?.seller_status;

  return {
    seller,
    loading,
    canAccessEspace: ["kyc_pending", "active_seller"].includes(status),
    canDoActions: status === "active_seller",
    canSeeCatalogue: seller?.catalogue_debloque === true,
    isKycPending: status === "kyc_pending",
    isKycRequired: status === "kyc_required",
    isPendingVerification: status === "pending_verification",
    isFullyActive: status === "active_seller",
  };
}
