import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVendeurSession } from "@/components/useSessionGuard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, AlertCircle, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useToast } from "@/hooks/use-toast";

function KycDocUpload({ docKey, label, hint, preview, isUploading, doc, onSelect, onClear, isSelfie }) {
  const inputRef = useRef(null);
  return (
    <div>
      <Label className="text-slate-200 text-xs mb-1.5 block">
        {label} <span className="text-red-400">*</span>
      </Label>
      <input ref={inputRef} type="file" accept="image/*" capture={isSelfie ? "user" : "environment"} onChange={(e) => onSelect(docKey, e)} className="hidden" />
      {preview ? (
        <div className="relative">
          <img src={preview} alt={label} className="w-full h-36 object-cover rounded-2xl border-2 border-emerald-400" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            <span className="bg-emerald-500 text-white px-2 py-1 rounded-full text-[10px] font-semibold">✅ OK</span>
            <button onClick={onClear} className="bg-red-500/80 text-white px-2 py-1 rounded-full text-[10px] font-semibold hover:bg-red-600">Changer</button>
          </div>
        </div>
      ) : (
        <div onClick={() => inputRef.current?.click()} className={`flex flex-col items-center justify-center w-full h-28 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${isUploading ? 'border-[#f5a623]/50 bg-[#f5a623]/5' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}>
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-[#f5a623] animate-spin" />
          ) : (
            <>
              <div className="text-3xl mb-2">📷</div>
              <p className="text-white/70 text-xs font-medium">Appuyer pour ouvrir</p>
              <p className="text-white/40 text-[10px]">📷 Caméra ou 🖼️ Galerie</p>
              {hint && <p className="text-[#f5a623]/60 text-[10px] italic mt-1">{hint}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResoumissionKYC() {
  const { toast } = useToast();
  const [vendeur, setVendeur] = useState(null);
  const [typeDocument, setTypeDocument] = useState("cni");
  const [kycDocs, setKycDocs] = useState({ recto: null, verso: null, selfie: null, passeport: null });
  const [kycPreviews, setKycPreviews] = useState({ recto: null, verso: null, selfie: null, passeport: null });
  const [kycUploading, setKycUploading] = useState({});
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);

  const getRequiredDocs = () => {
    if (typeDocument === 'cni') return ['recto', 'verso', 'selfie'];
    if (typeDocument === 'passeport') return ['passeport', 'selfie'];
    return [];
  };
  const allDocsUploaded = () => {
    const required = getRequiredDocs();
    return required.length > 0 && required.every(k => kycDocs[k] !== null);
  };
  const getLabelForKey = (key) => ({ recto: 'CNI Recto', verso: 'CNI Verso', selfie: 'Selfie avec document', passeport: 'Page photo passeport' }[key] || key);

  useEffect(() => {
    const chargerVendeur = async () => {
      try {
        const session = getVendeurSession();
        if (!session) return;
        const { data: authUser } = await supabase.auth.getUser();
        let seller = null;
        if (authUser?.user) {
          const { data } = await supabase.from('sellers').select('*').eq('user_id', authUser.user.id).maybeSingle();
          seller = data;
        }
        if (!seller && session.email) {
          const { data } = await supabase.from('sellers').select('*').eq('email', session.email).maybeSingle();
          seller = data;
        }
        if (seller) setVendeur(seller);
      } catch (e) {
        console.error("Erreur:", e);
      }
    };
    chargerVendeur();
  }, []);

  const handleFileSelect = async (docKey, e) => {
    const file = e.target.files[0];
    if (!file) return;
    setKycUploading(prev => ({ ...prev, [docKey]: true }));
    try {
      if (file.size > 5 * 1024 * 1024) { toast({ title: '❌ Fichier trop volumineux', description: 'Maximum 5MB', variant: 'destructive' }); return; }
      if (!file.type.startsWith('image/')) { toast({ title: '❌ Format invalide', description: 'Seules les images sont acceptées', variant: 'destructive' }); return; }
      const reader = new FileReader();
      reader.onload = (ev) => setKycPreviews(p => ({ ...p, [docKey]: ev.target.result }));
      reader.readAsDataURL(file);
      const fileName = `kyc/${vendeur?.id || vendeur?.email}/${docKey}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage.from('kyc-documents').upload(fileName, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('kyc-documents').getPublicUrl(fileName);
      setKycDocs(p => ({ ...p, [docKey]: urlData.publicUrl }));
      toast({ title: '✅ Document ajouté', description: `${getLabelForKey(docKey)} uploadé` });
    } catch (error) {
      toast({ title: '❌ Erreur upload', description: error.message, variant: 'destructive' });
    } finally {
      setKycUploading(p => ({ ...p, [docKey]: false }));
    }
  };

  const soumettre = async () => {
    if (!allDocsUploaded()) {
      const missing = getRequiredDocs().filter(k => !kycDocs[k]).map(k => getLabelForKey(k));
      setErreur(`Documents manquants : ${missing.join(', ')}`);
      return;
    }
    setEnCours(true);
    setErreur("");
    try {
      const { error } = await supabase.from('sellers').update({
        kyc_document_recto_url: kycDocs.recto || null,
        kyc_document_verso_url: kycDocs.verso || null,
        kyc_selfie_url: kycDocs.selfie || null,
        kyc_passeport_url: kycDocs.passeport || null,
        kyc_type_document: typeDocument,
        kyc_document_type: typeDocument,
        statut_kyc: 'en_attente',
        seller_status: 'kyc_pending',
        kyc_raison_rejet: null,
        kyc_submitted_at: new Date().toISOString(),
      }).eq('id', vendeur.id);
      if (error) throw error;
      await supabase.from('notifications_admin').insert({
        titre: '🪪 KYC Resoumis',
        message: `${vendeur.full_name} (${vendeur.email}) a resoumis son KYC avec ${typeDocument === 'cni' ? 'CNI' : 'Passeport'}. ${getRequiredDocs().length} documents fournis.`,
        type: 'kyc',
        vendeur_email: vendeur.email,
        reference_id: vendeur.id,
      });
      setSucces(true);
    } catch (error) {
      setErreur(error.message || "Erreur lors de la resoumission.");
    } finally {
      setEnCours(false);
    }
  };

  if (!vendeur) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d1240] to-[#1a1f5e] flex items-center justify-center p-4">
        <div className="text-white text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (vendeur.statut_kyc !== 'rejete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d1240] to-[#1a1f5e] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Dossier KYC Approuvé ✓</h2>
          <p className="text-sm text-slate-500 mb-5">Votre dossier a déjà été validé ou est en cours de vérification.</p>
          <Link to={createPageUrl("EspaceVendeur")}>
            <Button className="w-full bg-[#1a1f5e] hover:bg-[#141952]">Retour à mon espace</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (succes) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0d1240] to-[#1a1f5e] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Dossier Resoumis ! 📝</h2>
          <p className="text-sm text-slate-500 mb-3">Merci d'avoir corrigé votre dossier.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 mb-5">
            <p className="font-semibold mb-1">⏳ Prochaine étape :</p>
            <p>Notre équipe examinera votre nouveau dossier sous <strong>24 à 48h</strong>.</p>
          </div>
          <Link to={createPageUrl("EspaceVendeur")}>
            <Button className="w-full bg-[#1a1f5e] hover:bg-[#141952]">Retour à mon espace</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1240] to-[#1a1f5e] flex flex-col items-center justify-start px-4 py-8"
      style={{ paddingTop: "max(2rem, env(safe-area-inset-top, 0px))" }}>

      <div className="w-full max-w-md flex items-center gap-3 mb-6">
        <Link to={createPageUrl("EspaceVendeur")}>
          <button className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center hover:bg-white/20">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </Link>
        <h1 className="text-xl font-black text-white">Resoumission KYC</h1>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-white">Correction de votre dossier</h2>
          <p className="text-slate-300 text-sm mt-1">Resoumettez les documents demandés</p>
        </div>

        {vendeur.kyc_raison_rejet && (
          <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-400/30 rounded-xl text-sm text-yellow-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span><strong>Motif du rejet :</strong> {vendeur.kyc_raison_rejet}</span>
          </div>
        )}

        {erreur && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-400/30 rounded-xl text-sm text-red-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{erreur}</span>
          </div>
        )}

        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 space-y-4">
          <div>
            <Label className="text-slate-200 text-xs mb-2 block">Type de document *</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cni', label: "🪪 CNI" },
                { id: 'passeport', label: '📘 Passeport' }
              ].map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setTypeDocument(type.id);
                    setKycDocs({ recto: null, verso: null, selfie: null, passeport: null });
                    setKycPreviews({ recto: null, verso: null, selfie: null, passeport: null });
                  }}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    typeDocument === type.id
                      ? "bg-[#F5C518]/20 text-[#F5C518] border-[#F5C518]"
                      : "bg-white/5 text-slate-300 border-white/20 hover:bg-white/10"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {typeDocument === 'cni' && (
            <>
              <KycDocUpload docKey="recto" label="CNI Recto (face avant)" hint="Photo claire, bien éclairée" preview={kycPreviews.recto} isUploading={kycUploading.recto} doc={kycDocs.recto} onSelect={handleFileSelect} onClear={() => { setKycDocs(p=>({...p,recto:null})); setKycPreviews(p=>({...p,recto:null})); }} />
              <KycDocUpload docKey="verso" label="CNI Verso (face arrière)" hint="Texte lisible" preview={kycPreviews.verso} isUploading={kycUploading.verso} doc={kycDocs.verso} onSelect={handleFileSelect} onClear={() => { setKycDocs(p=>({...p,verso:null})); setKycPreviews(p=>({...p,verso:null})); }} />
              <KycDocUpload docKey="selfie" label="Selfie avec votre CNI" hint="Tenez la CNI à côté de votre visage" preview={kycPreviews.selfie} isUploading={kycUploading.selfie} doc={kycDocs.selfie} onSelect={handleFileSelect} onClear={() => { setKycDocs(p=>({...p,selfie:null})); setKycPreviews(p=>({...p,selfie:null})); }} isSelfie />
            </>
          )}

          {typeDocument === 'passeport' && (
            <>
              <KycDocUpload docKey="passeport" label="Page photo du passeport" hint="Page avec votre photo" preview={kycPreviews.passeport} isUploading={kycUploading.passeport} doc={kycDocs.passeport} onSelect={handleFileSelect} onClear={() => { setKycDocs(p=>({...p,passeport:null})); setKycPreviews(p=>({...p,passeport:null})); }} />
              <KycDocUpload docKey="selfie" label="Selfie avec votre passeport" hint="Tenez le passeport à côté de votre visage" preview={kycPreviews.selfie} isUploading={kycUploading.selfie} doc={kycDocs.selfie} onSelect={handleFileSelect} onClear={() => { setKycDocs(p=>({...p,selfie:null})); setKycPreviews(p=>({...p,selfie:null})); }} isSelfie />
            </>
          )}

          <button
            onClick={soumettre}
            disabled={!allDocsUploaded() || enCours || Object.values(kycUploading).some(v => v)}
            className="w-full h-11 rounded-xl text-sm font-black transition-all"
            style={{
              background: allDocsUploaded() ? 'linear-gradient(135deg, #f5a623, #e8940f)' : 'rgba(255,255,255,0.1)',
              color: allDocsUploaded() ? 'white' : 'rgba(255,255,255,0.3)',
              cursor: allDocsUploaded() ? 'pointer' : 'not-allowed',
            }}
          >
            {enCours
              ? '⏳ Envoi en cours...'
              : !allDocsUploaded()
                ? `📎 ${getRequiredDocs().filter(k => !kycDocs[k]).length} document(s) manquant(s)`
                : '✅ Resoummettre mon dossier'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
