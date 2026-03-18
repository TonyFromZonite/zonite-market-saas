import React from "react";

export default function TopVendeurs({ vendeurs }) {
  // Use correct DB fields: seller_status, full_name, total_commissions_gagnees
  const top5 = [...vendeurs]
    .filter(v => v.seller_status === 'active_seller' && v.role !== 'admin')
    .sort((a, b) => (b.total_commissions_gagnees || 0) - (a.total_commissions_gagnees || 0))
    .slice(0, 5);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Vendeurs</h3>
      <div className="space-y-3">
        {top5.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-6">Aucune donnée</p>
        )}
        {top5.map((vendeur, i) => (
          <div key={vendeur.id} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              i === 0 ? "bg-yellow-500" :
              i === 1 ? "bg-blue-500" :
              "bg-slate-400"
            }`}>
              {vendeur.full_name?.[0]?.toUpperCase() || "V"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{vendeur.full_name}</p>
              <p className="text-xs text-slate-500">
                Solde : {(vendeur.solde_commission || 0).toLocaleString("fr-FR")} FCFA
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-700">
              {(vendeur.total_commissions_gagnees || 0).toLocaleString("fr-FR")} FCFA
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
