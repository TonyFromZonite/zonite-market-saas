import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import { getVendeurSession } from "@/components/useSessionGuard";
import { useResponsive } from "@/hooks/useResponsive";

const PAGES_SANS_LAYOUT_ADMIN = new Set([
  "Connexion",
  "EspaceVendeur", "InscriptionVendeur", "VideoFormation", "CatalogueVendeur",
  "NouvelleCommandeVendeur", "MesCommandesVendeur", "ProfilVendeur",
  "DemandePaiement", "NotificationsVendeur", "AideVendeur",
  "EnAttenteValidation", "ResoumissionKYC",
  "EspaceSousAdmin",
]);

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badges, setBadges] = useState({ commandes: 0, kyc: 0 });
  const vendeurSession = getVendeurSession();
  const { isMobile, isDesktop } = useResponsive();

  // On desktop, keep sidebar always open
  useEffect(() => {
    if (isDesktop) setSidebarOpen(true);
    else setSidebarOpen(false);
  }, [isDesktop]);

  // Load badge counts
  useEffect(() => {
    if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName)) return;

    const loadBadges = async () => {
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

    loadBadges();
  }, [currentPageName]);

  // Pages without admin layout
  if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName) || vendeurSession) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
      {/* Header - always on top */}
      <AdminHeader onMenuOpen={() => setSidebarOpen((prev) => !prev)} />

      <div className="relative flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          badges={badges}
          isMobile={!isDesktop}
        />

        {/* Main content */}
        <main
          className="flex-1 overflow-auto"
          style={{
            marginLeft: isDesktop ? "240px" : 0,
            padding: isMobile ? "16px" : "24px",
            paddingBottom: isMobile ? "80px" : "24px",
          }}
        >
          {children}
        </main>
      </div>

      {/* Bottom nav on mobile */}
      <AdminBottomNav onOpenSidebar={() => setSidebarOpen(true)} />
    </div>
  );
}
