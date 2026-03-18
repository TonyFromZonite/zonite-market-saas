import React, { useState, useEffect } from "react";
import { requireAdminOrSousAdmin } from "@/components/useSessionGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/components/adminApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, CheckCircle2, Truck, XCircle, PackageCheck, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/integrations/supabase/client";

const STATUTS = {
  en_attente_validation_admin: { label: "En attente validation", couleur: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  validee_admin:               { label: "Validée", couleur: "bg-blue-100 text-blue-800 border-blue-200" },
  attribuee_livreur:           { label: "Attribuée livreur", couleur: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  en_livraison:                { label: "En livraison", couleur: "bg-purple-100 text-purple-800 border-purple-200" },
  livree:                      { label: "Livrée ✓", couleur: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  echec_livraison:             { label: "Échec livraison", couleur: "bg-orange-100 text-orange-800 border-orange-200" },
  annulee:                     { label: "Annulée", couleur: "bg-red-100 text-red-800 border-red-200" },
};

export default function CommandesVendeurs() {
  useEffect(() => { requireAdminOrSousAdmin(); }, []);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [commandeSelectionnee, setCommandeSelectionnee] = useState(null);
  const [notesAdmin, setNotesAdmin] = useState("");
  const [livreurNom, setLivreurNom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [modalRetour, setModalRetour] = useState(false);
  const [retourForm, setRetourForm] = useState({ raison: "client_refuse", raison_detail: "", quantite: 1 });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Load commandes with vendeur name via join
  const { data: commandes = [], isLoading } = useQuery({
    queryKey: ["commandes_vendeurs_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commandes_vendeur")
        .select("*, sellers!commandes_vendeur_vendeur_id_fkey(full_name), produits!commandes_vendeur_produit_id_fkey(prix_gros)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) { console.error("load commandes:", error); return []; }
      return (data || []).map(c => {
        const prixGros = Number(c.produits?.prix_gros) || Number(c.prix_unitaire) || 0;
        const prixFinal = Number(c.prix_final_client) || 0;
        return {
          ...c,
          vendeur_nom: c.sellers?.full_name || c.vendeur_email,
          // Commission = (prix_final_client - prix_gros) × quantite
          commission_calculee: Math.max(0, (prixFinal - prixGros) * (c.quantite || 1)),
        };
      });
    },
  });

  const { data: livreurs = [] } = useQuery({
    queryKey: ["livreurs_actifs"],
    queryFn: async () => {
      const { data } = await supabase.from("livraisons").select("*").eq("actif", true);
      return data || [];
    },
  });

  const nbEnAttente = commandes.filter(c => c.statut === "en_attente_validation_admin").length;

  const validerCommande = async () => {
    setEnCours(true);
    try {
      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, {
        statut: "validee_admin",
        notes_admin: notesAdmin || commandeSelectionnee.notes_admin,
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Commande validée ✓",
        message: `Votre commande de ${commandeSelectionnee.quantite}x ${commandeSelectionnee.produit_nom} pour ${commandeSelectionnee.client_nom} a été validée par l'équipe ZONITE.`,
        type: "succes",
      });
      await adminApi.createJournalAudit({
        action: "Validation commande vendeur",
        module: "commande",
        details: `Commande ${commandeSelectionnee.id} validée — Vendeur: ${commandeSelectionnee.vendeur_nom}`,
        entite_id: commandeSelectionnee.id,
      });
    } catch (err) { console.error("validerCommande:", err); }
    queryClient.invalidateQueries({ queryKey: ["commandes_vendeurs_admin"] });
    setEnCours(false);
    setCommandeSelectionnee(null);
  };

  const attribuerLivreur = async () => {
    if (!livreurNom.trim()) return;
    setEnCours(true);
    try {
      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, {
        statut: "attribuee_livreur",
        coursier_nom: livreurNom,
        notes_admin: notesAdmin || commandeSelectionnee.notes_admin,
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Livreur attribué",
        message: `Un livreur (${livreurNom}) a été attribué à votre commande pour ${commandeSelectionnee.client_nom}.`,
        type: "info",
      });
      await adminApi.createJournalAudit({
        action: "Attribution livreur",
        module: "commande",
        details: `Livreur "${livreurNom}" attribué à la commande ${commandeSelectionnee.id}`,
        entite_id: commandeSelectionnee.id,
      });
    } catch (err) { console.error("attribuerLivreur:", err); }
    queryClient.invalidateQueries({ queryKey: ["commandes_vendeurs_admin"] });
    setEnCours(false);
    setCommandeSelectionnee(null);
  };

  const marquerEnLivraison = async () => {
    setEnCours(true);
    try {
      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, { statut: "en_livraison" });
      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Commande en livraison 🚚",
        message: `La commande de ${commandeSelectionnee.produit_nom} pour ${commandeSelectionnee.client_nom} est en cours de livraison.`,
        type: "info",
      });
    } catch (err) { console.error("marquerEnLivraison:", err); }
    queryClient.invalidateQueries({ queryKey: ["commandes_vendeurs_admin"] });
    setEnCours(false);
    setCommandeSelectionnee(null);
  };

  const marquerLivree = async () => {
    setEnCours(true);
    try {
      const cmd = commandeSelectionnee;
      const quantite = cmd.quantite || 1;

      // Fetch product prices
      const { data: produit } = await supabase
        .from("produits")
        .select("prix_achat, prix_gros, prix_vente, stock_global")
        .eq("id", cmd.produit_id)
        .single();

      // Fetch seller balance
      const { data: seller } = await supabase
        .from("sellers")
        .select("solde_commission, total_commissions_gagnees")
        .eq("id", cmd.vendeur_id)
        .single();

      let commissionVendeur = 0;
      let nouveauSolde = 0;

      if (produit && seller) {
        const prixFinalClient = Number(cmd.prix_final_client) || Number(cmd.prix_unitaire) || Number(produit.prix_vente) || 0;
        const prixGros = Number(produit.prix_gros) || 0;
        const prixAchat = Number(produit.prix_achat) || 0;

        // Commission vendeur = (prix_vente - prix_gros) × quantite
        commissionVendeur = Math.max(0, (prixFinalClient - prixGros) * quantite);
        // Marge ZONITE = (prix_gros - prix_achat) × quantite
        const margeZonite = (prixGros - prixAchat) * quantite;
        const caVente = prixFinalClient * quantite;

        const now = new Date();
        const getWeekNumber = (d) => {
          const start = new Date(d.getFullYear(), 0, 1);
          return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
        };

        // 1. Insert vente with correct calculations
        await supabase.from("ventes").insert({
          vendeur_id: cmd.vendeur_id,
          vendeur_email: cmd.vendeur_email,
          produit_id: cmd.produit_id,
          commande_id: cmd.id,
          quantite,
          montant_total: caVente,
          prix_final_client: prixFinalClient,
          prix_gros: prixGros,
          prix_achat: prixAchat,
          commission_vendeur: commissionVendeur,
          profit_zonite: margeZonite,
          marge_zonite: margeZonite,
          prix_achat_unitaire: prixAchat,
          semaine: getWeekNumber(now),
          mois: now.getMonth() + 1,
          annee: now.getFullYear(),
        });

        // 2. Credit seller balance
        nouveauSolde = (Number(seller.solde_commission) || 0) + commissionVendeur;
        await supabase.from("sellers").update({
          solde_commission: nouveauSolde,
          total_commissions_gagnees: (Number(seller.total_commissions_gagnees) || 0) + commissionVendeur,
        }).eq("id", cmd.vendeur_id);

        // 3. Record stock movement
        await supabase.from("mouvements_stock").insert({
          produit_id: cmd.produit_id,
          quantite,
          type: "sortie",
          notes: `Livraison confirmée - Commande ${cmd.reference_commande || cmd.id}`,
          reference_id: cmd.id,
          localisation: cmd.coursier_nom || "Coursier",
          stock_avant: produit.stock_global,
          stock_apres: produit.stock_global,
        });
      }

      // Update order status
      await adminApi.updateCommandeVendeur(cmd.id, {
        statut: "livree",
        date_livraison_effective: new Date().toISOString(),
        notes_admin: notesAdmin || cmd.notes_admin,
      });

      // Notify vendor with commission breakdown
      await supabase.from("notifications_vendeur").insert({
        vendeur_id: cmd.vendeur_id,
        vendeur_email: cmd.vendeur_email,
        titre: "🎉 Livraison confirmée !",
        message: `Votre commande ${cmd.reference_commande || cmd.id} a été livrée avec succès !\n\n📦 Produit : ${cmd.produit_nom}\n🔢 Quantité : ${cmd.quantite}\n\n💰 Commission : ${commissionVendeur.toLocaleString("fr-FR")} FCFA\n💳 Nouveau solde : ${nouveauSolde.toLocaleString("fr-FR")} FCFA`,
        type: "succes",
      });

      await adminApi.createJournalAudit({
        action: "Livraison confirmée",
        module: "commande",
        details: `Commande ${cmd.id} livrée — Commission: ${Math.round(commissionVendeur)} FCFA`,
        entite_id: cmd.id,
      });
    } catch (err) { console.error("marquerLivree:", err); }
    queryClient.invalidateQueries({ queryKey: ["commandes_vendeurs_admin"] });
    setEnCours(false);
    setCommandeSelectionnee(null);
  };

  const marquerEchec = async () => {
    setEnCours(true);
    try {
      const cmd = commandeSelectionnee;
      const quantite = cmd.quantite || 1;

      // Restore stock to coursier
      if (cmd.produit_id) {
        const { data: produit } = await supabase
          .from("produits")
          .select("stocks_par_coursier, stock_global")
          .eq("id", cmd.produit_id)
          .single();

        if (produit) {
          const stockGlobal = (Number(produit.stock_global) || 0) + quantite;
          const stocksParCoursier = Array.isArray(produit.stocks_par_coursier) ? [...produit.stocks_par_coursier] : [];

          if (cmd.coursier_id) {
            const idx = stocksParCoursier.findIndex(s => s.coursier_id === cmd.coursier_id);
            if (idx >= 0) {
              stocksParCoursier[idx] = { ...stocksParCoursier[idx] };
              stocksParCoursier[idx].stock_total = (stocksParCoursier[idx].stock_total || 0) + quantite;
              if (cmd.variation && Array.isArray(stocksParCoursier[idx].stock_par_variation)) {
                stocksParCoursier[idx].stock_par_variation = stocksParCoursier[idx].stock_par_variation.map(v =>
                  v.variation_key === cmd.variation
                    ? { ...v, quantite: (v.quantite || 0) + quantite }
                    : v
                );
              }
            }
          }

          await supabase.from("produits").update({
            stock_global: stockGlobal,
            stocks_par_coursier: stocksParCoursier,
          }).eq("id", cmd.produit_id);

          await supabase.from("mouvements_stock").insert({
            produit_id: cmd.produit_id,
            quantite,
            type: "entree",
            notes: `Stock restauré - Échec livraison - Commande ${cmd.reference_commande || cmd.id}`,
            reference_id: cmd.id,
            localisation: cmd.coursier_nom || "Entrepôt",
            stock_avant: produit.stock_global,
            stock_apres: stockGlobal,
          });
        }
      }

      await adminApi.updateCommandeVendeur(cmd.id, {
        statut: "echec_livraison",
        notes_admin: notesAdmin || cmd.notes_admin,
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: cmd.vendeur_id,
        vendeur_email: cmd.vendeur_email,
        titre: "Échec de livraison",
        message: `La livraison de ${cmd.produit_nom} pour ${cmd.client_nom} a échoué. Le stock a été restitué.`,
        type: "alerte",
      });
    } catch (err) { console.error("marquerEchec:", err); }
    queryClient.invalidateQueries({ queryKey: ["commandes_vendeurs_admin"] });
    setEnCours(false);
    setCommandeSelectionnee(null);
  };

  const enregistrerRetour = async () => {
    setEnCours(true);
    try {
      await adminApi.createRetourProduit({
        commande_id: commandeSelectionnee.id,
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        produit_id: commandeSelectionnee.produit_id,
        produit_nom: commandeSelectionnee.produit_nom,
        quantite_retournee: parseInt(retourForm.quantite) || 1,
        raison: retourForm.raison,
        raison_detail: retourForm.raison_detail,
        statut: "en_attente",
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Retour enregistré",
        message: `Un retour de ${retourForm.quantite}x ${commandeSelectionnee.produit_nom} a été enregistré et est en cours de traitement.`,
        type: "alerte",
      });
      await adminApi.createJournalAudit({
        action: "Retour produit enregistré",
        module: "commande",
        details: `Retour de ${retourForm.quantite}x ${commandeSelectionnee.produit_nom} — Raison: ${retourForm.raison}`,
        entite_id: commandeSelectionnee.id,
      });
    } catch (err) { console.error("enregistrerRetour:", err); }
    setModalRetour(false);
    setEnCours(false);
    setCommandeSelectionnee(null);
    navigate(createPageUrl("RetoursAdmin"));
  };

  const annulerCommande = async () => {
    setEnCours(true);
    try {
      const cmd = commandeSelectionnee;
      const quantite = cmd.quantite || 1;

      // Restore stock if order was in progress
      const statutsAvecStock = ["en_attente_validation_admin", "validee_admin", "attribuee_livreur", "en_livraison"];
      if (statutsAvecStock.includes(cmd.statut) && cmd.produit_id) {
        const { data: produit } = await supabase
          .from("produits")
          .select("stocks_par_coursier, stock_global")
          .eq("id", cmd.produit_id)
          .single();

        if (produit) {
          const stockGlobal = (Number(produit.stock_global) || 0) + quantite;
          const stocksParCoursier = Array.isArray(produit.stocks_par_coursier) ? [...produit.stocks_par_coursier] : [];

          if (cmd.coursier_id) {
            const idx = stocksParCoursier.findIndex(s => s.coursier_id === cmd.coursier_id);
            if (idx >= 0) {
              stocksParCoursier[idx] = { ...stocksParCoursier[idx] };
              stocksParCoursier[idx].stock_total = (stocksParCoursier[idx].stock_total || 0) + quantite;
              if (cmd.variation && Array.isArray(stocksParCoursier[idx].stock_par_variation)) {
                stocksParCoursier[idx].stock_par_variation = stocksParCoursier[idx].stock_par_variation.map(v =>
                  v.variation_key === cmd.variation
                    ? { ...v, quantite: (v.quantite || 0) + quantite }
                    : v
                );
              }
            }
          }

          await supabase.from("produits").update({
            stock_global: stockGlobal,
            stocks_par_coursier: stocksParCoursier,
          }).eq("id", cmd.produit_id);

          await supabase.from("mouvements_stock").insert({
            produit_id: cmd.produit_id,
            quantite,
            type: "entree",
            notes: `Stock restauré - Annulation - Commande ${cmd.reference_commande || cmd.id}`,
            reference_id: cmd.id,
            localisation: cmd.coursier_nom || "Entrepôt",
            stock_avant: produit.stock_global,
            stock_apres: stockGlobal,
          });
        }
      }

      await adminApi.updateCommandeVendeur(cmd.id, {
        statut: "annulee",
        notes_admin: notesAdmin || cmd.notes_admin,
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: cmd.vendeur_id,
        vendeur_email: cmd.vendeur_email,
        titre: "Commande annulée",
        message: `Votre commande de ${cmd.produit_nom} pour ${cmd.client_nom} a été annulée.`,
        type: "alerte",
      });
      await adminApi.createJournalAudit({
        action: "Commande annulée",
        module: "commande",
        details: `Commande ${cmd.id} annulée`,
        entite_id: cmd.id,
      });
    } catch (err) { console.error("annulerCommande:", err); }
    queryClient.invalidateQueries({ queryKey: ["commandes_vendeurs_admin"] });
    setEnCours(false);
    setCommandeSelectionnee(null);
  };

  const commandesFiltrees = commandes.filter(c => {
    const texte = `${c.produit_nom} ${c.vendeur_nom} ${c.client_nom} ${c.client_ville}`.toLowerCase();
    return (filtreStatut === "tous" || c.statut === filtreStatut) && (!recherche || texte.includes(recherche.toLowerCase()));
  });

  const formater = n => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const formaterDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—";

  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      {nbEnAttente > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{nbEnAttente}</span>
          <p className="text-sm text-yellow-800 font-medium">{nbEnAttente} commande{nbEnAttente > 1 ? "s" : ""} en attente de validation</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtreStatut} onValueChange={v => setFiltreStatut(v)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            {Object.entries(STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {commandesFiltrees.length === 0 && (
          <div className="p-8 text-center text-slate-400">Aucune commande</div>
        )}
        {commandesFiltrees.map(c => (
          <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer" onClick={() => { setCommandeSelectionnee(c); setNotesAdmin(c.notes_admin || ""); setLivreurNom(c.coursier_nom || ""); }}>
            <div className="flex-1 min-w-0 mr-3">
              <p className="font-medium text-sm text-slate-900 truncate">{c.produit_nom} <span className="text-slate-400 font-normal">× {c.quantite}</span></p>
              <p className="text-xs text-slate-500">{c.vendeur_nom} → {c.client_nom} ({c.client_ville})</p>
              <p className="text-xs text-slate-400">{formaterDate(c.created_at)} • Commission: {formater(c.commission_calculee)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${STATUTS[c.statut]?.couleur} border text-xs whitespace-nowrap`}>{STATUTS[c.statut]?.label}</Badge>
              <Eye className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!commandeSelectionnee} onOpenChange={() => setCommandeSelectionnee(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Commande : {commandeSelectionnee?.produit_nom}</DialogTitle>
            <DialogDescription>Réf: {commandeSelectionnee?.reference_commande || "—"}</DialogDescription>
          </DialogHeader>
          {commandeSelectionnee && (
            <div className="space-y-4 text-sm">
              <Badge className={`${STATUTS[commandeSelectionnee.statut]?.couleur} border`}>{STATUTS[commandeSelectionnee.statut]?.label}</Badge>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-3">
                <div><p className="text-slate-400 text-xs">Vendeur</p><p className="font-medium">{commandeSelectionnee.vendeur_nom}</p></div>
                <div><p className="text-slate-400 text-xs">Quantité</p><p className="font-medium">{commandeSelectionnee.quantite}</p></div>
                <div><p className="text-slate-400 text-xs">Prix client</p><p className="font-bold">{formater(commandeSelectionnee.prix_final_client)}</p></div>
                <div><p className="text-slate-400 text-xs">Commission vendeur</p><p className="font-bold text-yellow-600">{formater(commandeSelectionnee.commission_calculee)}</p></div>
                <div><p className="text-slate-400 text-xs">Client</p><p className="font-medium">{commandeSelectionnee.client_nom}</p></div>
                <div><p className="text-slate-400 text-xs">Téléphone</p><p className="font-medium">{commandeSelectionnee.client_telephone}</p></div>
                <div className="col-span-2"><p className="text-slate-400 text-xs">Adresse</p><p className="font-medium">{commandeSelectionnee.client_ville}{commandeSelectionnee.client_quartier ? `, ${commandeSelectionnee.client_quartier}` : ""}{commandeSelectionnee.client_adresse ? ` – ${commandeSelectionnee.client_adresse}` : ""}</p></div>
                {commandeSelectionnee.coursier_nom && <div className="col-span-2"><p className="text-slate-400 text-xs">Coursier</p><p className="font-medium">{commandeSelectionnee.coursier_nom}</p></div>}
                {commandeSelectionnee.notes && <div className="col-span-2"><p className="text-slate-400 text-xs">Notes vendeur</p><p>{commandeSelectionnee.notes}</p></div>}
              </div>

              <div className="space-y-1">
                <label className="text-slate-500 text-xs font-medium">Note admin (visible par le vendeur)</label>
                <Textarea value={notesAdmin} onChange={e => setNotesAdmin(e.target.value)} placeholder="Message au vendeur..." rows={2} />
              </div>

              {/* Actions selon statut */}
              <div className="space-y-2">
                {commandeSelectionnee.statut === "en_attente_validation_admin" && (
                  <Button onClick={validerCommande} disabled={enCours} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Valider la commande
                  </Button>
                )}
                {(commandeSelectionnee.statut === "validee_admin") && (
                  <div className="space-y-2">
                    {(() => {
                      const villeClient = (commandeSelectionnee.client_ville || "").toLowerCase().trim();
                      const livreursVille = livreurs.filter(l =>
                        l.zones_couvertes?.some(z => z.ville?.toLowerCase().trim() === villeClient)
                      );
                      return livreursVille.length > 0 ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                          <p className="text-xs font-semibold text-emerald-700">Livreurs disponibles à {commandeSelectionnee.client_ville} :</p>
                          {livreursVille.map(l => (
                            <button key={l.id} onClick={() => setLivreurNom(l.nom)} className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${livreurNom === l.nom ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-emerald-200 hover:bg-emerald-100 text-slate-800"}`}>
                              <span className="font-medium">{l.nom}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-xl p-2">Aucun livreur enregistré pour <strong>{commandeSelectionnee.client_ville}</strong></p>
                      );
                    })()}
                    <div className="space-y-1">
                      <label className="text-slate-500 text-xs font-medium">Ou saisir manuellement *</label>
                      <Input value={livreurNom} onChange={e => setLivreurNom(e.target.value)} placeholder="Nom du livreur..." />
                    </div>
                    <Button onClick={attribuerLivreur} disabled={enCours || !livreurNom.trim()} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2">
                      <Truck className="w-4 h-4" /> Attribuer le livreur
                    </Button>
                  </div>
                )}
                {commandeSelectionnee.statut === "attribuee_livreur" && (
                  <Button onClick={marquerEnLivraison} disabled={enCours} className="w-full bg-purple-600 hover:bg-purple-700 gap-2">
                    <Truck className="w-4 h-4" /> Marquer en livraison
                  </Button>
                )}
                {commandeSelectionnee.statut === "en_livraison" && (
                  <Button onClick={marquerLivree} disabled={enCours} className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                    <PackageCheck className="w-4 h-4" /> Confirmer livraison
                  </Button>
                )}
                {commandeSelectionnee.statut === "livree" && (
                  <Button onClick={() => { setRetourForm({ raison: "client_refuse", raison_detail: "", quantite: commandeSelectionnee.quantite }); setModalRetour(true); }} variant="outline" className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 gap-2">
                    <RotateCcw className="w-4 h-4" /> Enregistrer un retour
                  </Button>
                )}
                {!["livree", "echec_livraison", "annulee"].includes(commandeSelectionnee.statut) && (
                  <div className="flex gap-2">
                    {["en_livraison", "attribuee_livreur", "validee_admin"].includes(commandeSelectionnee.statut) && (
                      <Button onClick={marquerEchec} disabled={enCours} variant="outline" className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50 gap-2">
                        <XCircle className="w-4 h-4" /> Échec livraison
                      </Button>
                    )}
                    <Button onClick={annulerCommande} disabled={enCours} variant="outline" className="flex-1 border-red-300 text-red-600 hover:bg-red-50 gap-2">
                      <XCircle className="w-4 h-4" /> Annuler
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Modal Retour */}
      <Dialog open={modalRetour} onOpenChange={setModalRetour}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-orange-500" /> Enregistrer un retour
          </DialogTitle>
          <DialogDescription>Renseignez les détails du retour produit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-slate-500">Commande : <span className="font-medium text-slate-800">{commandeSelectionnee?.produit_nom} × {commandeSelectionnee?.quantite}</span></p>
          <div className="space-y-1">
            <label className="text-slate-500 text-xs font-medium">Quantité retournée *</label>
            <Input type="number" min="1" max={commandeSelectionnee?.quantite} value={retourForm.quantite}
              onChange={e => setRetourForm(f => ({ ...f, quantite: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 text-xs font-medium">Raison *</label>
            <Select value={retourForm.raison} onValueChange={v => setRetourForm(f => ({ ...f, raison: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="defaut_produit">Défaut produit</SelectItem>
                <SelectItem value="mauvaise_livraison">Mauvaise livraison</SelectItem>
                <SelectItem value="client_refuse">Client a refusé</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-slate-500 text-xs font-medium">Détail (optionnel)</label>
            <Textarea value={retourForm.raison_detail} onChange={e => setRetourForm(f => ({ ...f, raison_detail: e.target.value }))} rows={2} placeholder="Précisions..." />
          </div>
          <Button onClick={enregistrerRetour} disabled={enCours} className="w-full bg-orange-500 hover:bg-orange-600 gap-2">
            {enCours ? <RotateCcw className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Confirmer le retour
          </Button>
        </div>
      </DialogContent>
      </Dialog>
    </div>
  );
}
