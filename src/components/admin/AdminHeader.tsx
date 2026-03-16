import { Menu } from "lucide-react";
import { LOGO_URL as LOGO } from "@/components/constants";
import { ADMIN_MENU } from "./adminMenuConfig";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";

interface AdminHeaderProps {
  currentPageName?: string;
  onMenuOpen?: () => void;
  showBurger?: boolean;
}

export default function AdminHeader({ currentPageName, onMenuOpen, showBurger = false }: AdminHeaderProps) {
  const sousAdmin = getSousAdminSession();
  const adminSession = getAdminSession();

  const pageTitle = ADMIN_MENU.find((i) => i.page === currentPageName)?.label || "ZONITE";

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b bg-white sticky top-0 z-50">
      <div className="flex items-center gap-3">
        {showBurger && (
          <button onClick={onMenuOpen} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
        )}
        <img src={LOGO} alt="Zonite" className="h-8 w-8 rounded-full object-cover" />
        <h1 className="text-lg font-bold" style={{ color: "#1a1f5e" }}>{pageTitle}</h1>
      </div>
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {sousAdmin ? (
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">Sous-Admin</span>
        ) : adminSession ? (
          <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs font-medium">Admin</span>
        ) : null}
      </div>
    </header>
  );
}
