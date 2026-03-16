/**
 * Session management module.
 * Source of truth for all session checks in the app.
 * Sessions stored in sessionStorage:
 * - "admin_session" → main admin
 * - "sous_admin" → sub-administrator
 * - "vendeur_session" → vendor
 */

import { createPageUrl } from "@/utils";

export interface SessionData {
  id?: string;
  email?: string;
  nom_complet?: string;
  role?: string;
  seller_status?: string;
  permissions?: string[];
  [key: string]: unknown;
}

export function getAdminSession(): SessionData | null {
  try {
    const data = sessionStorage.getItem("admin_session");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'admin' ? parsed : null;
  } catch { return null; }
}

export function getSousAdminSession(): SessionData | null {
  try {
    const data = sessionStorage.getItem("sous_admin");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'sous_admin' ? parsed : null;
  } catch { return null; }
}

export function getVendeurSession(): SessionData | null {
  try {
    const data = sessionStorage.getItem("vendeur_session");
    if (!data) return null;
    const parsed = JSON.parse(data);
    return parsed?.role === 'vendeur' ? parsed : null;
  } catch { return null; }
}

export function getActiveSession(): { type: string; data: SessionData } | null {
  const admin = getAdminSession();
  if (admin) return { type: 'admin', data: admin };
  const sousAdmin = getSousAdminSession();
  if (sousAdmin) return { type: 'sous_admin', data: sousAdmin };
  const vendeur = getVendeurSession();
  if (vendeur) return { type: 'vendeur', data: vendeur };
  return null;
}

export function requireAdminOrSousAdmin(): boolean {
  const admin = getAdminSession();
  const sousAdmin = getSousAdminSession();
  if (!admin && !sousAdmin) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

export function requireVendeurSession(): boolean {
  const vendeur = getVendeurSession();
  if (!vendeur) {
    window.location.href = createPageUrl("Connexion");
    return false;
  }
  return true;
}

export function hasPermission(sousAdminData: SessionData | null, page: string): boolean {
  if (!page) return false;
  if (getAdminSession()) return true;
  if (!sousAdminData) return false;
  return (sousAdminData.permissions || []).includes(page);
}

export function clearAllSessions(): void {
  sessionStorage.removeItem("admin_session");
  sessionStorage.removeItem("sous_admin");
  sessionStorage.removeItem("vendeur_session");
}
