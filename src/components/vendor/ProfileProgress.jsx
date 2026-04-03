import React from "react";
import { useNavigate } from "react-router-dom";

export default function ProfileProgress({ seller, onEditProfile }) {
  const navigate = useNavigate();

  const steps = [
    { label: "Compte créé", done: true, points: 15 },
    { label: "Email vérifié", done: !!seller.email_verified, points: 10 },
    { label: "Ville & quartier", done: !!seller.ville && !!seller.quartier, points: 15, action: "edit" },
    { label: "Numéro WhatsApp", done: !!seller.whatsapp, points: 10, action: "edit" },
    { label: "Mobile Money", done: !!seller.numero_mobile_money, points: 15, action: "edit" },
    { label: "Formation terminée", done: !!seller.training_completed, points: 10, path: "/VideoFormation" },
    { label: "KYC soumis", done: seller.statut_kyc && seller.statut_kyc !== "non_soumis" && seller.statut_kyc !== "en_attente", points: 10, path: "/ResoumissionKYC" },
    { label: "KYC validé", done: seller.statut_kyc === "valide", points: 15 },
  ];

  const totalPoints = steps.reduce((s, i) => s + i.points, 0);
  const earnedPoints = steps.reduce((s, i) => s + (i.done ? i.points : 0), 0);
  const percentage = Math.round((earnedPoints / totalPoints) * 100);

  const getLabel = (pct) => {
    if (pct < 30) return { label: "Débutant 🌱", color: "#3b82f6" };
    if (pct < 60) return { label: "En progression ⭐", color: "#f5a623" };
    if (pct < 100) return { label: "Presque complet 🔥", color: "#f5a623" };
    return { label: "Profil complet 💎", color: "#22c55e" };
  };

  const status = getLabel(percentage);
  const nextStep = steps.find(s => !s.done);

  const handleStepClick = (step) => {
    if (step.action === "edit" && onEditProfile) {
      onEditProfile();
    } else if (step.path) {
      navigate(step.path);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold" style={{ color: status.color }}>{status.label}</span>
        <span className="text-xs font-bold text-slate-600">{percentage}%</span>
      </div>

      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, #3b82f6 0%, ${percentage > 60 ? "#22c55e" : "#f5a623"} 100%)`,
          }} />
      </div>

      <div className="space-y-1.5 mb-3">
        {steps.map((step, i) => (
          <div key={i}
            className={`flex items-center gap-2 text-xs ${!step.done && (step.action || step.path) ? 'cursor-pointer hover:bg-slate-50 rounded-lg px-1 -mx-1 py-0.5' : ''}`}
            onClick={() => !step.done && handleStepClick(step)}
          >
            <span className={step.done ? "text-emerald-500" : "text-slate-300"}>{step.done ? "✅" : "○"}</span>
            <span className={step.done ? "text-slate-500" : "text-slate-700 font-medium"}>{step.label}</span>
            <span className="text-slate-300 ml-auto">+{step.points}pts</span>
          </div>
        ))}
      </div>

      {nextStep && (
        <div className="flex items-center justify-between p-2.5 bg-amber-50 rounded-xl cursor-pointer"
          onClick={() => handleStepClick(nextStep)}>
          <div className="text-xs text-slate-600">
            Prochaine étape : <span className="font-bold text-amber-700">{nextStep.label}</span>
          </div>
          <span className="text-xs text-amber-600 font-semibold">→</span>
        </div>
      )}
    </div>
  );
}
