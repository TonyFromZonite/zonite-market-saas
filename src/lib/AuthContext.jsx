import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'zonite', public_settings: {} });
  const prevUserId = useRef(null);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            role: session.user.user_metadata?.role || 'user',
            full_name: session.user.user_metadata?.full_name || '',
          });
          setIsAuthenticated(true);
          prevUserId.current = session.user.id;
        } else {
          setUser(null);
          setIsAuthenticated(false);
          prevUserId.current = null;
        }
      } catch (error) {
        console.error('Auth init failed:', error);
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        if (mounted) {
          setIsAuthReady(true);
          setIsLoadingAuth(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          role: session.user.user_metadata?.role || 'user',
          full_name: session.user.user_metadata?.full_name || '',
        });
        setIsAuthenticated(true);
        // Invalidate queries when user changes
        if (prevUserId.current && prevUserId.current !== session.user.id) {
          queryClientInstance.invalidateQueries();
        }
        prevUserId.current = session.user.id;
      } else {
        setUser(null);
        setIsAuthenticated(false);
        prevUserId.current = null;
      }
      if (!isAuthReady) {
        setIsAuthReady(true);
        setIsLoadingAuth(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("vendeur_session");
    localStorage.removeItem("admin_session");
    localStorage.removeItem("sous_admin");
    queryClientInstance.clear();
    await supabase.auth.signOut();
    if (shouldRedirect) window.location.href = '/Connexion';
  };

  const navigateToLogin = () => {
    window.location.href = '/Connexion';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated,
      isAuthReady,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email,
            role: session.user.user_metadata?.role || 'user',
            full_name: session.user.user_metadata?.full_name || '',
          });
          setIsAuthenticated(true);
        }
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
