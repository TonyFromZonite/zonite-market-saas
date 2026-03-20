import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function ParrainageSection({ vendeur }) {
  const [filleuls, setFilleuls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const codeParrainage = vendeur?.code_parrainage || generateCode(vendeur);

  function generateCode(v) {
    if (!v) return '';
    const prefix = (v.full_name || 'ZON').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
    return `${prefix}${v.id?.slice(0, 4).toUpperCase() || '0000'}`;
  }

  useEffect(() => {
    if (!vendeur?.id) return;
    loadFilleuls();
    ensureCode();
  }, [vendeur?.id]);

  const ensureCode = async () => {
    if (vendeur?.code_parrainage) return;
    const code = generateCode(vendeur);
    await supabase.from('sellers').update({ code_parrainage: code }).eq('id', vendeur.id);
  };

  const loadFilleuls = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('parrainages')
      .select('*, filleul:filleul_id(full_name, email)')
      .eq('parrain_id', vendeur.id)
      .order('created_at', { ascending: false });
    setFilleuls(data || []);
    setLoading(false);
  };

  const shareLink = `https://zonitemarket.lovable.app/InscriptionVendeur?ref=${codeParrainage}`;
  const shareText = `🎉 Rejoins Zonite Market et gagne de l'argent en vendant ! Utilise mon code de parrainage : ${codeParrainage}\n\n👉 ${shareLink}`;

  const copyCode = () => {
    navigator.clipboard?.writeText(codeParrainage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
  };

  const totalGains = filleuls.reduce((s, f) => s + (f.commission_totale || 0), 0);
  const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🤝</span>
        <h3 className="font-semibold text-slate-900 text-sm">Programme de Parrainage</h3>
      </div>

      <div className="bg-gradient-to-r from-[#1a1f5e] to-[#2a2f7e] rounded-xl p-3 mb-3 text-white">
        <p className="text-xs text-white/60 mb-1">Votre code parrain</p>
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-wider flex-1">{codeParrainage}</span>
          <button onClick={copyCode} className="px-3 py-1.5 bg-white/20 rounded-lg text-xs font-medium">
            {copied ? '✅ Copié' : '📋 Copier'}
          </button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
        <p className="text-xs font-semibold text-amber-800 mb-1">💰 Comment ça marche ?</p>
        <p className="text-[11px] text-amber-700 leading-relaxed">
          Partagez votre code → Votre filleul s'inscrit → Vous gagnez <strong>500 FCFA par livraison réussie</strong> de votre filleul, sur ses <strong>10 premières livraisons</strong> !
        </p>
      </div>

      <button
        onClick={shareWhatsApp}
        className="w-full py-3 rounded-xl text-white text-sm font-bold mb-3 active:scale-[0.97] transition-transform"
        style={{ background: '#25D366' }}
      >
        📲 Partager sur WhatsApp
      </button>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-slate-900">{filleuls.length}</p>
          <p className="text-[10px] text-slate-500">Filleul{filleuls.length > 1 ? 's' : ''}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-emerald-700">{formater(totalGains)}</p>
          <p className="text-[10px] text-emerald-600">Gagné</p>
        </div>
      </div>

      {/* Filleuls list */}
      {filleuls.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Vos filleuls</p>
          {filleuls.slice(0, 5).map(f => (
            <div key={f.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                  {f.filleul?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-900">{f.filleul?.full_name || 'Vendeur'}</p>
                  <p className="text-[10px] text-slate-400">{f.livraisons_comptees || 0}/10 livraisons</p>
                </div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">
                +{formater(f.commission_totale || 0)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
