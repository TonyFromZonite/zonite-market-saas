import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import VendeurBottomNav from "@/components/VendeurBottomNav";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getVendeurSession, getSousAdminSession, getAdminSession } from "@/components/useSessionGuard";
import { getMenuVisible } from "@/components/admin/adminMenuConfig";

const PAGES_VENDEUR = new Set([
  "EspaceVendeur", "InscriptionVendeur", "VideoFormation", "CatalogueVendeur",
  "NouvelleCommandeVendeur", "MesCommandesVendeur", "ProfilVendeur",
  "DemandePaiement", "NotificationsVendeur", "AideVendeur",
  "EnAttenteValidation", "ResoumissionKYC", "FormationCours", "ProduitDetail",
]);

const PAGES_SANS_LAYOUT_ADMIN = new Set([
  "Connexion",
  "EspaceSousAdmin",
  ...PAGES_VENDEUR,
]);

const DESKTOP_BP = 1024;

function useResponsive() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.innerWidth >= DESKTOP_BP
  );

  useEffect(() => {
    let rafId;
    const check = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setIsDesktop(window.innerWidth >= DESKTOP_BP));
    };
    window.addEventListener("resize", check);
    check();
    return () => {
      window.removeEventListener("resize", check);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return isDesktop;
}

export default function Layout({ children, currentPageName }) {
  const [sidebarOuverte, setSidebarOuverte] = useState(false);
  const [badges, setBadges] = useState({ commandes: 0, kyc: 0 });
  const vendeurSession = getVendeurSession();
  const isDesktop = useResponsive();

  // Close mobile sidebar when switching to desktop
  useEffect(() => {
    if (isDesktop) setSidebarOuverte(false);
  }, [isDesktop]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (!isDesktop && sidebarOuverte) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isDesktop, sidebarOuverte]);

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

  // Skip admin layout for vendor pages or login
  const isVendorPage = PAGES_VENDEUR.has(currentPageName) || vendeurSession;
  if (PAGES_SANS_LAYOUT_ADMIN.has(currentPageName) || vendeurSession) {
    if (isVendorPage) {
      return (
        <>
          <div style={{ paddingBottom: 64 }}>{children}</div>
          <VendeurBottomNav />
        </>
      );
    }
    return <>{children}</>;
  }

  // Route-level protection for sous_admins
  const sousAdmin = getSousAdminSession();
  const adminSession = getAdminSession();
  if (sousAdmin && !adminSession) {
    const allowedPages = getMenuVisible("sous_admin", sousAdmin.permissions || []).map(m => m.page);
    if (!allowedPages.includes(currentPageName)) {
      return (
        <div className="min-h-dvh w-full bg-slate-50 lg:flex">
          <AdminSidebar isOpen={isDesktop ? true : sidebarOuverte} onClose={() => setSidebarOuverte(false)} badges={badges} isDesktop={isDesktop} />
          <div className="flex min-w-0 flex-1 flex-col">
            <AdminHeader currentPageName={currentPageName} onMenuOpen={() => setSidebarOuverte(true)} showBurger={!isDesktop} />
            <main className="flex-1 flex items-center justify-center p-4">
              <div className="text-center space-y-3">
                <div className="text-5xl">🔒</div>
                <h2 className="text-xl font-bold text-slate-800">Accès non autorisé</h2>
                <p className="text-sm text-slate-500">Vous n'avez pas la permission d'accéder à ce module.</p>
              </div>
            </main>
          </div>
        </div>
      );
    }
  }

  const handleMenuOpen = useCallback(() => setSidebarOuverte(true), []);
  const handleMenuClose = useCallback(() => setSidebarOuverte(false), []);

  return (
    <div className="min-h-dvh w-full bg-slate-50 lg:flex">
      {/* Desktop sidebar — always rendered, hidden via CSS below lg */}
      <AdminSidebar
        isOpen={isDesktop ? true : sidebarOuverte}
        onClose={handleMenuClose}
        badges={badges}
        isDesktop={isDesktop}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminHeader
          currentPageName={currentPageName}
          onMenuOpen={handleMenuOpen}
          showBurger={!isDesktop}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden p-2 sm:p-3 md:p-4 lg:p-4 max-w-screen-2xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
