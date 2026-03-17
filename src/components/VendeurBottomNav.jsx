import React from "react";
import { Link, useLocation } from "react-router-dom";
import { CircleHelp, ClipboardList, House, Package, User } from "lucide-react";
import { createPageUrl } from "@/utils";

const DEFAULT_ITEMS = [
  { label: "Accueil", page: "EspaceVendeur", icon: House },
  { label: "Commandes", page: "MesCommandesVendeur", icon: ClipboardList },
  { label: "Catalogue", page: "CatalogueVendeur", icon: Package },
  { label: "Profil", page: "ProfilVendeur", icon: User },
  { label: "Aide", page: "AideVendeur", icon: CircleHelp },
];

export default function VendeurBottomNav({ items = DEFAULT_ITEMS }) {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="bottom-nav-safe mx-auto grid w-full max-w-screen-md grid-cols-5">
        {items.map(({ label, page, icon: Icon, disabled = false }) => {
          const href = createPageUrl(page);
          const isActive = location.pathname === href;

          if (disabled) {
            return (
              <button
                key={page}
                type="button"
                disabled
                className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium text-muted-foreground/50 sm:text-[11px]"
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{label}</span>
              </button>
            );
          }

          return (
            <Link
              key={page}
              to={href}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors sm:text-[11px] ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`max-w-full truncate ${isActive ? "font-semibold" : "font-medium"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
