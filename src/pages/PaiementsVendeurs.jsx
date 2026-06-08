// DEPRECATED — Cette page était un clone à 100% de l'onglet "Paiements" de
// /Vendeurs (composant PaiementsTab). Elle est désormais une simple redirection
// pour éviter la double maintenance et les doubles notifications vendeur.
// Toute logique d'approbation/rejet de paiement vit dans src/pages/Vendeurs.jsx.
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function PaiementsVendeurs() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/Vendeurs?onglet=paiements", { replace: true });
  }, [navigate]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-slate-500 text-sm">
      Redirection vers la gestion des paiements…
    </div>
  );
}
