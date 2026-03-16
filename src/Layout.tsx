import React, { useState, useEffect, useLayoutEffect } from "react";
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

function getWidth() {
  return typeof window !== "undefined" ? window.innerWidth : 1024;
}

interface LayoutProps {
  children: React.ReactNode;
  currentPageName?: string;
}

export default function Layout({ children, currentPageName }: LayoutProps) {
  const [sidebarOuverte, setSidebarOuverte] = useState(false);
  const [badges, setBadges] = useState({ commandes: 0, kyc: 0 });
  const [windowWidth, setWindowWidth] = useState(getWidth);
  const vendeurSession = getVendeurSession();

  useLayoutEffect(() => { setWindowWidth(window.innerWidth); }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDesktop = windowWidth >= 1024;

  useEffect(() => { if (isDesktop) setSidebarOuverte(false); }, [isDesktop]);

  useEffect(() => {
    if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName || '')) return;
    const chargerBadges = async () => {
      try {
        const [cmdRes, kycRes] = await Promise.all([
          supabase.from('commandes_vendeur').select('id', { count: 'exact' }).eq('statut', 'en_attente_validation_admin'),
          supabase.from('sellers').select('id', { count: 'exact' }).eq('statut_kyc', 'en_attente'),
        ]);
        setBadges({ commandes: cmdRes.count || 0, kyc: kycRes.count || 0 });
      } catch {}
    };
    chargerBadges();
  }, [currentPageName]);

  if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName || '') || vendeurSession) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {isDesktop && (
        <div className="flex-shrink-0">
          <AdminSidebar isOpen={true} onClose={() => {}} badges={badges} isDesktop={true} />
        </div>
      )}
      {!isDesktop && (
        <AdminSidebar isOpen={sidebarOuverte} onClose={() => setSidebarOuverte(false)} badges={badges} isDesktop={false} />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader currentPageName={currentPageName} onMenuOpen={() => setSidebarOuverte(true)} showBurger={!isDesktop} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
