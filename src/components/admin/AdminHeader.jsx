import React from "react";
import { Menu } from "lucide-react";
import { LOGO_URL as LOGO } from "@/components/constants";
import { ADMIN_MENU } from "./adminMenuConfig";
import NotificationCenter from "@/components/NotificationCenter";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";

export default function AdminHeader({ currentPageName, onMenuOpen, showBurger = false }) {
  const sousAdmin = getSousAdminSession();
  const adminSession = getAdminSession();

  const pageTitle = ADMIN_MENU.find((item) => item.page === currentPageName)?.label || "ZONITE";
  const roleLabel = adminSession ? "Admin principal" : sousAdmin?.nom_role;
  const contextLabel = sousAdmin ? "Espace sous-admin" : "Espace administration";

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-4 md:px-6">
        {showBurger && (
          <button
            onClick={onMenuOpen}
            type="button"
            aria-label="Ouvrir le menu admin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            <Menu size={20} />
          </button>
        )}

        {showBurger && (
          <img
            src={LOGO}
            alt="Zonite"
            className="h-8 w-8 rounded-lg border border-border bg-card p-1 object-contain"
          />
        )}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{pageTitle}</h1>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">{contextLabel}</p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <NotificationCenter />
          {roleLabel && (
            <span className="hidden rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground md:inline-flex">
              {roleLabel}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
