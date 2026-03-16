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

export default function Layout({ children, currentPageName }) {
  const [sidebarOuverte, setSidebarOuverte] = useState(false);
  const [badges, setBadges] = useState({ commandes: 0, kyc: 0 });
  const [windowWidth, setWindowWidth] = useState(getWidth);
  const vendeurSession = getVendeurSession();

  useLayoutEffect(() => {
    setWindowWidth(window.innerWidth);
  }, []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isDesktop = windowWidth >= 1024;

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
    <div style={{ display: "flex", width: "100vw", height: "100vh", overflow: "hidden", background: "#f8fafc", position: "fixed", top: 0, left: 0 }}>
      {isDesktop && (
        <div style={{ width: 256, minWidth: 256, height: "100vh", flexShrink: 0, overflow: "hidden" }}>
          <AdminSidebar isOpen={true} onClose={() => {}} badges={badges} isDesktop={true} />
        </div>
      )}
      {!isDesktop && (
        <AdminSidebar isOpen={sidebarOuverte} onClose={() => setSidebarOuverte(false)} badges={badges} isDesktop={false} />
      )}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <AdminHeader currentPageName={currentPageName} onMenuOpen={() => setSidebarOuverte(true)} showBurger={!isDesktop} />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: isDesktop ? "24px" : "12px", boxSizing: "border-box" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
