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
  // En plus du tick de revalidation, on lance immédiatement un re-fetch
  // dédié de `sellers.email_verified` pour bypasser tout cache et mettre
  // l'état à jour sans attendre le cycle d'effet.
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
          // Mise à jour optimiste immédiate : on débloque l'UI tout de suite.
          setStatus('verified');
        }
      } catch (e) {
        console.warn('[Guard] re-fetch email_verified threw:', e);
      }
    };

    const handler = async () => {
      setStatus('unknown');
      // 1) Re-fetch immédiat ciblé (source de vérité serveur).
      await refetchEmailVerified();
      // 2) Tick pour relancer la vérification complète (rôles + seller).
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
