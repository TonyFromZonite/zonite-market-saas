import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, FileCheck, Users, Menu } from "lucide-react";
import { useResponsive } from "@/hooks/useResponsive";

const ITEMS = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/TableauDeBord" },
  { label: "Commandes", icon: ShoppingCart, path: "/Commandes" },
  { label: "KYC", icon: FileCheck, path: "/GestionKYC" },
  { label: "Vendeurs", icon: Users, path: "/Vendeurs" },
  { label: "Plus", icon: Menu, action: "openSidebar" },
];

export default function AdminBottomNav({ onOpenSidebar }) {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isMobile) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-white/10 bg-[#1a1f4e] bottom-nav-safe">
      {ITEMS.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;

        return (
          <button
            key={item.label}
            onClick={() => {
              if (item.action === "openSidebar") {
                onOpenSidebar?.();
              } else {
                navigate(item.path);
              }
            }}
            className="flex min-w-[56px] flex-col items-center gap-1 border-none bg-transparent p-2"
            style={{ color: isActive ? "#f5a623" : "rgba(255,255,255,0.6)" }}
          >
            <Icon size={22} />
            <span className="text-[10px]">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
