import { Suspense, lazy } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const GestionZones = lazy(() => import('./pages/GestionZones'));
const GestionCoursiers = lazy(() => import('./pages/GestionCoursiers'));
const ResoumissionKYC = lazy(() => import('./pages/ResoumissionKYC'));
const ProduitDetail = lazy(() => import('./pages/ProduitDetail'));

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : () => <></>;

const LoadingScreen = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: '#1a1f4e',
    gap: 16,
  }}>
    <div style={{
      width: 48,
      height: 48,
      border: '3px solid rgba(245,197,24,0.3)',
      borderTopColor: '#F5C518',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <LoadingScreen />;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={
          <LayoutWrapper currentPageName={mainPageKey}>
            <MainPage />
          </LayoutWrapper>
        } />
        {Object.entries(Pages).map(([path, Page]) => (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <LayoutWrapper currentPageName={path}>
                <Page />
              </LayoutWrapper>
            }
          />
        ))}
        <Route path="/GestionZones" element={
          <LayoutWrapper currentPageName="GestionZones"><GestionZones /></LayoutWrapper>
        } />
        <Route path="/GestionCoursiers" element={
          <LayoutWrapper currentPageName="GestionCoursiers"><GestionCoursiers /></LayoutWrapper>
        } />
        <Route path="/ResoumissionKYC" element={
          <LayoutWrapper currentPageName="ResoumissionKYC"><ResoumissionKYC /></LayoutWrapper>
        } />
        <Route path="/CatalogueVendeur/:categorieId" element={
          <LayoutWrapper currentPageName="CatalogueVendeur">
            {React.createElement(PAGES.CatalogueVendeur || (() => null))}
          </LayoutWrapper>
        } />
        <Route path="/ProduitDetail/:produitId" element={
          <LayoutWrapper currentPageName="ProduitDetail"><ProduitDetail /></LayoutWrapper>
        } />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
