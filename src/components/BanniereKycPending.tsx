import { Clock } from "lucide-react";

export default function BanniereKycPending() {
  return (
    <div className="bg-yellow-50 border-y border-yellow-100 px-4 py-3 flex items-center gap-3">
      <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-yellow-800">⏳ Vérification en cours</p>
        <p className="text-xs text-yellow-700">
          Vos documents KYC sont en cours de vérification par notre équipe.
          Vous serez notifié dès que votre compte est activé.
        </p>
        <p className="text-xs text-yellow-600 mt-1">Délai habituel : 24 à 48h</p>
      </div>
    </div>
  );
}
