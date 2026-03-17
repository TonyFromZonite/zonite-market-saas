import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getVendeurSession } from "@/components/useSessionGuard";

const PAGES_SANS_LAYOUT_ADMIN = new Set([
  "Connexion",
  "EspaceVendeur", "InscriptionVendeur", "VideoFormation", "CatalogueVendeur",
  "NouvelleCommandeVendeur", "MesCommandesVendeur", "ProfilVendeur",
  "DemandePaiement", "NotificationsVendeur", "AideVendeur",
  "EnAttenteValidation", "ResoumissionKYC",
  "EspaceSousAdmin",
]);

const DESKTOP_BREAKPOINT = 960;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : false
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const handleChange = (event) => setIsDesktop(event.matches);

    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDesktop;
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOuverte, setSidebarOuverte] = useState(false);
  const [badges, setBadges] = useState({ commandes: 0, kyc: 0 });
  const vendeurSession = getVendeurSession();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName)) return;

    const chargerBadges = async () => {
      try {
        const [{ count: cmdCount }, { count: kycCount }] = await Promise.all([
          supabase
            .from("commandes_vendeur")
            .select("id", { count: "exact", head: true })
            .eq("statut", "en_attente_validation_admin"),
          supabase
            .from("sellers")
            .select("id", { count: "exact", head: true })
            .eq("statut_kyc", "en_attente")
            .neq("role", "admin"),
        ]);

        setBadges({ commandes: cmdCount || 0, kyc: kycCount || 0 });
      } catch (_) {}
    };

    chargerBadges();
  }, [currentPageName]);

  useEffect(() => {
    if (isDesktop) {
      setSidebarOuverte(false);
    }
  }, [isDesktop]);

  if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName) || vendeurSession) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="flex min-h-screen w-full">
        {isDesktop ? (
          <AdminSidebar isOpen={true} onClose={() => {}} badges={badges} isDesktop={true} />
        ) : (
          <AdminSidebar
            isOpen={sidebarOuverte}
            onClose={() => setSidebarOuverte(false)}
            badges={badges}
            isDesktop={false}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader
            currentPageName={currentPageName}
            onMenuOpen={() => setSidebarOuverte(true)}
            showBurger={!isDesktop}
          />

          <main className="flex-1 overflow-x-hidden px-3 py-4 sm:px-4 sm:py-5 md:px-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
