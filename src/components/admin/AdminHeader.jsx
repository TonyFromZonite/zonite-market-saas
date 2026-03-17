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
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="flex min-h-14 items-center gap-2 px-3 sm:px-4 lg:px-6">
        {showBurger && (
          <button
            onClick={onMenuOpen}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}

        {showBurger && (
          <img
            src={LOGO}
            alt="Zonite"
            className="h-8 w-8 rounded-lg object-contain lg:hidden"
          />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationCenter />
          {adminSession && (
            <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-semibold text-foreground/80 sm:inline-flex">
              Admin Principal
            </span>
          )}
          {sousAdmin && (
            <span className="hidden max-w-[180px] truncate rounded-full bg-accent px-3 py-1 text-xs font-semibold text-foreground/80 sm:inline-flex">
              {sousAdmin.nom_role}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
