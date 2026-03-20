import React from "react";
import { Progress } from "@/components/ui/progress";

export default function ObjectifMensuel({ ventesCount, objectif = 10 }) {
  const progress = Math.min(100, (ventesCount / objectif) * 100);
  const atteint = ventesCount >= objectif;

  return (
    <div className={`rounded-xl p-3 shadow-sm ${atteint ? 'bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{atteint ? '🏆' : '🎯'}</span>
          <span className="text-sm font-semibold text-slate-900">Objectif mensuel</span>
        </div>
        <span className={`text-xs font-bold ${atteint ? 'text-emerald-600' : 'text-slate-500'}`}>
          {ventesCount}/{objectif}
        </span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progress}%`,
            background: atteint
              ? 'linear-gradient(90deg, #22c55e, #16a34a)'
              : 'linear-gradient(90deg, #f5a623, #e8940f)',
          }}
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5">
        {atteint
          ? `✅ Objectif atteint ! Bravo ! 🎉`
          : `Encore ${objectif - ventesCount} vente${objectif - ventesCount > 1 ? 's' : ''} pour atteindre votre objectif`
        }
      </p>
    </div>
  );
}
