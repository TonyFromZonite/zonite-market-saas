import React, { useState, useEffect } from "react";
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

function useResponsive() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isDesktop;
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOuverte, setSidebarOuverte] = useState(false);
  const [badges, setBadges] = useState({ commandes: 0, kyc: 0 });
  const vendeurSession = getVendeurSession();
  const isDesktop = useResponsive();

  useEffect(() => {
    if (isDesktop) setSidebarOuverte(false);
  }, [isDesktop]);

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

  if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName) || vendeurSession) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-dvh w-full bg-slate-50 lg:flex">
      {isDesktop && <AdminSidebar isOpen={true} onClose={() => {}} badges={badges} isDesktop={true} />}
      {!isDesktop && <AdminSidebar isOpen={sidebarOuverte} onClose={() => setSidebarOuverte(false)} badges={badges} isDesktop={false} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader currentPageName={currentPageName} onMenuOpen={() => setSidebarOuverte(true)} showBurger={!isDesktop} />
        <main className="flex-1 min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
