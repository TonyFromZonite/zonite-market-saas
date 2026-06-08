import React from "react";
import { Clock } from "lucide-react";

/**
 * Bannière "KYC en cours de vérification".
 *
 * - variant="banner" (défaut) : bandeau pleine largeur avec bordure basse —
 *   utilisé en tête des pages vendeur (DemandePaiement, MesCommandesVendeur,
 *   ProfilVendeur, BlocageKycPending).
 * - variant="card" : carte arrondie avec marges latérales — utilisée comme
 *   état "en attente" de l'indicateur de statut KYC sur EspaceVendeur.
 *
 * Les deux variantes affichent strictement le même contenu (source unique
 * de vérité du message KYC en attente).
 */
export default function BanniereKycPending({ variant = "banner" }) {
  if (variant === "card") {
    return (
      <div className="mx-4 mt-3 mb-2 p-3 bg-yellow-50 border border-yellow-300 rounded-xl flex items-start gap-3">
        <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-yellow-800 font-bold text-sm">⏳ Statut KYC : En attente de validation</p>
          <p className="text-yellow-700 text-xs mt-0.5">Notre équipe examine votre dossier (24 à 48h).</p>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-yellow-50 border-b-2 border-yellow-300 px-4 py-3 flex items-start gap-3">
      <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-yellow-800 font-bold text-sm">⏳ Vérification en cours</p>
        <p className="text-yellow-700 text-xs mt-0.5">
          Vos documents KYC sont en cours de vérification par notre équipe.
          Vous serez notifié dès que votre compte est activé.
        </p>
        <p className="text-yellow-600 text-xs mt-1 font-medium">Délai habituel : 24 à 48h</p>
      </div>
    </div>
  );
}
