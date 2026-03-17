import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, LogOut, X } from "lucide-react";
import { LOGO_URL as LOGO } from "@/components/constants";
import { getMenuVisible } from "./adminMenuConfig";
import { getAdminSession, getSousAdminSession, clearAllSessions } from "@/components/useSessionGuard";
import { createPageUrl } from "@/utils";

export default function AdminSidebar({ isOpen, onClose, badges = {}, isMobile = true }) {
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
      {/* Overlay backdrop - mobile only */}
      {isMobile && (
        <div
          className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
            isOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`z-50 flex w-60 min-w-[240px] max-w-[86vw] flex-col bg-[#1a1f4e] text-white transition-transform duration-300 ease-out ${
          isMobile
            ? "fixed left-0 top-16 bottom-0"
            : "fixed left-0 top-16 bottom-0"
        } ${!isOpen ? "-translate-x-full" : "translate-x-0"}`}
      >
        {/* Header with role info */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Zonite" className="h-9 w-9 rounded-lg bg-white/10 p-1 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold tracking-wide">ZONITE</p>
              <p className="truncate text-[11px] text-white/60">
                {sousAdmin ? sousAdmin.nom_role : "Administration"}
              </p>
            </div>
            {isMobile && (
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: "none" }}>
          {menuItems.map((item) => {
            const estActif = currentPage === item.page || location.pathname === `/${item.page}`;
            const Icon = item.icon;
            const badge = item.badge ? badges[item.badge] || 0 : 0;

            return (
              <Link
                key={item.id}
                to={`/${item.page}`}
                onClick={() => {
                  if (isMobile) onClose();
                }}
                className={`flex min-h-[42px] items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  estActif
                    ? "bg-[#f5a623]/20 font-semibold text-[#f5a623]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badge > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : estActif ? (
                  <ChevronRight size={14} className="shrink-0 text-[#f5a623]" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="border-t border-white/10 p-2">
          <button
            type="button"
            onClick={deconnexion}
            className="flex min-h-[42px] w-full items-center gap-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
          >
            <LogOut size={18} className="shrink-0" />
            <span className="truncate">Déconnexion</span>
          </button>
        </div>
      </aside>
    </>
  );
}
