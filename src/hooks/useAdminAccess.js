import { useMemo } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getAdminSession, getSousAdminSession } from '@/components/useSessionGuard';

/**
 * Hook that gates admin data access.
 * Returns { isReady, isAdmin, isSousAdmin, isAdminOrSousAdmin }
 * 
 * `isReady` is true only when:
 *  1. Supabase auth is fully initialized (isAuthReady)
 *  2. A valid localStorage admin/sous_admin session exists
 * 
 * Use `isReady` as the `enabled` flag for admin queries.
 */
export default function useAdminAccess() {
  const { isAuthReady, isAuthenticated } = useAuth();

  return useMemo(() => {
    if (!isAuthReady || !isAuthenticated) {
      return { isReady: false, isAdmin: false, isSousAdmin: false, isAdminOrSousAdmin: false };
    }
    const admin = getAdminSession();
    const sousAdmin = getSousAdminSession();
    const isAdmin = !!admin && admin.role === 'admin';
    const isSousAdmin = !!sousAdmin;
    const isAdminOrSousAdmin = isAdmin || isSousAdmin;

    return {
      isReady: isAdminOrSousAdmin,
      isAdmin,
      isSousAdmin,
      isAdminOrSousAdmin,
    };
  }, [isAuthReady, isAuthenticated]);
}
