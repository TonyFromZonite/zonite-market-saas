import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, X, LogOut } from "lucide-react";
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

  const identityLabel = sousAdmin?.nom_complet || sousAdmin?.full_name || sousAdmin?.email || "Administrateur Principal";

  return (
    <>
      {!isDesktop && isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-label="Fermer le menu"
        />
      )}

      <aside
        className={
          isDesktop
            ? "hidden h-dvh w-64 shrink-0 flex-col bg-[#1a1f5e] text-white lg:flex"
            : `fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[18rem] flex-col bg-[#1a1f5e] text-white shadow-2xl transition-transform duration-300 lg:hidden ${
                isOpen ? "translate-x-0" : "-translate-x-full"
              }`
        }
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <img
            src={LOGO}
            alt="Zonite"
            className="h-9 w-9 rounded-lg bg-white p-0.5 object-contain"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">ZONITE</div>
            <div className="truncate text-[10px] font-semibold tracking-[0.2em] text-[#F5C518]">
              {sousAdmin ? sousAdmin.nom_role?.toUpperCase() : "GESTION"}
            </div>
          </div>
          {!isDesktop && (
            <button
              onClick={onClose}
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {(adminSession || sousAdmin) && (
          <div className="border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F5C518]">Connecté</div>
            <div className="truncate text-sm font-medium text-white">{identityLabel}</div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-3">
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
                className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  estActif
                    ? "bg-[#F5C518] font-semibold text-[#1a1f5e]"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${estActif ? "text-[#1a1f5e]" : "text-slate-300"}`} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badge > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
                {estActif && badge === 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-2">
          <button
            onClick={deconnexion}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}
