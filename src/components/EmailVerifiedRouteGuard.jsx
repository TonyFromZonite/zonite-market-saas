import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/AuthContext';

// Pages publiques (pas de vérification email requise)
const PUBLIC_PAGES = new Set([
  'Connexion',
  'InscriptionVendeur',
  'MotDePasseOublie',
  'ResetPassword',
  'EnAttenteValidation',
]);

// Statut de vérification: 'unknown' | 'verified' | 'unverified' | 'not_seller'
export default function EmailVerifiedRouteGuard({ children }) {
  const { user, isAuthenticated, isAuthReady } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('unknown');

  const currentPath = (location.pathname.replace('/', '') || '').split('/')[0];
  const isPublicPage = PUBLIC_PAGES.has(currentPath);

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

      // Admin (table sous_admins / user_roles 'admin') = exempté du gate seller
      try {
        const adminSession = JSON.parse(localStorage.getItem('admin_session') || 'null');
        if (adminSession?.role === 'admin' || adminSession?.role === 'sous_admin') {
          if (active) setStatus('verified');
          return;
        }

        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();
        if (roleRow?.role === 'admin') {
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
  }, [isAuthReady, isAuthenticated, user?.id, currentPath, isPublicPage]);

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
