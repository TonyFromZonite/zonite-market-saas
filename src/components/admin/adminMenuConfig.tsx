import {
  LayoutDashboard, ShoppingCart, Package, Users, Truck,
  ClipboardList, Shield, MessageSquare, UserCog, Settings,
  Database, ScrollText, FileCheck, MapPin, Bike, LucideIcon
} from "lucide-react";

export interface AdminMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  page: string;
  roles: string[];
  sousAdminModule?: string;
  badge?: string;
}

export const ADMIN_MENU: AdminMenuItem[] = [
  { id: "dashboard", label: "Tableau de Bord", icon: LayoutDashboard, page: "TableauDeBord", roles: ["admin", "sous_admin"] },
  { id: "nouvelle_vente", label: "Nouvelle Vente", icon: ShoppingCart, page: "NouvelleVente", roles: ["admin", "sous_admin"], sousAdminModule: "NouvelleVente" },
  { id: "commandes_admin", label: "Commandes Admin", icon: ClipboardList, page: "Commandes", roles: ["admin", "sous_admin"], sousAdminModule: "Commandes" },
  { id: "gestion_livraisons", label: "Gestion Livraisons", icon: Truck, page: "GestionCommandes", roles: ["admin", "sous_admin"], sousAdminModule: "GestionCommandes" },
  { id: "commandes_vendeurs", label: "Commandes Vendeurs", icon: ShoppingCart, page: "CommandesVendeurs", roles: ["admin", "sous_admin"], sousAdminModule: "CommandesVendeurs", badge: "commandes" },
  { id: "produits", label: "Produits", icon: Package, page: "Produits", roles: ["admin", "sous_admin"], sousAdminModule: "Produits" },
  { id: "vendeurs", label: "Vendeurs", icon: Users, page: "Vendeurs", roles: ["admin", "sous_admin"], sousAdminModule: "Vendeurs" },
  { id: "kyc", label: "Validation KYC", icon: FileCheck, page: "GestionKYC", roles: ["admin", "sous_admin"], sousAdminModule: "GestionKYC", badge: "kyc" },
  { id: "zones", label: "Zones Livraison", icon: MapPin, page: "GestionZones", roles: ["admin", "sous_admin"], sousAdminModule: "GestionZones" },
  { id: "coursiers", label: "Coursiers", icon: Bike, page: "GestionCoursiers", roles: ["admin", "sous_admin"], sousAdminModule: "GestionCoursiers" },
  { id: "support", label: "Support Vendeurs", icon: MessageSquare, page: "SupportAdmin", roles: ["admin", "sous_admin"], sousAdminModule: "SupportAdmin" },
  { id: "audit", label: "Journal d'Audit", icon: ScrollText, page: "JournalAudit", roles: ["admin"] },
  { id: "audit_complet", label: "Audit & Intégrité", icon: Database, page: "AuditComplet", roles: ["admin"] },
  { id: "permissions", label: "Permissions Admin", icon: Shield, page: "GestionPermissionsAdmin", roles: ["admin"] },
  { id: "sous_admins", label: "Sous-Admins", icon: UserCog, page: "GestionSousAdmins", roles: ["admin"] },
  { id: "config", label: "Configuration App", icon: Settings, page: "ConfigurationApp", roles: ["admin"] },
];

export function getMenuVisible(role: string, permissions: string[] = []): AdminMenuItem[] {
  return ADMIN_MENU.filter((item) => {
    if (role === "admin") return true;
    if (role === "sous_admin") {
      if (item.id === "dashboard") return true;
      if (!item.sousAdminModule) return false;
      return permissions.includes(item.sousAdminModule);
    }
    return false;
  });
}
