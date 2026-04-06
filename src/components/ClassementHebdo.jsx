import React from "react";
import { Link } from "react-router-dom";
import BadgeVendeur from "./BadgeVendeur";

export default function ClassementHebdo({ topVendeurs, currentVendeurId }) {
  if (!topVendeurs || topVendeurs.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-4">Aucune vente cette semaine</p>;
  }

  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const medals = ['🥇', '🥈', '🥉'];
  const prizes = ['10 000 FCFA', '5 000 FCFA', '3 000 FCFA'];

  // Show top 10 instead of top 3
  const top10 = topVendeurs.slice(0, 10);

  return (
    <div className="space-y-2">
      {/* Prizes banner for top 3 */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-3 mb-3">
        <p className="text-xs font-bold text-amber-800 mb-1.5">🏆 Prix hebdomadaires</p>
        <div className="flex gap-3">
          {prizes.map((p, i) => (
            <div key={i} className="text-center flex-1">
              <span className="text-xl">{medals[i]}</span>
              <p className="text-[10px] font-bold text-amber-700">{p}</p>
            </div>
          ))}
        </div>
      </div>

      {top10.map((v, i) => {
        const isCurrent = v.vendeur_id === currentVendeurId;
        const isTop3 = i < 3;
        return (
          <div
            key={v.vendeur_id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              isCurrent ? 'bg-amber-50 border border-amber-200' :
              isTop3 ? 'bg-slate-50' : 'bg-white border border-slate-100'
            }`}
          >
            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
              {isTop3 ? (
                <span className="text-2xl">{medals[i]}</span>
              ) : (
                <span className="text-sm font-bold text-slate-400">#{i + 1}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-900 truncate">
                {v.full_name || 'Vendeur'}
                {isCurrent && ' ⭐'}
              </p>
              <p className="text-xs text-slate-500">CA : {formater(v.total)}</p>
            </div>
            <div className="flex items-center gap-2">
              {isCurrent && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Vous</span>
              )}
              {isTop3 && (
                <span className="text-[10px] text-amber-600 font-semibold">{prizes[i]}</span>
              )}
            </div>
          </div>
        );
      })}

      {/* Encouragement message if current vendor is not in the list */}
      {currentVendeurId && !top10.some(v => v.vendeur_id === currentVendeurId) && (
        <div className="animate-fade-in bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-xl p-4 mt-3 text-center shadow-sm hover-scale">
          <div className="text-2xl mb-1 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">💪🔥</div>
          <p className="text-sm font-bold text-blue-800">Tu n'es pas encore dans le top 10</p>
          <p className="text-xs text-blue-600 mt-1">Chaque vente te rapproche du classement et des prix hebdomadaires !</p>
          <Link to="/CatalogueVendeur" className="mt-2 inline-block bg-blue-600 text-white text-xs font-bold px-4 py-1.5 rounded-full hover-scale shadow-sm">
            🚀 Voir le catalogue
          </Link>
        </div>
      )}
    </div>
  );
}
