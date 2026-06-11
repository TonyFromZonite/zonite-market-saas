import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS = {
  auth: "🔐 Authentification",
  kyc: "📋 KYC",
  upload: "🖼️ Upload image",
  sync: "🔄 Synchronisation",
  systeme: "⚠️ Erreur critique",
};

/**
 * Écoute l'événement global "zonite:critical-error" émis par criticalLogger
 * et affiche un toast destructif à l'utilisateur.
 */
export default function CriticalAlertListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handler = (ev) => {
      const { category = "systeme", action, message } = ev?.detail || {};
      toast({
        title: CATEGORY_LABELS[category] || CATEGORY_LABELS.systeme,
        description: message || action || "Une erreur critique est survenue.",
        variant: "destructive",
      });
    };
    window.addEventListener("zonite:critical-error", handler);
    return () => window.removeEventListener("zonite:critical-error", handler);
  }, [toast]);

  return null;
}
