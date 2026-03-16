import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "./Layout";
import Connexion from "./pages/Connexion";
import InscriptionVendeur from "./pages/InscriptionVendeur";
import TableauDeBord from "./pages/TableauDeBord";
import EspaceVendeur from "./pages/EspaceVendeur";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Pages that need the admin layout wrapper
const adminPages = [
  { path: "TableauDeBord", Component: TableauDeBord },
];

// Pages without admin layout
const standalonePages = [
  { path: "Connexion", Component: Connexion },
  { path: "InscriptionVendeur", Component: InscriptionVendeur },
  { path: "EspaceVendeur", Component: EspaceVendeur },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Default route → Connexion */}
          <Route path="/" element={<Connexion />} />

          {/* Standalone pages (no admin layout) */}
          {standalonePages.map(({ path, Component }) => (
            <Route key={path} path={`/${path}`} element={<Component />} />
          ))}

          {/* Admin pages (with layout) */}
          {adminPages.map(({ path, Component }) => (
            <Route key={path} path={`/${path}`} element={
              <Layout currentPageName={path}>
                <Component />
              </Layout>
            } />
          ))}

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
