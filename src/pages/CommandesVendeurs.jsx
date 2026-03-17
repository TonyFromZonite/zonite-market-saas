import React, { useState, useEffect } from "react";
import { requireAdminOrSousAdmin } from "@/components/useSessionGuard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/components/adminApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, CheckCircle2, Truck, XCircle, PackageCheck, RotateCcw, MapPin, Phone, Calendar, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STATUTS = {
  en_attente_validation_admin: { label: "En attente", couleur: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: "⏳" },
  validee_admin:               { label: "Validée", couleur: "bg-blue-100 text-blue-800 border-blue-200", icon: "✅" },
  attribuee_livreur:           { label: "Coursier assigné", couleur: "bg-indigo-100 text-indigo-800 border-indigo-200", icon: "🏢" },
  en_livraison:                { label: "En livraison", couleur: "bg-purple-100 text-purple-800 border-purple-200", icon: "🚚" },
  livree:                      { label: "Livrée", couleur: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: "✓" },
  echec_livraison:             { label: "Échec livraison", couleur: "bg-orange-100 text-orange-800 border-orange-200", icon: "❌" },
  annulee:                     { label: "Annulée", couleur: "bg-red-100 text-red-800 border-red-200", icon: "🚫" },
};

export default function CommandesVendeurs() {
  useEffect(() => { requireAdminOrSousAdmin(); }, []);
  const [recherche, setRecherche] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [commandeSelectionnee, setCommandeSelectionnee] = useState(null);
  const [notesAdmin, setNotesAdmin] = useState("");
  const [coursierSelectionne, setCoursierSelectionne] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [modalRetour, setModalRetour] = useState(false);
  const [retourForm, setRetourForm] = useState({ raison: "client_refuse", raison_detail: "", quantite: 1 });
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch commandes with seller info
  const { data: commandes = [], isLoading } = useQuery({
    queryKey: ["commandes_vendeurs_admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commandes_vendeur")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch coursiers
  const { data: coursiers = [] } = useQuery({
    queryKey: ["coursiers_actifs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coursiers")
        .select("*")
        .eq("actif", true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch sellers for display names
  const { data: sellers = [] } = useQuery({
    queryKey: ["sellers_list_commandes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sellers").select("id, full_name, email");
      if (error) throw error;
      return data || [];
    },
  });

  const getSellerName = (vendeurId) => {
    const s = sellers.find(s => s.id === vendeurId);
    return s ? s.full_name : "Vendeur";
  };

  const nbEnAttente = commandes.filter(c => c.statut === "en_attente_validation_admin").length;

  const showSuccess = (msg) => toast({ title: "Succès", description: msg });
  const showError = (msg) => toast({ title: "Erreur", description: msg, variant: "destructive" });

  const refreshCommandes = () => queryClient.invalidateQueries({ queryKey: ["commandes_vendeurs_admin"] });

  // Find coursiers that can deliver to the client's city
  const getCoursiersPourVille = (villeClient) => {
    if (!villeClient) return coursiers;
    const villeNorm = villeClient.toLowerCase().trim();
    return coursiers.filter(c => {
      // Check if coursier's ville matches
      // We need to look up the ville name
      return true; // Show all active coursiers, admin picks the right one
    });
  };

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
        message: `Votre commande de ${commandeSelectionnee.quantite}x ${commandeSelectionnee.produit_nom} pour ${commandeSelectionnee.client_nom} a été validée.`,
        type: "succes",
      });
      await adminApi.createJournalAudit({
        action: "Validation commande",
        module: "commande",
        details: `Commande ${commandeSelectionnee.reference_commande || commandeSelectionnee.id} validée`,
        entite_id: commandeSelectionnee.id,
      });
      showSuccess("Commande validée");
      refreshCommandes();
      setCommandeSelectionnee(null);
    } catch (err) {
      showError(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const attribuerCoursier = async () => {
    if (!coursierSelectionne) return;
    setEnCours(true);
    try {
      const coursier = coursiers.find(c => c.id === coursierSelectionne);
      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, {
        statut: "attribuee_livreur",
        coursier_id: coursierSelectionne,
        coursier_nom: coursier?.nom || "",
        frais_livraison: coursier?.frais_livraison_defaut || 0,
        notes_admin: notesAdmin || commandeSelectionnee.notes_admin,
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Coursier assigné 🏢",
        message: `Le coursier ${coursier?.nom} a été assigné à votre commande pour ${commandeSelectionnee.client_nom}.`,
        type: "info",
      });
      await adminApi.createJournalAudit({
        action: "Attribution coursier",
        module: "commande",
        details: `Coursier "${coursier?.nom}" assigné à la commande ${commandeSelectionnee.reference_commande || commandeSelectionnee.id}`,
        entite_id: commandeSelectionnee.id,
      });
      showSuccess(`Coursier ${coursier?.nom} assigné`);
      refreshCommandes();
      setCommandeSelectionnee(null);
    } catch (err) {
      showError(err.message);
    } finally {
      setEnCours(false);
    }
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
      showSuccess("Commande marquée en livraison");
      refreshCommandes();
      setCommandeSelectionnee(null);
    } catch (err) {
      showError(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const marquerLivree = async () => {
    setEnCours(true);
    try {
      // Deduct stock from coursier's stocks_par_coursier
      if (commandeSelectionnee.produit_id && commandeSelectionnee.coursier_id) {
        const { data: produit } = await supabase
          .from("produits")
          .select("stocks_par_coursier, stock_global")
          .eq("id", commandeSelectionnee.produit_id)
          .single();

        if (produit) {
          const stocks = Array.isArray(produit.stocks_par_coursier) ? [...produit.stocks_par_coursier] : [];
          const coursierStock = stocks.find(s => s.coursier_id === commandeSelectionnee.coursier_id);
          const variation = commandeSelectionnee.variation;
          const qty = commandeSelectionnee.quantite || 1;

          if (coursierStock && variation) {
            const varStock = coursierStock.stock_par_variation?.find(v => v.variation_key === variation);
            if (varStock) {
              varStock.quantite = Math.max(0, (varStock.quantite || 0) - qty);
            }
            coursierStock.stock_total = Math.max(0, (coursierStock.stock_total || 0) - qty);
          } else if (coursierStock) {
            coursierStock.stock_total = Math.max(0, (coursierStock.stock_total || 0) - qty);
          }

          const newGlobal = Math.max(0, (produit.stock_global || 0) - qty);
          await supabase.from("produits").update({
            stocks_par_coursier: stocks,
            stock_global: newGlobal,
          }).eq("id", commandeSelectionnee.produit_id);

          await adminApi.createMouvementStock({
            produit_id: commandeSelectionnee.produit_id,
            type: "sortie",
            quantite: qty,
            stock_avant: produit.stock_global || 0,
            stock_apres: newGlobal,
            notes: `Livraison commande ${commandeSelectionnee.reference_commande || commandeSelectionnee.id}`,
          });
        }
      }

      // Credit seller commission
      const { data: seller } = await supabase
        .from("sellers")
        .select("solde_commission, total_commissions_gagnees, taux_commission")
        .eq("id", commandeSelectionnee.vendeur_id)
        .single();

      const tauxCommission = seller?.taux_commission || 10;
      const commission = (commandeSelectionnee.montant_total * tauxCommission) / 100;

      if (seller) {
        await supabase.from("sellers").update({
          solde_commission: (seller.solde_commission || 0) + commission,
          total_commissions_gagnees: (seller.total_commissions_gagnees || 0) + commission,
        }).eq("id", commandeSelectionnee.vendeur_id);
      }

      // Create vente record
      await supabase.from("ventes").insert({
        commande_id: commandeSelectionnee.id,
        produit_id: commandeSelectionnee.produit_id,
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        quantite: commandeSelectionnee.quantite || 1,
        montant_total: commandeSelectionnee.montant_total,
        commission_vendeur: commission,
        profit_zonite: commandeSelectionnee.montant_total - commission,
        taux_commission_applique: tauxCommission,
      });

      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, {
        statut: "livree",
        date_livraison_effective: new Date().toISOString(),
        notes_admin: notesAdmin || commandeSelectionnee.notes_admin,
      });

      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Commande livrée ✓",
        message: `${commandeSelectionnee.produit_nom} livré à ${commandeSelectionnee.client_nom}. Commission de ${Math.round(commission).toLocaleString("fr-FR")} FCFA créditée.`,
        type: "succes",
      });

      showSuccess("Livraison confirmée, commission créditée");
      refreshCommandes();
      setCommandeSelectionnee(null);
    } catch (err) {
      showError(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const marquerEchec = async () => {
    setEnCours(true);
    try {
      // Restore stock to coursier
      if (commandeSelectionnee.produit_id && commandeSelectionnee.coursier_id) {
        const { data: produit } = await supabase
          .from("produits")
          .select("stocks_par_coursier, stock_global")
          .eq("id", commandeSelectionnee.produit_id)
          .single();

        if (produit) {
          const stocks = Array.isArray(produit.stocks_par_coursier) ? [...produit.stocks_par_coursier] : [];
          const coursierStock = stocks.find(s => s.coursier_id === commandeSelectionnee.coursier_id);
          const variation = commandeSelectionnee.variation;
          const qty = commandeSelectionnee.quantite || 1;

          if (coursierStock && variation) {
            const varStock = coursierStock.stock_par_variation?.find(v => v.variation_key === variation);
            if (varStock) varStock.quantite = (varStock.quantite || 0) + qty;
            coursierStock.stock_total = (coursierStock.stock_total || 0) + qty;
          } else if (coursierStock) {
            coursierStock.stock_total = (coursierStock.stock_total || 0) + qty;
          }

          await supabase.from("produits").update({
            stocks_par_coursier: stocks,
            stock_global: (produit.stock_global || 0) + qty,
          }).eq("id", commandeSelectionnee.produit_id);

          await adminApi.createMouvementStock({
            produit_id: commandeSelectionnee.produit_id,
            type: "entree",
            quantite: qty,
            stock_avant: produit.stock_global || 0,
            stock_apres: (produit.stock_global || 0) + qty,
            notes: `Échec livraison — commande ${commandeSelectionnee.reference_commande || commandeSelectionnee.id}`,
          });
        }
      }

      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, {
        statut: "echec_livraison",
        notes_admin: notesAdmin || commandeSelectionnee.notes_admin,
      });

      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Échec de livraison",
        message: `La livraison de ${commandeSelectionnee.produit_nom} pour ${commandeSelectionnee.client_nom} a échoué. Le stock a été restitué.`,
        type: "alerte",
      });

      showSuccess("Échec enregistré, stock restitué");
      refreshCommandes();
      setCommandeSelectionnee(null);
    } catch (err) {
      showError(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const annulerCommande = async () => {
    setEnCours(true);
    try {
      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, {
        statut: "annulee",
        notes_admin: notesAdmin || commandeSelectionnee.notes_admin,
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Commande annulée",
        message: `Votre commande de ${commandeSelectionnee.produit_nom} pour ${commandeSelectionnee.client_nom} a été annulée.`,
        type: "alerte",
      });
      await adminApi.createJournalAudit({
        action: "Commande annulée",
        module: "commande",
        details: `Commande ${commandeSelectionnee.reference_commande || commandeSelectionnee.id} annulée`,
        entite_id: commandeSelectionnee.id,
      });
      showSuccess("Commande annulée");
      refreshCommandes();
      setCommandeSelectionnee(null);
    } catch (err) {
      showError(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const enregistrerRetour = async () => {
    setEnCours(true);
    try {
      await adminApi.createRetourProduit({
        commande_id: commandeSelectionnee.id,
        vendeur_id: commandeSelectionnee.vendeur_id,
        produit_id: commandeSelectionnee.produit_id,
        quantite_retournee: parseInt(retourForm.quantite) || 1,
        raison: `${retourForm.raison}${retourForm.raison_detail ? ': ' + retourForm.raison_detail : ''}`,
        statut: "en_attente",
      });
      await adminApi.createNotificationVendeur({
        vendeur_id: commandeSelectionnee.vendeur_id,
        vendeur_email: commandeSelectionnee.vendeur_email,
        titre: "Retour enregistré",
        message: `Un retour de ${retourForm.quantite}x ${commandeSelectionnee.produit_nom} a été enregistré.`,
        type: "alerte",
      });
      showSuccess("Retour enregistré");
      setModalRetour(false);
      setCommandeSelectionnee(null);
      navigate("/RetoursAdmin");
    } catch (err) {
      showError(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const commandesFiltrees = commandes.filter(c => {
    const texte = `${c.produit_nom} ${getSellerName(c.vendeur_id)} ${c.client_nom} ${c.client_ville} ${c.reference_commande || ""}`.toLowerCase();
    return (filtreStatut === "tous" || c.statut === filtreStatut) && (!recherche || texte.includes(recherche.toLowerCase()));
  });

  const formater = n => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;
  const formaterDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

  if (isLoading) return <div className="space-y-3">{Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      {/* Pending orders banner */}
      {nbEnAttente > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-yellow-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">{nbEnAttente}</span>
          <p className="text-sm text-yellow-800 font-medium">{nbEnAttente} commande{nbEnAttente > 1 ? "s" : ""} en attente de validation</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Rechercher produit, vendeur, client..." value={recherche} onChange={e => setRecherche(e.target.value)} className="pl-9" />
        </div>
        <Select value={filtreStatut} onValueChange={v => setFiltreStatut(v)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les statuts</SelectItem>
            {Object.entries(STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {Object.entries(STATUTS).map(([k, v]) => {
          const count = commandes.filter(c => c.statut === k).length;
          return (
            <button key={k} onClick={() => setFiltreStatut(k === filtreStatut ? "tous" : k)}
              className={`text-center p-2 rounded-lg border text-xs transition-colors ${k === filtreStatut ? "ring-2 ring-primary" : ""} ${v.couleur}`}>
              <div className="font-bold text-lg">{count}</div>
              <div className="truncate">{v.label}</div>
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      <div className="bg-card rounded-xl border divide-y">
        {commandesFiltrees.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Aucune commande trouvée</div>
        )}
        {commandesFiltrees.map(c => (
          <div key={c.id} className="p-4 flex items-center justify-between hover:bg-muted/50 cursor-pointer transition-colors"
            onClick={() => { setCommandeSelectionnee(c); setNotesAdmin(c.notes_admin || ""); setCoursierSelectionne(c.coursier_id || ""); }}>
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm truncate">
                  {c.produit_nom}
                  {c.variation && <span className="text-muted-foreground font-normal"> ({c.variation})</span>}
                  <span className="text-muted-foreground font-normal"> × {c.quantite}</span>
                </p>
                {c.reference_commande && <span className="text-xs text-muted-foreground">#{c.reference_commande}</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                {getSellerName(c.vendeur_id)} → {c.client_nom}
                {c.client_ville && <span> ({c.client_ville})</span>}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span>{formaterDate(c.created_at)}</span>
                <span className="font-semibold text-foreground">{formater(c.montant_total)}</span>
                {c.coursier_nom && <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{c.coursier_nom}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${STATUTS[c.statut]?.couleur} border text-xs whitespace-nowrap`}>{STATUTS[c.statut]?.label}</Badge>
              <Eye className="w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      {/* Order detail modal */}
      <Dialog open={!!commandeSelectionnee} onOpenChange={() => setCommandeSelectionnee(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {commandeSelectionnee?.reference_commande && <span className="text-muted-foreground text-sm">#{commandeSelectionnee.reference_commande}</span>}
              {commandeSelectionnee?.produit_nom}
            </DialogTitle>
          </DialogHeader>
          {commandeSelectionnee && (
            <div className="space-y-4 text-sm">
              <Badge className={`${STATUTS[commandeSelectionnee.statut]?.couleur} border`}>
                {STATUTS[commandeSelectionnee.statut]?.icon} {STATUTS[commandeSelectionnee.statut]?.label}
              </Badge>

              {/* Order details */}
              <div className="grid grid-cols-2 gap-3 bg-muted/50 rounded-xl p-3">
                <div><p className="text-muted-foreground text-xs">Vendeur</p><p className="font-medium">{getSellerName(commandeSelectionnee.vendeur_id)}</p></div>
                <div><p className="text-muted-foreground text-xs">Quantité</p><p className="font-medium">{commandeSelectionnee.quantite} {commandeSelectionnee.variation && `(${commandeSelectionnee.variation})`}</p></div>
                <div><p className="text-muted-foreground text-xs">Prix unitaire</p><p className="font-bold">{formater(commandeSelectionnee.prix_unitaire)}</p></div>
                <div><p className="text-muted-foreground text-xs">Montant total</p><p className="font-bold">{formater(commandeSelectionnee.montant_total)}</p></div>
              </div>

              {/* Client info */}
              <div className="bg-muted/50 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Client</p>
                <div className="flex items-center gap-2"><span className="font-medium">{commandeSelectionnee.client_nom}</span></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3" /> {commandeSelectionnee.client_telephone}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  {commandeSelectionnee.client_ville}
                  {commandeSelectionnee.client_quartier && `, ${commandeSelectionnee.client_quartier}`}
                  {commandeSelectionnee.client_adresse && ` — ${commandeSelectionnee.client_adresse}`}
                </div>
              </div>

              {/* Coursier info */}
              {commandeSelectionnee.coursier_nom && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-indigo-600 uppercase mb-1">Coursier assigné</p>
                  <p className="font-medium text-indigo-900">{commandeSelectionnee.coursier_nom}</p>
                  {commandeSelectionnee.frais_livraison > 0 && (
                    <p className="text-xs text-indigo-600">Frais livraison : {formater(commandeSelectionnee.frais_livraison)}</p>
                  )}
                </div>
              )}

              {/* Delivery date */}
              {commandeSelectionnee.date_livraison_effective && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <Calendar className="w-3 h-3" /> Livrée le {formaterDate(commandeSelectionnee.date_livraison_effective)}
                </div>
              )}

              {commandeSelectionnee.notes && (
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-xs text-muted-foreground">Notes vendeur</p>
                  <p className="text-sm">{commandeSelectionnee.notes}</p>
                </div>
              )}

              {/* Admin notes */}
              <div className="space-y-1">
                <label className="text-muted-foreground text-xs font-medium">Note admin</label>
                <Textarea value={notesAdmin} onChange={e => setNotesAdmin(e.target.value)} placeholder="Message interne..." rows={2} />
              </div>

              {/* Actions by status */}
              <div className="space-y-2 pt-2 border-t">
                {commandeSelectionnee.statut === "en_attente_validation_admin" && (
                  <Button onClick={validerCommande} disabled={enCours} className="w-full bg-blue-600 hover:bg-blue-700 gap-2">
                    {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Valider la commande
                  </Button>
                )}

                {commandeSelectionnee.statut === "validee_admin" && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">Assigner un coursier :</p>
                    {/* Coursiers grouped by matching city */}
                    <Select value={coursierSelectionne} onValueChange={setCoursierSelectionne}>
                      <SelectTrigger><SelectValue placeholder="Choisir un coursier..." /></SelectTrigger>
                      <SelectContent>
                        {coursiers.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nom} {c.adresse_entrepot && `— ${c.adresse_entrepot}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={attribuerCoursier} disabled={enCours || !coursierSelectionne} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2">
                      {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Attribuer le coursier
                    </Button>
                  </div>
                )}

                {commandeSelectionnee.statut === "attribuee_livreur" && (
                  <Button onClick={marquerEnLivraison} disabled={enCours} className="w-full bg-purple-600 hover:bg-purple-700 gap-2">
                    {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Marquer en livraison
                  </Button>
                )}

                {commandeSelectionnee.statut === "en_livraison" && (
                  <Button onClick={marquerLivree} disabled={enCours} className="w-full bg-emerald-600 hover:bg-emerald-700 gap-2">
                    {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Confirmer livraison
                  </Button>
                )}

                {commandeSelectionnee.statut === "livree" && (
                  <Button onClick={() => { setRetourForm({ raison: "client_refuse", raison_detail: "", quantite: commandeSelectionnee.quantite }); setModalRetour(true); }}
                    variant="outline" className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 gap-2">
                    <RotateCcw className="w-4 h-4" /> Enregistrer un retour
                  </Button>
                )}

                {/* Échec / Annuler */}
                {!["livree", "echec_livraison", "annulee"].includes(commandeSelectionnee.statut) && (
                  <div className="flex gap-2">
                    {["en_livraison", "attribuee_livreur", "validee_admin"].includes(commandeSelectionnee.statut) && (
                      <Button onClick={marquerEchec} disabled={enCours} variant="outline" className="flex-1 border-orange-300 text-orange-600 hover:bg-orange-50 gap-2">
                        <XCircle className="w-4 h-4" /> Échec
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

      {/* Retour modal */}
      <Dialog open={modalRetour} onOpenChange={setModalRetour}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-orange-500" /> Enregistrer un retour
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Commande : <span className="font-medium text-foreground">{commandeSelectionnee?.produit_nom} × {commandeSelectionnee?.quantite}</span>
            </p>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">Quantité retournée *</label>
              <Input type="number" min="1" max={commandeSelectionnee?.quantite} value={retourForm.quantite}
                onChange={e => setRetourForm(f => ({ ...f, quantite: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-muted-foreground text-xs font-medium">Raison *</label>
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
              <label className="text-muted-foreground text-xs font-medium">Détail (optionnel)</label>
              <Textarea value={retourForm.raison_detail} onChange={e => setRetourForm(f => ({ ...f, raison_detail: e.target.value }))} rows={2} placeholder="Précisions..." />
            </div>
            <Button onClick={enregistrerRetour} disabled={enCours} className="w-full bg-orange-500 hover:bg-orange-600 gap-2">
              {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Confirmer le retour
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
