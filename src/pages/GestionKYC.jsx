import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, XCircle, Eye } from "lucide-react";

const STATUTS_KYC = {
  en_attente: { label: "En attente", couleur: "bg-yellow-100 text-yellow-800" },
  valide: { label: "Validé", couleur: "bg-emerald-100 text-emerald-800" },
  rejete: { label: "Rejeté", couleur: "bg-red-100 text-red-800" },
};

export default function GestionKYC() {
  const [compteSelectionne, setCompteSelectionne] = useState(null);
  const [notes, setNotes] = useState("");
  const [enCours, setEnCours] = useState(false);
  const queryClient = useQueryClient();

  const { data: comptes = [], isLoading } = useQuery({
    queryKey: ["vendeurs-kyc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const validerKYC = async (statut) => {
    setEnCours(true);
    try {
      const updates = {
        statut_kyc: statut,
        kyc_raison_rejet: statut === 'rejete' ? notes : null,
      };

      if (statut === 'valide') {
        updates.seller_status = 'active_seller';
        // catalogue_debloque reste false — débloqué uniquement après la formation
      } else if (statut === 'rejete') {
        updates.seller_status = 'kyc_rejected';
      }

      const { error } = await supabase
        .from('sellers')
        .update(updates)
        .eq('id', compteSelectionne.id);

      if (error) throw error;

      // Send email notification
      if (statut === 'valide') {
        try {
          await supabase.functions.invoke('send-kyc-approved-email', {
            body: { email: compteSelectionne.email, nom: compteSelectionne.full_name }
          });
        } catch (e) { console.warn("Email send failed:", e); }
      } else if (statut === 'rejete') {
        try {
          await supabase.functions.invoke('send-kyc-rejected-email', {
            body: { email: compteSelectionne.email, nom: compteSelectionne.full_name, raison: notes }
          });
        } catch (e) { console.warn("Email send failed:", e); }
      }

      // Notify vendor
      if (compteSelectionne.id) {
        await supabase.from('notifications_vendeur').insert({
          vendeur_id: compteSelectionne.id,
          vendeur_email: compteSelectionne.email,
          titre: statut === 'valide' ? 'KYC Validé !' : 'KYC Rejeté',
          message: statut === 'valide' 
            ? 'Votre dossier KYC a été validé. Votre compte est maintenant actif !'
            : `Votre dossier KYC a été rejeté. Raison : ${notes || 'Non spécifiée'}`,
          type: 'kyc',
        });
      }

      queryClient.invalidateQueries({ queryKey: ["vendeurs-kyc"] });
      setCompteSelectionne(null);
      setNotes("");
    } catch (e) {
      console.error('KYC error:', e.message);
    }
    setEnCours(false);
  };

  if (isLoading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const enAttente = comptes.filter(c => c.statut_kyc === "en_attente");
  const traites = comptes.filter(c => c.statut_kyc !== "en_attente");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Validation KYC</h1>
          <p className="text-sm text-slate-500 mt-1">Gestion centralisée des dossiers KYC vendeurs</p>
        </div>
        {enAttente.length > 0 && (
          <Badge className="bg-yellow-500 text-white text-lg px-4 py-2">{enAttente.length} en attente</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "En attente", val: enAttente.length, couleur: "text-yellow-600" },
          { label: "Validés", val: comptes.filter(c => c.statut_kyc === "valide").length, couleur: "text-emerald-600" },
          { label: "Rejetés", val: comptes.filter(c => c.statut_kyc === "rejete").length, couleur: "text-red-600" },
        ].map(({ label, val, couleur }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-bold ${couleur}`}>{val}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {enAttente.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-yellow-50 border-yellow-100">
            <h3 className="font-semibold text-slate-900">Dossiers KYC à valider ({enAttente.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {enAttente.map(c => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                    <span className="text-blue-700 font-bold text-sm">{c.full_name?.[0]?.toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{c.full_name}</p>
                    <p className="text-sm text-slate-500">{c.ville}{c.quartier ? `, ${c.quartier}` : ""}</p>
                    <p className="text-xs text-slate-400">{c.email}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => { setCompteSelectionne(c); setNotes(""); }}>
                  <Eye className="w-4 h-4 mr-1" /> Voir
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {traites.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Dossiers traités ({traites.length})</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {traites.map(c => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{c.full_name}</p>
                  <p className="text-sm text-slate-500">{c.ville} • {c.telephone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${STATUTS_KYC[c.statut_kyc]?.couleur} border-0`}>{STATUTS_KYC[c.statut_kyc]?.label}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => { setCompteSelectionne(c); setNotes(c.kyc_raison_rejet || ""); }}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!compteSelectionne} onOpenChange={() => setCompteSelectionne(null)}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dossier KYC : {compteSelectionne?.full_name}</DialogTitle>
          </DialogHeader>
          {compteSelectionne && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                <div>
                  <p className="text-xs text-slate-500">Statut KYC actuel</p>
                  <Badge className={`${STATUTS_KYC[compteSelectionne.statut_kyc]?.couleur} border-0 mt-1`}>
                    {STATUTS_KYC[compteSelectionne.statut_kyc]?.label}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Date inscription</p>
                  <p className="text-xs font-medium text-slate-900">
                    {new Date(compteSelectionne.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>

              {compteSelectionne.statut_kyc === "en_attente" && (
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                  ℹ️ En validant ce dossier, un email "Compte activé !" sera envoyé au vendeur.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-400">Email</p><p className="font-medium">{compteSelectionne.email}</p></div>
                <div><p className="text-slate-400">Téléphone</p><p className="font-medium">{compteSelectionne.telephone}</p></div>
                <div><p className="text-slate-400">Ville</p><p className="font-medium">{compteSelectionne.ville}</p></div>
                <div><p className="text-slate-400">Quartier</p><p className="font-medium">{compteSelectionne.quartier || "—"}</p></div>
                <div><p className="text-slate-400">Mobile Money</p><p className="font-medium">{compteSelectionne.numero_mobile_money}</p></div>
                <div><p className="text-slate-400">Opérateur</p><p className="font-medium">{compteSelectionne.operateur_mobile_money === "orange_money" ? "Orange Money" : "MTN MoMo"}</p></div>
              </div>

              {/* KYC Documents - using correct column names */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-700">Documents KYC</h4>
                <div className="grid grid-cols-2 gap-3">
                  {compteSelectionne.kyc_document_recto_url && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Pièce d'identité (Recto)</p>
                      <img 
                        src={compteSelectionne.kyc_document_recto_url} 
                        alt="Document recto" 
                        className="w-full rounded-lg object-cover h-32 cursor-pointer border border-slate-200" 
                        onClick={() => window.open(compteSelectionne.kyc_document_recto_url)} 
                      />
                    </div>
                  )}
                  {compteSelectionne.kyc_document_verso_url && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Pièce d'identité (Verso)</p>
                      <img 
                        src={compteSelectionne.kyc_document_verso_url} 
                        alt="Document verso" 
                        className="w-full rounded-lg object-cover h-32 cursor-pointer border border-slate-200" 
                        onClick={() => window.open(compteSelectionne.kyc_document_verso_url)} 
                      />
                    </div>
                  )}
                  {compteSelectionne.kyc_selfie_url && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Selfie</p>
                      <img 
                        src={compteSelectionne.kyc_selfie_url} 
                        alt="Selfie" 
                        className="w-full rounded-lg object-cover h-32 cursor-pointer border border-slate-200" 
                        onClick={() => window.open(compteSelectionne.kyc_selfie_url)} 
                      />
                    </div>
                  )}
                </div>
                {!compteSelectionne.kyc_document_recto_url && !compteSelectionne.kyc_selfie_url && (
                  <p className="text-sm text-slate-400 italic">Aucun document KYC soumis</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm text-slate-500">Notes (motif si rejet)</label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex : Photo illisible, selfie non conforme..." />
              </div>
            </div>
          )}
          {compteSelectionne?.statut_kyc === "en_attente" && (
            <DialogFooter className="flex gap-2">
              <Button variant="destructive" onClick={() => validerKYC("rejete")} disabled={enCours}>
                <XCircle className="w-4 h-4 mr-1" /> Rejeter
              </Button>
              <Button onClick={() => validerKYC("valide")} disabled={enCours} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="w-4 h-4 mr-1" /> {enCours ? "En cours..." : "Valider le dossier"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
