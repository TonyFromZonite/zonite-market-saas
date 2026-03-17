import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getVendeurSession } from "@/components/useSessionGuard";
import { useIsMobile } from "@/hooks/use-mobile";

const PAGES_SANS_LAYOUT_ADMIN = new Set([
  "Connexion",
  "EspaceVendeur", "InscriptionVendeur", "VideoFormation", "CatalogueVendeur",
  "NouvelleCommandeVendeur", "MesCommandesVendeur", "ProfilVendeur",
  "DemandePaiement", "NotificationsVendeur", "AideVendeur",
  "EnAttenteValidation", "ResoumissionKYC",
  "EspaceSousAdmin",
]);

const DESKTOP_BREAKPOINT = 1024;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.innerWidth >= DESKTOP_BREAKPOINT : false
  );
  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const onChange = () => setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
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
          supabase.from("commandes_vendeur").select("id", { count: "exact", head: true }).eq("statut", "en_attente_validation_admin"),
          supabase.from("sellers").select("id", { count: "exact", head: true }).eq("statut_kyc", "en_attente").neq("role", "admin"),
        ]);
        setBadges({ commandes: cmdCount || 0, kyc: kycCount || 0 });
      } catch (_) {}
    };
    chargerBadges();
  }, [currentPageName]);

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (isDesktop) setSidebarOuverte(false);
  }, [isDesktop]);

  if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName) || vendeurSession) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 flex bg-slate-50">
      {/* Desktop: permanent sidebar */}
      {isDesktop && (
        <AdminSidebar isOpen={true} onClose={() => {}} badges={badges} isDesktop={true} />
      )}

      {/* Mobile: overlay sidebar */}
      {!isDesktop && (
        <AdminSidebar isOpen={sidebarOuverte} onClose={() => setSidebarOuverte(false)} badges={badges} isDesktop={false} />
      )}

      {/* Right side: header + content */}
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader
          currentPageName={currentPageName}
          onMenuOpen={() => setSidebarOuverte(true)}
          showBurger={!isDesktop}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
