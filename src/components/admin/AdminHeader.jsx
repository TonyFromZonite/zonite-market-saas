import React from "react";
import { Menu } from "lucide-react";
import { LOGO_URL as LOGO } from "@/components/constants";
import { ADMIN_MENU } from "./adminMenuConfig";
import NotificationCenter from "@/components/NotificationCenter";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";

export default function AdminHeader({ currentPageName, onMenuOpen, showBurger = false }) {
  const sousAdmin = getSousAdminSession();
  const adminSession = getAdminSession();
  const pageTitle = ADMIN_MENU.find((i) => i.page === currentPageName)?.label || "ZONITE";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 shrink-0">
      <div className="flex min-h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
        {showBurger && (
          <button
            onClick={onMenuOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 lg:hidden shrink-0"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {showBurger && (
          <img
            src={LOGO}
            alt="Zonite"
            className="h-8 w-8 rounded-lg object-contain lg:hidden shrink-0"
          />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-slate-900 sm:text-base">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationCenter />
          {adminSession && (
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">
              Admin Principal
            </span>
          )}
          {sousAdmin && (
            <span className="hidden max-w-[180px] truncate rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline-flex">
              {sousAdmin.nom_role}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
