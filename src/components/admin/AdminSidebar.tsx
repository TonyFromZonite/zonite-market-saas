import { Link, useLocation } from "react-router-dom";
import { ChevronRight, X, LogOut } from "lucide-react";
import { LOGO_URL as LOGO } from "@/components/constants";
import { getMenuVisible } from "./adminMenuConfig";
import { getAdminSession, getSousAdminSession, clearAllSessions } from "@/components/useSessionGuard";
import { createPageUrl } from "@/utils";

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  badges?: Record<string, number>;
  isDesktop?: boolean;
}

export default function AdminSidebar({ isOpen, onClose, badges = {}, isDesktop = false }: AdminSidebarProps) {
  const location = useLocation();
  const sousAdmin = getSousAdminSession();
  const adminSession = getAdminSession();

  const role = sousAdmin ? "sous_admin" : "admin";
  const permissions = (sousAdmin?.permissions as string[]) || [];
  const menuItems = getMenuVisible(role, permissions);

  const deconnexion = () => {
    clearAllSessions();
    window.location.href = createPageUrl("Connexion");
  };

  const currentPage = location.pathname.replace("/", "");

  const sidebarStyle: React.CSSProperties = isDesktop
    ? {
        width: 256,
        height: "100vh",
        background: "#1a1f5e",
        color: "white",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }
    : {
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: 256,
        height: "100vh",
        background: "#1a1f5e",
        color: "white",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s ease",
      };

  return (
    <>
      {!isDesktop && isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-[199]"
        />
      )}
      <aside style={sidebarStyle}>
        {/* Logo + titre */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src={LOGO} alt="Zonite" className="h-9 w-9 rounded-full object-cover" />
            <div>
              <div className="font-bold text-sm">ZONITE</div>
              <div className="text-[10px] opacity-60">{role === 'admin' ? 'Administration' : 'Sous-Admin'}</div>
            </div>
          </div>
          {!isDesktop && (
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Menu items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.page;
            const badgeCount = item.badge ? badges[item.badge] || 0 : 0;

            return (
              <Link
                key={item.id}
                to={createPageUrl(item.page)}
                onClick={() => !isDesktop && onClose()}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-white/15 text-[#F5C518] font-semibold border-r-3 border-[#F5C518]"
                    : "text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {badgeCount}
                  </span>
                )}
                <ChevronRight className={`h-3 w-3 opacity-0 ${isActive ? 'opacity-100' : 'group-hover:opacity-100'} transition-opacity`} />
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4">
          <div className="text-xs opacity-60 mb-2">
            {adminSession?.nom_complet || sousAdmin?.nom_complet || 'Administrateur'}
          </div>
          <button
            onClick={deconnexion}
            className="flex items-center gap-2 text-sm text-red-300 hover:text-red-200 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
}
