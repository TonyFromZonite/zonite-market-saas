import React from "react";
import { Menu } from "lucide-react";
import { LOGO_URL as LOGO } from "@/components/constants";
import NotificationCenter from "@/components/NotificationCenter";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";
import { useResponsive } from "@/hooks/useResponsive";

export default function AdminHeader({ onMenuOpen }) {
  const sousAdmin = getSousAdminSession();
  const adminSession = getAdminSession();
  const { isMobile, width } = useResponsive();

  const roleLabel = adminSession ? "Admin principal" : sousAdmin?.nom_role;

  return (
    <header className="sticky top-0 z-50 flex h-16 min-h-[64px] items-center justify-between border-b border-border bg-background px-4 shadow-sm">
      {/* Left: burger + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          type="button"
          aria-label="Ouvrir le menu admin"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border-none bg-transparent text-foreground hover:bg-accent"
        >
          <Menu size={24} />
        </button>

        <div className="flex items-center gap-2">
          <img
            src={LOGO}
            alt="ZONITE"
            className="h-8 w-8 rounded-lg object-contain"
          />
          {width >= 480 && (
            <span className="text-lg font-bold text-[#1a1f4e]">Zonite Market</span>
          )}
        </div>
      </div>

      {/* Right: notifications + profile */}
      <div className="flex items-center gap-2">
        <NotificationCenter />

        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1f4e] text-sm font-bold text-white">
            A
          </div>
          {width >= 640 && roleLabel && (
            <span className="text-sm font-medium text-foreground">{roleLabel}</span>
          )}
        </div>
      </div>
    </header>
  );
}
