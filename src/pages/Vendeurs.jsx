import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminApi } from "@/components/adminApi";
import { invalidateQuery } from "@/components/CacheManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Loader2, Search, Wallet, DollarSign, AlertCircle, CheckCircle2, XCircle, Eye, UserCog } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { filterTable, listTable } from "@/lib/supabaseHelpers";

const ONGLETS = [
  { key: "liste", label: "Vendeurs" },
  { key: "kyc", label: "Validation KYC" },
  { key: "commissions", label: "Commissions" },
  { key: "paiements", label: "Paiements" },
];

const initVendeur = {
  nom_complet: "", email: "", telephone: "", ville: "", quartier: "", mot_de_passe: "",
  numero_mobile_money: "", operateur_mobile_money: "orange_money",
  taux_commission: 0, statut: "actif", date_embauche: new Date().toISOString().split("T")[0],
};

const formater = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
const formaterDate = (d) => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// ─── Sous-composant : Liste Vendeurs ────────────────────────────────────────
function ListeVendeurs() {
  const [recherche, setRecherche] = useState("");
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [vendeurEdite, setVendeurEdite] = useState(null);
  const [form, setForm] = useState(initVendeur);
  const [enCours, setEnCours] = useState(false);
  const [dialogRoleOuvert, setDialogRoleOuvert] = useState(false);
  const [vendeurRoleEdite, setVendeurRoleEdite] = useState(null);
  const [nouveauRoleVendeur, setNouveauRoleVendeur] = useState("user");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: vendeurs = [], isLoading } = useQuery({
    queryKey: ["vendeurs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const modifier = (champ, valeur) => {
    setForm((p) => ({ ...p, [champ]: valeur }));
  };

  const ouvrir = (vendeur) => {
    if (vendeur) { setVendeurEdite(vendeur); setForm({ ...initVendeur, ...vendeur }); }
    else { setVendeurEdite(null); setForm(initVendeur); }
    setDialogOuvert(true);
  };

  const sauvegarder = async () => {
    if (!vendeurEdite) return;
    setEnCours(true);
    try {
      await adminApi.updateVendeur(vendeurEdite.id, { full_name: form.full_name || form.nom_complet, telephone: form.telephone });
      await adminApi.createJournalAudit({ action: "Vendeur modifié", module: "vendeur", details: `Vendeur ${form.full_name || form.nom_complet} modifié`, entite_id: vendeurEdite.id });
      toast({ title: "Vendeur modifié avec succès", duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
      setDialogOuvert(false);
    } catch (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 5000 });
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async (vendeur) => {
    if (!confirm(`Supprimer le vendeur "${vendeur.full_name || vendeur.nom_complet}" ? Cette action supprimera aussi son compte utilisateur et toutes ses données.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('delete-seller-complete', {
        body: { seller_id: vendeur.id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Vendeur supprimé avec succès", description: "Toutes les données ont été supprimées", duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
    } catch (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 5000 });
    }
  };

  const changerRole = async () => {
    if (!vendeurRoleEdite) return;
    setEnCours(true);
    try {
      // Update role in sellers table
      await supabase.from("sellers").update({ role: nouveauRoleVendeur }).eq("id", vendeurRoleEdite.id);
      
      // Update role in user_roles table if user_id exists
      if (vendeurRoleEdite.user_id) {
        await supabase.from("user_roles").update({ role: nouveauRoleVendeur }).eq("user_id", vendeurRoleEdite.user_id);
      }
      
      await adminApi.createJournalAudit({ action: "Rôle utilisateur changé", module: "vendeur", details: `Rôle de ${vendeurRoleEdite.full_name || vendeurRoleEdite.nom_complet} changé en ${nouveauRoleVendeur}`, entite_id: vendeurRoleEdite.id });
      toast({ title: "Rôle changé avec succès", duration: 5000 });
      queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
      setDialogRoleOuvert(false);
    } catch (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 5000 });
    } finally {
      setEnCours(false);
    }
  };

  if (isLoading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;

  const vendeursFiltres = (vendeurs || []).filter((v) => `${v.full_name || v.nom_complet || ''} ${v.email || ''} ${v.telephone || ''}`.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Rechercher un vendeur..." value={recherche} onChange={(e) => setRecherche(e.target.value)} className="pl-9" />
        </div>

      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Vendeur</TableHead>
                <TableHead>Contact</TableHead>
                 <TableHead className="text-right">CA Généré</TableHead>
                 <TableHead className="text-right">Solde Commission</TableHead>
                 <TableHead>Statut</TableHead>
                 <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendeursFiltres.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">Aucun vendeur</TableCell></TableRow>
              )}
              {vendeursFiltres.map((v) => (
                <TableRow key={v.id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">{(v.full_name || v.nom_complet)?.[0]?.toUpperCase() || "V"}</div>
                      <div>
                        <p className="font-medium">{v.full_name || v.nom_complet}</p>
                        <p className="text-xs text-slate-500">{v.created_at ? new Date(v.created_at).toLocaleDateString("fr-FR") : ""}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm"><p>{v.email || "—"}</p><p className="text-slate-500">{v.telephone || "—"}</p></TableCell>
                  <TableCell className="text-right font-medium">{formater(v.total_commissions_gagnees)}</TableCell>
                  <TableCell className="text-right font-bold text-yellow-600">{formater(v.solde_commission)}</TableCell>
                  <TableCell>
                    <Badge className={v.seller_status === "active_seller" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                      {v.seller_status === "active_seller" ? "Actif" : v.seller_status === "kyc_pending" ? "KYC en attente" : v.seller_status === "pending_verification" ? "Non vérifié" : v.seller_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => ouvrir(v)}><Pencil className="w-4 h-4 text-slate-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setVendeurRoleEdite(v); setNouveauRoleVendeur("user"); setDialogRoleOuvert(true); }}><UserCog className="w-4 h-4 text-blue-500" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => supprimer(v)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog Modifier Vendeur */}
      <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le Vendeur</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nom Complet *</Label><Input value={form.full_name || form.nom_complet || ''} onChange={(e) => modifier("full_name", e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} disabled /></div>
            <div className="space-y-2"><Label>Téléphone</Label><Input value={form.telephone} onChange={(e) => modifier("telephone", e.target.value)} /></div>
            <div className="space-y-2"><Label>Date d'Embauche</Label><Input type="date" value={form.date_embauche} onChange={(e) => modifier("date_embauche", e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOuvert(false)}>Annuler</Button>
            <Button onClick={sauvegarder} disabled={enCours || !(form.full_name || form.nom_complet)} className="bg-[#1a1f5e] hover:bg-[#141952]">
              {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Changement Rôle */}
      <Dialog open={dialogRoleOuvert} onOpenChange={setDialogRoleOuvert}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Modifier le rôle - {vendeurRoleEdite?.full_name || vendeurRoleEdite?.nom_complet}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-600 mb-2">Rôle actuel: <span className="font-bold">{vendeurRoleEdite?.role || 'user'}</span></p>
              <Label>Nouveau rôle</Label>
              <Select value={nouveauRoleVendeur} onValueChange={setNouveauRoleVendeur}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Vendeur (user)</SelectItem>
                  <SelectItem value="admin">Administrateur (admin)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-2">Cela changera le rôle de l'utilisateur correspondant dans le système.</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setDialogRoleOuvert(false)}>Annuler</Button>
            <Button onClick={changerRole} disabled={enCours} className="bg-blue-600 hover:bg-blue-700">
              {enCours ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Changer le rôle"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sous-composant : Validation KYC ────────────────────────────────────────
function ValidationKYC() {
   const [compteSelectionne, setCompteSelectionne] = useState(null);
   const [notes, setNotes] = useState("");
   const [enCours, setEnCours] = useState(false);
   const queryClient = useQueryClient();
   const { toast } = useToast();

   const { data: sellers = [], isLoading } = useQuery({
      queryKey: ["sellers"],
      queryFn: async () => {
        const { data, error } = await supabase.from("sellers").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      },
      refetchInterval: 30000,
    });

  const validerKYC = async (statut) => {
     setEnCours(true);
     try {
       const response = await supabase.functions.invoke('validateKYC', {
         seller_id: compteSelectionne.id,
         statut,
         notes: notes || '',
       });
       if (response.data.success) {
         toast({ 
           title: statut === "valide" ? "KYC Validé" : "KYC Rejeté", 
           description: statut === "valide" ? `${compteSelectionne.full_name || compteSelectionne.nom_complet} a reçu ses identifiants.` : `${compteSelectionne.full_name || compteSelectionne.nom_complet} a été notifié du rejet.`,
           duration: 5000 
         });
       } else {
         throw new Error(response.data.error);
       }
       queryClient.invalidateQueries({ queryKey: ["sellers"] });
       setCompteSelectionne(null);
     } catch (error) {
       toast({ title: "Erreur", description: error.message, variant: "destructive", duration: 5000 });
     } finally {
       setEnCours(false);
     }
   }

  if (isLoading) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const enAttente = sellers.filter(s => s.statut_kyc === "en_attente");
  const traites = sellers.filter(s => s.statut_kyc !== "en_attente");

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "En attente", val: enAttente.length, couleur: "text-yellow-600" },
          { label: "Validés", val: sellers.filter(s => s.statut_kyc === "valide").length, couleur: "text-emerald-600" },
          { label: "Rejetés", val: sellers.filter(s => s.statut_kyc === "rejete").length, couleur: "text-red-600" },
        ].map(({ label, val, couleur }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-bold ${couleur}`}>{val}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
      {enAttente.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-yellow-50 border-yellow-100"><h3 className="font-semibold text-slate-900">Dossiers KYC à valider ({enAttente.length})</h3></div>
          <div className="divide-y divide-slate-100">
            {enAttente.map(s => (
                <div key={s.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center"><span className="text-blue-700 font-bold text-sm">{(s.full_name || s.nom_complet)?.[0]?.toUpperCase()}</span></div>
                    <div>
                      <p className="font-medium text-slate-900">{s.full_name || s.nom_complet}</p>
                      <p className="text-sm text-slate-500">{s.ville}{s.quartier ? `, ${s.quartier}` : ""}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setCompteSelectionne(s); setNotes(""); }}><Eye className="w-4 h-4 mr-1" /> Voir</Button>
                </div>
              ))}
          </div>
        </div>
      )}
      {traites.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-900">Dossiers traités ({traites.length})</h3></div>
          <div className="divide-y divide-slate-100">
            {traites.map(s => (
                <div key={s.id} className="p-4 flex items-center justify-between">
                  <div><p className="font-medium text-slate-900">{s.full_name || s.nom_complet}</p><p className="text-sm text-slate-500">{s.ville} • {s.telephone}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge className={`border-0 ${s.statut_kyc === "valide" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{s.statut_kyc === "valide" ? "Validé" : "Rejeté"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setCompteSelectionne(s); setNotes(s.notes_admin || ""); }}><Eye className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      <Dialog open={!!compteSelectionne} onOpenChange={() => setCompteSelectionne(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dossier KYC : {compteSelectionne?.full_name || compteSelectionne?.nom_complet}</DialogTitle></DialogHeader>
          {compteSelectionne && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-slate-400">Email</p><p className="font-medium">{compteSelectionne.email}</p></div>
                <div><p className="text-slate-400">Téléphone</p><p className="font-medium">{compteSelectionne.telephone}</p></div>
                <div><p className="text-slate-400">Ville</p><p className="font-medium">{compteSelectionne.ville}</p></div>
                <div><p className="text-slate-400">Quartier</p><p className="font-medium">{compteSelectionne.quartier || "—"}</p></div>
                <div><p className="text-slate-400">Mobile Money</p><p className="font-medium">{compteSelectionne.numero_mobile_money}</p></div>
                <div><p className="text-slate-400">Opérateur</p><p className="font-medium">{compteSelectionne.operateur_mobile_money === "orange_money" ? "Orange Money" : "MTN MoMo"}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {compteSelectionne.kyc_document_recto_url && (
                  <div><p className="text-xs text-slate-400 mb-1">Pièce d'identité (recto)</p><img src={compteSelectionne.kyc_document_recto_url} alt="ID Recto" className="w-full rounded-lg object-cover h-32 cursor-pointer" onClick={() => window.open(compteSelectionne.kyc_document_recto_url)} /></div>
                )}
                {compteSelectionne.kyc_document_verso_url && (
                  <div><p className="text-xs text-slate-400 mb-1">Pièce d'identité (verso)</p><img src={compteSelectionne.kyc_document_verso_url} alt="ID Verso" className="w-full rounded-lg object-cover h-32 cursor-pointer" onClick={() => window.open(compteSelectionne.kyc_document_verso_url)} /></div>
                )}
                {compteSelectionne.kyc_selfie_url && (
                  <div><p className="text-xs text-slate-400 mb-1">Selfie</p><img src={compteSelectionne.kyc_selfie_url} alt="Selfie" className="w-full rounded-lg object-cover h-32 cursor-pointer" onClick={() => window.open(compteSelectionne.kyc_selfie_url)} /></div>
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
               <Button variant="destructive" onClick={() => validerKYC("rejete")} disabled={enCours}><XCircle className="w-4 h-4 mr-1" /> Rejeter</Button>
               <Button onClick={() => validerKYC("valide")} disabled={enCours} className="bg-emerald-600 hover:bg-emerald-700">
                 {enCours ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                 Valider le KYC
               </Button>
             </DialogFooter>
           )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sous-composant : Commissions ────────────────────────────────────────────
function CommissionsTab() {
  const { data: vendeurs = [], isLoading: chargementVendeurs } = useQuery({ 
    queryKey: ["vendeurs"], 
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });
  const { data: paiements = [], isLoading: chargementPaiements } = useQuery({ queryKey: ["paiements_commissions"], queryFn: () => listTable("paiements_commission", "-created_date", 100), refetchInterval: 10000 });

  const totalAPayer = vendeurs.reduce((s, v) => s + (v.solde_commission || 0), 0);

  if (chargementVendeurs || chargementPaiements) return <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total à Payer", val: totalAPayer, icon: Wallet, bg: "bg-yellow-50", color: "text-yellow-600" },
          { label: "Total Payé", val: vendeurs.reduce((s, v) => s + (v.total_commissions_payees || 0), 0), icon: DollarSign, bg: "bg-emerald-50", color: "text-emerald-600" },
          { label: "Total Gagné", val: vendeurs.reduce((s, v) => s + (v.total_commissions_gagnees || 0), 0), icon: DollarSign, bg: "bg-blue-50", color: "text-blue-600" },
        ].map(({ label, val, icon: Icon, bg, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${bg}`}><Icon className={`w-5 h-5 ${color}`} /></div>
            <div><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold text-slate-900">{formater(val)}</p></div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200"><h3 className="font-semibold text-slate-900 text-sm">Soldes des Vendeurs</h3></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50"><TableHead>Vendeur</TableHead><TableHead className="text-right">Gagné</TableHead><TableHead className="text-right">Payé</TableHead><TableHead className="text-right">Solde à Payer</TableHead></TableRow></TableHeader>
            <TableBody>
              {vendeurs.filter(v => v.seller_status === "active_seller").map((v) => (
                <TableRow key={v.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium">{v.full_name || v.nom_complet}</TableCell>
                  <TableCell className="text-right text-sm">{formater(v.total_commissions_gagnees)}</TableCell>
                  <TableCell className="text-right text-sm">{formater(v.total_commissions_payees)}</TableCell>
                  <TableCell className="text-right"><span className={`font-bold ${(v.solde_commission || 0) > 0 ? "text-yellow-600" : "text-emerald-600"}`}>{formater(v.solde_commission)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 border-b border-slate-200"><h3 className="font-semibold text-slate-900 text-sm">Historique des Paiements</h3></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="bg-slate-50"><TableHead>Date</TableHead><TableHead>Vendeur</TableHead><TableHead className="text-right">Montant</TableHead><TableHead>Méthode</TableHead></TableRow></TableHeader>
            <TableBody>
              {paiements.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-slate-400">Aucun paiement enregistré</TableCell></TableRow>}
              {paiements.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm">{formaterDate(p.created_at)}</TableCell>
                  <TableCell className="font-medium">{p.vendeur_nom || p.effectue_par || "—"}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">{formater(p.montant)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs capitalize">{p.methode_paiement?.replace("_", " ")}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composant : Paiements Vendeurs ────────────────────────────────────
function PaiementsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["demandes_paiement_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes_paiement_vendeur")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { console.error(error); return []; }
      return data || [];
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers_for_payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("id, email, full_name, solde_commission, solde_en_attente, total_commissions_payees, total_commissions_gagnees");
      if (error) { console.error(error); return []; }
      return data || [];
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  const getSellerForDemande = (d) => sellers.find(s => s.id === d.vendeur_id) || null;
  const getNomTitulaire = (d) => {
    if (d.notes && d.notes.startsWith("Titulaire: ")) return d.notes.replace("Titulaire: ", "");
    return null;
  };

  const refreshAll = () => {
    invalidateQuery("VENDEURS");
    invalidateQuery("PAIEMENTS");
    queryClient.invalidateQueries({ queryKey: ["demandes_paiement_admin"] });
    queryClient.invalidateQueries({ queryKey: ["sellers_for_payments"] });
    queryClient.invalidateQueries({ queryKey: ["paiements_badge"] });
    queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_vendeurs"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_paiements"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_ventes"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard_commandes"] });
  };

  // APPROVE payment — balance already deducted at request time, just confirm
  const approuverPaiement = async (demandeId) => {
    setProcessingId(demandeId);
    try {
      const demande = demandes.find(d => d.id === demandeId);
      if (!demande) throw new Error("Demande introuvable");
      if (demande.statut !== "en_attente") throw new Error("Cette demande a déjà été traitée");

      // Get fresh seller data
      const { data: seller } = await supabase
        .from("sellers")
        .select("id, full_name, email, solde_commission, solde_en_attente, total_commissions_payees")
        .eq("id", demande.vendeur_id)
        .single();

      if (!seller) throw new Error("Vendeur introuvable");

      const montant = Number(demande.montant);

      // Update demande to payee
      const { error: demandeError } = await supabase
        .from("demandes_paiement_vendeur")
        .update({ statut: "payee", traite_par: "admin", traite_at: new Date().toISOString() })
        .eq("id", demandeId);
      if (demandeError) throw demandeError;

      // Confirm: solde stays reduced (already deducted), reset solde_en_attente, increment total_payees
      const { error: sellerError } = await supabase.from("sellers").update({
        solde_en_attente: Math.max(0, Number(seller.solde_en_attente || 0) - montant),
        total_commissions_payees: Number(seller.total_commissions_payees || 0) + montant,
      }).eq("id", seller.id);
      if (sellerError) throw sellerError;

      // Create payment record
      await supabase.from("paiements_commission").insert({
        demande_id: demandeId, vendeur_id: seller.id, montant,
        methode_paiement: demande.operateur_mobile_money,
        reference_paiement: `PAY-${Date.now().toString(36).toUpperCase()}`,
        effectue_par: "admin",
      });

      // Notify vendor
      await supabase.from("notifications_vendeur").insert({
        vendeur_id: seller.id, vendeur_email: seller.email,
        titre: "✅ Paiement effectué !",
        message: `Votre retrait de ${montant.toLocaleString("fr-FR")} FCFA a été effectué avec succès !\n\n💳 Opérateur : ${demande.operateur_mobile_money}\n📱 Numéro : ${demande.numero_mobile_money}\n\n💰 Total reçu depuis le début : ${(Number(seller.total_commissions_payees || 0) + montant).toLocaleString("fr-FR")} FCFA\n\nMerci pour votre confiance ! 🎉`,
        type: "succes",
      });

      toast({ title: "✅ Paiement approuvé !", description: `${montant.toLocaleString("fr-FR")} FCFA payé à ${seller.full_name}` });
      refreshAll();
    } catch (error) {
      console.error("Payment error:", error);
      toast({ title: "❌ Erreur de paiement", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  // Open reject modal
  const openRejectModal = (demandeId) => {
    setRejectingId(demandeId);
    setRejectReason("");
    setShowRejectModal(true);
  };

  // REJECT payment — RESTORE balance
  const rejeterPaiement = async () => {
    if (!rejectReason.trim()) {
      toast({ title: "⚠️ Motif obligatoire", description: "Vous devez écrire le motif du rejet", variant: "destructive" });
      return;
    }
    setProcessingId(rejectingId);
    try {
      const demande = demandes.find(d => d.id === rejectingId);
      if (!demande) throw new Error("Demande introuvable");

      // Get fresh seller data
      const { data: seller } = await supabase
        .from("sellers")
        .select("id, full_name, email, solde_commission, solde_en_attente")
        .eq("id", demande.vendeur_id)
        .single();

      if (!seller) throw new Error("Vendeur introuvable");

      const montant = Number(demande.montant);

      // Update demande to rejetee
      const { error: demandeError } = await supabase.from("demandes_paiement_vendeur").update({
        statut: "rejetee", motif_rejet: rejectReason.trim(),
        traite_par: "admin", traite_at: new Date().toISOString(),
      }).eq("id", rejectingId);
      if (demandeError) throw new Error("Erreur mise à jour demande: " + demandeError.message);

      // RESTORE vendor balance
      const { error: sellerError } = await supabase.from("sellers").update({
        solde_commission: Number(seller.solde_commission || 0) + montant,
        solde_en_attente: Math.max(0, Number(seller.solde_en_attente || 0) - montant),
      }).eq("id", seller.id);
      if (sellerError) throw new Error("Erreur restauration solde: " + sellerError.message);

      // Notify vendor with exact reason
      await supabase.from("notifications_vendeur").insert({
        vendeur_id: seller.id, vendeur_email: seller.email,
        titre: "❌ Demande de paiement rejetée",
        message: `Votre demande de retrait de ${montant.toLocaleString("fr-FR")} FCFA a été rejetée.\n\n📋 Motif du rejet :\n"${rejectReason.trim()}"\n\n✅ Votre solde a été restauré automatiquement.\nNouveau solde disponible : ${(Number(seller.solde_commission || 0) + montant).toLocaleString("fr-FR")} FCFA\n\nVous pouvez faire une nouvelle demande en corrigeant le problème mentionné.`,
        type: "alerte",
      });

      toast({ title: "✅ Demande rejetée", description: `Solde de ${seller.full_name} restauré. Vendeur notifié.` });
      setShowRejectModal(false);
      setRejectingId(null);
      setRejectReason("");
      refreshAll();
    } catch (error) {
      toast({ title: "❌ Erreur", description: error.message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  const enAttente = demandes.filter(d => d.statut === "en_attente");
  const traitees = demandes.filter(d => d.statut !== "en_attente");
  const totalEnAttente = enAttente.reduce((s, d) => s + (d.montant || 0), 0);

  const REJECT_SUGGESTIONS = [
    "Nom Mobile Money incorrect",
    "Numéro de compte invalide",
    "Informations incomplètes",
    "Solde insuffisant",
    "Compte non vérifié",
  ];

  return (
    <div className="space-y-3">
      {/* Reject modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md border border-red-200 shadow-xl">
            <h3 className="text-lg font-bold text-red-600 mb-1">❌ Rejeter la demande</h3>
            <p className="text-sm text-slate-500 mb-4">Le solde du vendeur sera automatiquement restauré.</p>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Motif du rejet * (obligatoire)</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {REJECT_SUGGESTIONS.map(s => (
                <button key={s} onClick={() => setRejectReason(s)}
                  className={`px-2.5 py-1 text-xs rounded-full border cursor-pointer transition-colors ${rejectReason === s ? "bg-red-100 border-red-300 text-red-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}>
                  {s}
                </button>
              ))}
            </div>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Expliquez le motif du rejet au vendeur..." rows={3} className="mb-4" />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowRejectModal(false); setRejectReason(""); setRejectingId(null); }}>Annuler</Button>
              <Button onClick={rejeterPaiement} disabled={!rejectReason.trim() || !!processingId}
                className="flex-[2] bg-red-600 hover:bg-red-700 text-white font-bold">
                {processingId ? "⏳ Traitement..." : "❌ Confirmer le rejet"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-3 bg-yellow-50 rounded-xl"><Wallet className="w-5 h-5 text-yellow-600" /></div>
          <div><p className="text-sm text-slate-500">À payer maintenant</p><p className="text-xl font-bold text-yellow-600">{formater(totalEnAttente)}</p><p className="text-xs text-slate-400">{enAttente.length} demande{enAttente.length > 1 ? "s" : ""}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-xl"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>
          <div><p className="text-sm text-slate-500">Total payé</p><p className="text-xl font-bold text-emerald-600">{formater(traitees.filter(d => d.statut === "payee" || d.statut === "paye").reduce((s, d) => s + (d.montant || 0), 0))}</p></div>
        </div>
      </div>

      {enAttente.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b bg-yellow-50 border-yellow-100"><h3 className="font-semibold text-slate-900">💰 Demandes à traiter ({enAttente.length})</h3></div>
          <div className="divide-y divide-slate-100">
            {enAttente.map(d => {
              const seller = getSellerForDemande(d);
              const nomTitulaire = getNomTitulaire(d);
              const namesMatch = nomTitulaire && seller && nomTitulaire.toLowerCase().trim() === seller.full_name?.toLowerCase().trim();
              const hasNomTitulaire = !!nomTitulaire;

              return (
                <div key={d.id} className="p-4 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Vendeur</span>
                      <span className="font-semibold text-slate-900">{seller?.full_name || d.vendeur_email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Montant</span>
                      <span className="font-bold text-lg text-yellow-600">{formater(d.montant)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Opérateur</span>
                      <span className="font-semibold text-slate-900">{d.operateur_mobile_money}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Numéro</span>
                      <span className="font-semibold text-slate-900">{d.numero_mobile_money}</span>
                    </div>
                    {hasNomTitulaire && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Titulaire du compte</span>
                        <span className="font-semibold text-slate-900">{nomTitulaire}</span>
                      </div>
                    )}
                    {hasNomTitulaire && !namesMatch && (
                      <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg mt-1">
                        <span className="text-sm">⚠️</span>
                        <div>
                          <p className="text-xs font-semibold text-red-600">Nom non correspondant</p>
                          <p className="text-xs text-red-500">Le nom du compte Mobile Money "{nomTitulaire}" ne correspond pas au nom du vendeur "{seller?.full_name}". Vérifiez avant de payer.</p>
                        </div>
                      </div>
                    )}
                    {hasNomTitulaire && namesMatch && (
                      <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg mt-1">
                        <span>✅</span>
                        <span className="text-xs text-emerald-600 font-medium">Nom vérifié — correspond au compte vendeur</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Demande du</span>
                      <span className="text-xs text-slate-500">{formaterDate(d.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openRejectModal(d.id)} disabled={processingId === d.id} className="flex-1 text-red-600 border-red-200 hover:bg-red-50">
                      <XCircle className="w-4 h-4 mr-1" /> Rejeter
                    </Button>
                    <Button size="sm" onClick={() => approuverPaiement(d.id)} disabled={processingId === d.id} className="flex-[2] bg-emerald-600 hover:bg-emerald-700">
                      {processingId === d.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                      {processingId === d.id ? "Traitement..." : "💸 Marquer comme payé"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {traitees.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100"><h3 className="font-semibold text-slate-900">Historique ({traitees.length})</h3></div>
          <div className="divide-y divide-slate-100">
            {traitees.map(d => {
              const seller = getSellerForDemande(d);
              return (
                <div key={d.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold">{formater(d.montant)}</p>
                    <p className="text-sm text-slate-600">{seller?.full_name || d.vendeur_email} • {d.operateur_mobile_money}</p>
                    <p className="text-xs text-slate-500">{d.numero_mobile_money}</p>
                    {(d.motif_rejet || d.notes_admin) && <p className="text-xs text-red-500">Motif rejet : {d.motif_rejet || d.notes_admin}</p>}
                    <p className="text-xs text-slate-400">{formaterDate(d.created_at)}{d.traite_at ? ` → Traité: ${formaterDate(d.traite_at)}` : ""}</p>
                  </div>
                  <Badge className={`border-0 ${(d.statut === "payee" || d.statut === "paye") ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {(d.statut === "payee" || d.statut === "paye") ? "Payé ✓" : "Rejeté"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {demandes.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Aucune demande de paiement</div>}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────
export default function Vendeurs() {
  const [ongletActif, setOngletActif] = useState("liste");

  const { data: kycs = [] } = useQuery({ 
    queryKey: ["sellers_badge"], 
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("*").eq("statut_kyc", "en_attente").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    }, 
    refetchInterval: 30000 
  });
  const { data: paiements = [] } = useQuery({ queryKey: ["paiements_badge"], queryFn: () => filterTable("demandes_paiement_vendeur", { statut: "en_attente" }), refetchInterval: 30000 });

  const badges = { kyc: kycs.length, paiements: paiements.length };

  return (
    <div className="space-y-3">
      {/* Onglets */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {ONGLETS.map(({ key, label }) => {
          const badge = badges[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setOngletActif(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${ongletActif === key ? "border-[#1a1f5e] text-[#1a1f5e]" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {label}
              {badge > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
            </button>
          );
        })}
      </div>

      {ongletActif === "liste" && <ListeVendeurs />}
      {ongletActif === "kyc" && <ValidationKYC />}
      {ongletActif === "commissions" && <CommissionsTab />}
      {ongletActif === "paiements" && <PaiementsTab />}
    </div>
  );
}