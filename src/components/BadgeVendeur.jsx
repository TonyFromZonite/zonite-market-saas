import React from "react";

const BADGES = {
  nouveau:  { label: "Nouveau",  emoji: "🌱", color: "bg-slate-100 text-slate-700", min: 0 },
  etoile:   { label: "Étoile",   emoji: "⭐", color: "bg-yellow-100 text-yellow-700", min: 5 },
  bronze:   { label: "Bronze",   emoji: "🥉", color: "bg-orange-100 text-orange-700", min: 15 },
  argent:   { label: "Argent",   emoji: "🥈", color: "bg-slate-200 text-slate-700", min: 30 },
  or:       { label: "Or",       emoji: "🥇", color: "bg-amber-100 text-amber-700", min: 60 },
  diamant:  { label: "Diamant",  emoji: "💎", color: "bg-blue-100 text-blue-700", min: 100 },
};

const BADGE_ORDER = ["nouveau", "etoile", "bronze", "argent", "or", "diamant"];

export function getBadgeForVentes(totalVentes) {
  let badge = "nouveau";
  for (const key of BADGE_ORDER) {
    if (totalVentes >= BADGES[key].min) badge = key;
  }
  return badge;
}

export function getNextBadge(currentBadge) {
  const idx = BADGE_ORDER.indexOf(currentBadge);
  if (idx < BADGE_ORDER.length - 1) return BADGE_ORDER[idx + 1];
  return null;
}

export function getBadgeInfo(badge) {
  return BADGES[badge] || BADGES.nouveau;
}

export default function BadgeVendeur({ badge, size = "md" }) {
  const info = getBadgeInfo(badge);
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : size === "lg" ? "text-sm px-4 py-1.5" : "text-xs px-3 py-1";
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${info.color} ${sizeClass}`}>
      {info.emoji} {info.label}
    </span>
  );
}

export function BadgeProgression({ totalVentes, currentBadge }) {
  const current = getBadgeInfo(currentBadge);
  const nextKey = getNextBadge(currentBadge);

  if (!nextKey) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-3 border border-blue-100">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">💎</span>
          <span className="text-sm font-bold text-blue-700">Niveau maximum atteint !</span>
        </div>
        <p className="text-xs text-blue-600/70">Félicitations, vous êtes au sommet 🏆</p>
      </div>
    );
  }

  const next = getBadgeInfo(nextKey);
  const progress = Math.min(100, ((totalVentes - current.min) / (next.min - current.min)) * 100);
  const remaining = next.min - totalVentes;

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{current.emoji}</span>
          <span className="text-sm font-semibold text-slate-900">{current.label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400">→</span>
          <span className="text-lg">{next.emoji}</span>
          <span className="text-xs text-slate-500">{next.label}</span>
        </div>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #f5a623, #e8940f)' }} />
      </div>
      <p className="text-[10px] text-slate-400 mt-1.5">
        Encore {remaining} livraison{remaining > 1 ? 's' : ''} pour atteindre {next.emoji} {next.label}
      </p>
    </div>
  );
}
