import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function WelcomeWizard({ seller, onComplete }) {
  const [step, setStep] = useState(1);
  const navigate = useNavigate();

  const completeWizard = async () => {
    try {
      const filter = seller.id || seller.user_id;
      const col = seller.id ? "id" : "user_id";
      const { error } = await supabase.from("sellers").update({ wizard_completed: true }).eq(col, filter);
      if (error) console.error("WelcomeWizard: échec update wizard_completed", error);
    } catch (err) {
      console.error("WelcomeWizard: exception update wizard_completed", err);
    }
    const session = JSON.parse(localStorage.getItem("vendeur_session") || "{}");
    localStorage.setItem("vendeur_session", JSON.stringify({ ...session, wizard_completed: true }));
    onComplete();
  };

  const steps = [
    {
      icon: "👋",
      title: `Bienvenue ${seller.full_name?.split(" ")[0] || ""} !`,
      subtitle: "Vous faites partie de ZONITE Market",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Vendez des produits de qualité au Cameroun sans stock, sans investissement.
          </p>
          <div className="space-y-2">
            {[
              { icon: "📦", text: "Produits disponibles" },
              { icon: "🚀", text: "Livraison gérée par ZONITE" },
              { icon: "💰", text: "Commission sur chaque vente" },
              { icon: "📱", text: "Tout depuis votre téléphone" },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 p-2.5 bg-white/5 rounded-xl">
                <span className="text-lg">{item.icon}</span>
                <span className="text-white text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      icon: "🎓",
      title: "Débloquez le catalogue",
      subtitle: "Une formation de 6 minutes",
      content: (
        <div className="space-y-4">
          <p className="text-slate-300 text-sm leading-relaxed">
            Regardez la vidéo de formation pour débloquer l'accès au catalogue et commencer à vendre !
          </p>
          <div className="flex justify-center gap-6 py-3">
            {[
              { num: "6", label: "minutes" },
              { num: "1×", label: "une seule fois" },
              { num: "∞", label: "commissions" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[#F5C518] text-2xl font-black">{s.num}</p>
                <p className="text-slate-400 text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => { completeWizard(); navigate("/VideoFormation"); }}
            className="w-full py-3.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #f5a623, #e8940f)" }}
          >
            ▶️ Regarder maintenant
          </button>
        </div>
      ),
    },
    {
      icon: "📋",
      title: "Complétez votre profil",
      subtitle: "Pour retirer vos gains rapidement",
      content: (
        <div className="space-y-3">
          <p className="text-slate-300 text-sm leading-relaxed">
            Ces infos sont nécessaires pour vous payer vos commissions. Ajoutez-les maintenant ou plus tard.
          </p>
          {[
            { icon: "📍", text: "Ville et quartier", required: !seller.ville, path: "/ProfilVendeur" },
            { icon: "💳", text: "Numéro Mobile Money", required: !seller.numero_mobile_money, path: "/ProfilVendeur" },
            { icon: "🪪", text: "Vérification identité (KYC)", required: seller.statut_kyc !== "valide", path: "/ProfilVendeur" },
          ].map(item => (
            <div key={item.text}
              onClick={() => { completeWizard(); navigate(item.path); }}
              className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
              style={{
                background: item.required ? "rgba(245,166,35,0.08)" : "rgba(34,197,94,0.08)",
                border: `1px solid ${item.required ? "rgba(245,166,35,0.2)" : "rgba(34,197,94,0.2)"}`,
              }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-white text-sm flex-1">{item.text}</span>
              <span className="text-xs" style={{ color: item.required ? "#f5a623" : "#22c55e" }}>
                {item.required ? "À compléter →" : "✅"}
              </span>
            </div>
          ))}
        </div>
      ),
    },
  ];

  const current = steps[step - 1];

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1f5e] rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, i) => (
            <div key={i} className="h-1 rounded-full transition-all"
              style={{
                width: i + 1 === step ? 24 : 8,
                background: i + 1 <= step ? "#F5C518" : "rgba(255,255,255,0.15)",
              }} />
          ))}
        </div>

        {/* Icon + Title */}
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">{current.icon}</div>
          <h2 className="text-white text-xl font-bold">{current.title}</h2>
          <p className="text-slate-400 text-xs mt-1">{current.subtitle}</p>
        </div>

        {/* Content */}
        {current.content}

        {/* Navigation */}
        <div className="flex gap-2 mt-6">
          {step < steps.length ? (
            <>
              <button onClick={completeWizard}
                className="flex-1 py-3 text-slate-400 text-sm rounded-xl bg-white/5 font-medium">
                Plus tard
              </button>
              <button onClick={() => setStep(step + 1)}
                className="flex-[2] py-3 text-white text-sm rounded-xl font-bold"
                style={{ background: "linear-gradient(135deg, #f5a623, #e8940f)" }}>
                Suivant →
              </button>
            </>
          ) : (
            <button onClick={completeWizard}
              className="w-full py-3 text-white text-sm rounded-xl font-bold"
              style={{ background: "linear-gradient(135deg, #f5a623, #e8940f)" }}>
              🚀 Accéder à mon espace !
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
