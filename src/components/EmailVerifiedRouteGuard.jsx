import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/AuthContext';

// Pages publiques (pas de vérification email requise)
// Inclut: pages d'auth (login/inscription/reset), pages d'erreur, page d'attente,
// page de configuration initiale du mot de passe admin, et page racine "/".
const PUBLIC_PAGES = new Set([
  '',                            // route racine "/"
  'Connexion',
  'InscriptionVendeur',
  'MotDePasseOublie',
  'ResetPassword',
  'EnAttenteValidation',
  'ConfigurationAdminPassword',  // setup initial du mot de passe admin
  'ResoumissionKYC',             // accessible aux comptes en re-soumission
  'NotFound',
  '404',
]);

// Statut de vérification: 'unknown' | 'verified' | 'unverified' | 'not_seller'
export default function EmailVerifiedRouteGuard({ children }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('unknown');

  const currentPath = (location.pathname.replace('/', '') || '').split('/')[0];
  const isPublicPage = PUBLIC_PAGES.has(currentPath);

  // Compteur incrémenté pour forcer une revalidation immédiate (ex: après OTP).
  const [revalidateTick, setRevalidateTick] = useState(0);

  // Écoute l'évènement émis par useEmailVerification après un succès d'OTP,
  // ainsi qu'un évènement générique pour rafraîchir manuellement le gate.
  // Filtre strict : on ignore tout évènement provenant d'une autre session
  // vendeur (autre user_id) pour éviter les redirections incorrectes en
  // contexte multi-onglets / multi-comptes.
  useEffect(() => {
    const refetchEmailVerified = async () => {
      try {
        if (!user?.id) return;
        const { data, error } = await supabase
          .from('sellers')
          .select('email_verified')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) {
          console.warn('[Guard] re-fetch email_verified failed:', error);
          return;
        }
        if (data?.email_verified === true) {
          setStatus('verified');
        }
      } catch (e) {
        console.warn('[Guard] re-fetch email_verified threw:', e);
      }
    };

    const handler = async (event) => {
      const detail = event?.detail || {};
      const evtUserId = detail.userId || null;
      const evtSellerId = detail.sellerId || null;

      // Si l'évènement précise un userId, il DOIT correspondre à la session
      // courante. Sinon on ignore (évènement provenant d'une autre session).
      if (evtUserId && user?.id && evtUserId !== user.id) {
        return;
      }

      // Si seul sellerId est fourni, on le confronte au seller courant via RPC.
      if (!evtUserId && evtSellerId && user?.id) {
        try {
          const { data: currentSellerId } = await supabase.rpc(
            'get_seller_id_for_user',
            { _user_id: user.id }
          );
          if (currentSellerId && currentSellerId !== evtSellerId) {
            return;
          }
        } catch (e) {
          // En cas d'échec RPC, on reste prudent : on ne bloque pas la
          // revalidation (fail-open), mais on log.
          console.warn('[Guard] sellerId match RPC failed:', e);
        }
      }

      setStatus('unknown');
      await refetchEmailVerified();
      setRevalidateTick((t) => t + 1);
    };
    window.addEventListener('zonite:email-verified', handler);
    window.addEventListener('zonite:revalidate-access', handler);
    return () => {
      window.removeEventListener('zonite:email-verified', handler);
      window.removeEventListener('zonite:revalidate-access', handler);
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!isAuthReady) return;
      if (isPublicPage) {
        setStatus('verified');
        return;
      }
      if (!isAuthenticated || !user?.id) {
        // Laisser AuthenticatedApp gérer la redirection vers login
        setStatus('verified');
        return;
      }

      // Exemption admin/sous-admin : on s'appuie UNIQUEMENT sur la table
      // Supabase `user_roles` (vérifiée côté serveur via RLS + SECURITY DEFINER).
      // On n'utilise PAS localStorage qui peut être manipulé par un attaquant.
      try {
        const { data: roleRows, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('EmailVerifiedRouteGuard: roles fetch failed', rolesError);
        }

        const roles = (roleRows || []).map((r) => r.role);
        if (roles.includes('admin') || roles.includes('sous_admin')) {
          if (active) setStatus('verified');
          return;
        }

        const { data: seller } = await supabase
          .from('sellers')
          .select('email_verified, seller_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!active) return;
        if (!seller) {
          setStatus('not_seller');
          return;
        }
        setStatus(seller.email_verified === true ? 'verified' : 'unverified');
      } catch (e) {
        console.error('EmailVerifiedRouteGuard error:', e);
        if (active) setStatus('verified'); // fail-open pour ne pas bloquer en cas d'erreur réseau
      }
    };
    check();
    return () => {
      active = false;
    };
  }, [isAuthReady, isAuthenticated, user?.id, currentPath, isPublicPage, revalidateTick]);

  useEffect(() => {
    if (status === 'unverified' && !isPublicPage) {
      navigate('/InscriptionVendeur?verify=1', { replace: true });
    }
  }, [status, isPublicPage, navigate]);

  if (isPublicPage) return children;
  if (status === 'unknown') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#1a1f4e', color: '#F5C518',
      }}>
        Vérification de votre compte…
      </div>
    );
  }
  if (status === 'unverified') return null; // redirection en cours
  return children;
}
