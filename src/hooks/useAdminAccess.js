import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getAdminSession, getSousAdminSession, clearAllSessions } from '@/components/useSessionGuard';

/**
 * Hook that gates admin data access.
 * Returns { isReady, isAdmin, isSousAdmin, isAdminOrSousAdmin }
 *
 * SECURITY: The role is verified SERVER-SIDE via the `has_role` SECURITY DEFINER
 * RPC against the `user_roles` table. localStorage is no longer trusted as the
 * source of truth — a tampered `admin_session` entry has no effect because the
 * RPC re-checks the JWT's `auth.uid()` against the role table.
 */
export default function useAdminAccess() {
  const { isAuthReady, isAuthenticated, user } = useAuth();
  const [state, setState] = useState({
    isReady: false,
    isAdmin: false,
    isSousAdmin: false,
    isAdminOrSousAdmin: false,
    isVerifying: true,
  });

  useEffect(() => {
    let cancelled = false;
    if (!isAuthReady) {
      setState((s) => ({ ...s, isVerifying: true }));
      return;
    }
    if (!isAuthenticated || !user?.id) {
      setState({ isReady: false, isAdmin: false, isSousAdmin: false, isAdminOrSousAdmin: false, isVerifying: false });
      return;
    }

    (async () => {
      try {
        const [adminRes, sousRes] = await Promise.all([
          supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
          supabase.rpc('has_role', { _user_id: user.id, _role: 'sous_admin' }),
        ]);
        if (cancelled) return;
        const isAdmin = adminRes.data === true;
        const isSousAdmin = sousRes.data === true;
        const isAdminOrSousAdmin = isAdmin || isSousAdmin;

        // Self-heal localStorage if it disagrees with the server.
        if (!isAdmin && getAdminSession()) {
          localStorage.removeItem('admin_session');
        }
        if (!isSousAdmin && getSousAdminSession()) {
          localStorage.removeItem('sous_admin');
        }
        if (!isAdminOrSousAdmin && (getAdminSession() || getSousAdminSession())) {
          // Belt-and-braces: clear stale admin caches for non-privileged users.
          clearAllSessions();
        }

        setState({
          isReady: isAdminOrSousAdmin,
          isAdmin,
          isSousAdmin,
          isAdminOrSousAdmin,
          isVerifying: false,
        });
      } catch (_) {
        if (cancelled) return;
        setState({ isReady: false, isAdmin: false, isSousAdmin: false, isAdminOrSousAdmin: false, isVerifying: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, isAuthenticated, user?.id]);

  return state;
}
