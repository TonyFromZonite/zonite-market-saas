import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, LogOut, X } from "lucide-react";
import { LOGO_URL as LOGO } from "@/components/constants";
import { getMenuVisible } from "./adminMenuConfig";
import { getAdminSession, getSousAdminSession, clearAllSessions } from "@/components/useSessionGuard";
import { createPageUrl } from "@/utils";

export default function AdminSidebar({ isOpen, onClose, badges = {}, isDesktop = false }) {
  const location = useLocation();
  const sousAdmin = getSousAdminSession();
  const adminSession = getAdminSession();

  const role = sousAdmin ? "sous_admin" : "admin";
  const permissions = sousAdmin?.permissions || [];
  const menuItems = getMenuVisible(role, permissions);
  const currentPage = location.pathname.replace("/", "");

  const deconnexion = () => {
    clearAllSessions();
    window.location.href = createPageUrl("Connexion");
  };

  return (
    <>
      {!isDesktop && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className={`fixed inset-0 z-40 bg-foreground/40 transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={onClose}
        />
      )}

      <aside
        className={`z-50 flex h-screen w-[17rem] max-w-[86vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl transition-transform duration-300 ease-out ${
          isDesktop ? "sticky top-0 shrink-0 translate-x-0" : "fixed inset-y-0 left-0"
        } ${!isDesktop && !isOpen ? "-translate-x-full" : "translate-x-0"}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <img
            src={LOGO}
            alt="Zonite"
            className="h-10 w-10 rounded-xl bg-sidebar-primary-foreground p-1 object-contain"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold tracking-wide text-sidebar-foreground">ZONITE</p>
            <p className="truncate text-[11px] font-medium text-sidebar-foreground/70">
              {sousAdmin ? sousAdmin.nom_role : "Administration"}
            </p>
          </div>

          {!isDesktop && (
            <button
              type="button"
              aria-label="Fermer le menu admin"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {(adminSession || sousAdmin) && (
          <div className="border-b border-sidebar-border px-4 py-3">
            <div className="rounded-xl bg-sidebar-accent px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Connecté en tant que
              </p>
              <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                {sousAdmin ? sousAdmin.nom_complet : "Administrateur principal"}
              </p>
            </div>
          </div>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {menuItems.map((item) => {
            const estActif = currentPage === item.page || location.pathname === `/${item.page}`;
            const Icon = item.icon;
            const badge = item.badge ? badges[item.badge] || 0 : 0;

            return (
              <Link
                key={item.id}
                to={`/${item.page}`}
                onClick={() => {
                  if (!isDesktop) onClose();
                }}
                className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                  estActif
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                {badge > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-destructive-foreground">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : estActif ? (
                  <ChevronRight size={14} className="shrink-0" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={deconnexion}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="truncate">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}
