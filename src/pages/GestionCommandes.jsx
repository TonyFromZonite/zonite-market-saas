import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/components/adminApi";
import { supabase } from "@/integrations/supabase/client";
import { stockManager } from "@/lib/stockManager";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Truck, Loader2, AlertTriangle, MapPin, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { listTable } from "@/lib/supabaseHelpers";

const STATUTS = {
  en_attente_validation_admin: { label: "En attente", color: "bg-yellow-100 text-yellow-700" },
  validee_admin: { label: "Validée", color: "bg-blue-100 text-blue-700" },
  attribuee_livreur: { label: "Attribuée", color: "bg-purple-100 text-purple-700" },
  en_livraison: { label: "En livraison", color: "bg-orange-100 text-orange-700" },
  livree: { label: "Livrée", color: "bg-emerald-100 text-emerald-700" },
  echec_livraison: { label: "Échec", color: "bg-red-100 text-red-700" },
  annulee: { label: "Annulée", color: "bg-slate-100 text-slate-700" },
};

export default function GestionCommandes() {
  const [filtreStatut, setFiltreStatut] = useState("all");
  const [dialogOuvert, setDialogOuvert] = useState(false);
  const [commandeSelectionnee, setCommandeSelectionnee] = useState(null);
  const [coursiersDisponibles, setCoursiersDisponibles] = useState([]);
  const [coursierSelectionne, setCoursierSelectionne] = useState("");
  const [nouveauStatut, setNouveauStatut] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [coursierError, setCoursierError] = useState(null);
  const [loadingCoursiers, setLoadingCoursiers] = useState(false);
  const queryClient = useQueryClient();

  const { data: commandes = [], isLoading: loadingCommandes } = useQuery({
    queryKey: ["commandes_vendeur"],
    queryFn: async () => {
      const { data } = await supabase.from("commandes_vendeur").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const commandesFiltrees = filtreStatut === "all"
    ? commandes
    : commandes.filter(c => c.statut === filtreStatut);

  // Find coursiers matching the order's city
  const findCoursiersForCommande = async (cmd) => {
    setLoadingCoursiers(true);
    setCoursierError(null);
    setCoursiersDisponibles([]);

    try {
      if (!cmd.client_ville) {
        // No city on order — load all active coursiers
        const { data: allCoursiers } = await supabase
          .from("coursiers")
          .select("id, nom, telephone, frais_livraison_defaut, ville_id, actif")
          .eq("actif", true);
        setCoursiersDisponibles(allCoursiers || []);
        setCoursierError("⚠️ Aucune ville spécifiée sur la commande. Tous les coursiers sont affichés.");
        return;
      }

      // Step 1: Find ville_id from city name
      const { data: villes } = await supabase
        .from("villes_cameroun")
        .select("id, nom")
        .ilike("nom", `%${cmd.client_ville.trim()}%`);

      const ville = villes?.[0];

      if (!ville) {
        // City not found — show all coursiers with warning
        const { data: allCoursiers } = await supabase
          .from("coursiers")
          .select("id, nom, telephone, frais_livraison_defaut, ville_id, actif")
          .eq("actif", true);
        setCoursiersDisponibles(allCoursiers || []);
        setCoursierError(`Ville "${cmd.client_ville}" introuvable. Tous les coursiers sont affichés.`);
        return;
      }

      // Step 2: Find coursiers in that city
      const { data: coursiers } = await supabase
        .from("coursiers")
        .select("id, nom, telephone, frais_livraison_defaut, ville_id, actif")
        .eq("ville_id", ville.id)
        .eq("actif", true);

      if (!coursiers || coursiers.length === 0) {
        // No coursiers in city — show all with warning
        const { data: allCoursiers } = await supabase
          .from("coursiers")
          .select("id, nom, telephone, frais_livraison_defaut, ville_id, actif")
          .eq("actif", true);
        setCoursiersDisponibles(allCoursiers || []);
        setCoursierError(`Aucun coursier actif à ${cmd.client_ville}. Tous les coursiers sont affichés.`);
        return;
      }

      // Step 3: Check stock if product is set
      if (cmd.produit_id) {
        const { data: produit } = await supabase
          .from("produits")
          .select("stocks_par_coursier")
          .eq("id", cmd.produit_id)
          .single();

        if (produit?.stocks_par_coursier && Array.isArray(produit.stocks_par_coursier)) {
          const coursiersAvecStock = coursiers.filter(c => {
            const stockInfo = produit.stocks_par_coursier.find(s => s.coursier_id === c.id);
            if (!stockInfo) return false;

            if (cmd.variation) {
              const varStock = stockInfo.stock_par_variation?.find(
                v => v.variation_key === cmd.variation
              );
              return varStock && varStock.quantite >= (cmd.quantite || 1);
            }
            return stockInfo.stock_total >= (cmd.quantite || 1);
          });

          if (coursiersAvecStock.length > 0) {
            setCoursiersDisponibles(coursiersAvecStock);
            return;
          }
          // No stock match — show all city coursiers with warning
          setCoursiersDisponibles(coursiers);
          setCoursierError("Aucun coursier n'a le stock suffisant. Tous les coursiers de la ville sont affichés.");
          return;
        }
      }

      setCoursiersDisponibles(coursiers);
    } catch (err) {
      console.error("findCoursiers error:", err);
      setCoursierError("Erreur lors de la recherche de coursiers.");
    } finally {
      setLoadingCoursiers(false);
    }
  };

  const ouvrir = async (cmd) => {
    setCommandeSelectionnee(cmd);
    setCoursierSelectionne(cmd.coursier_id || "");
    setNouveauStatut(cmd.statut);
    setDialogOuvert(true);
    await findCoursiersForCommande(cmd);
  };

  // === BUSINESS LOGIC: Livraison réussie ===
  const handleLivree = async (commande) => {
    const quantite = commande.quantite || 1;

    const { data: produit } = await supabase
      .from("produits")
      .select("prix_achat, prix_gros, prix_vente, stock_global")
      .eq("id", commande.produit_id)
      .single();

    const { data: seller } = await supabase
      .from("sellers")
      .select("solde_commission, total_commissions_gagnees")
      .eq("id", commande.vendeur_id)
      .single();

    if (!produit || !seller) {
      console.warn("handleLivree: produit ou vendeur introuvable");
      return;
    }

    const prixFinalClient = Number(commande.prix_final_client) || Number(commande.prix_unitaire) || Number(produit.prix_vente) || 0;
    const prixGros = Number(produit.prix_gros) || 0;
    const prixAchat = Number(produit.prix_achat) || 0;

    const commissionVendeur = Math.max(0, (prixFinalClient - prixGros) * quantite);
    const margeZonite = (prixGros - prixAchat) * quantite;
    const caVente = prixFinalClient * quantite;

    const now = new Date();
    const getWeekNumber = (d) => {
      const start = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    };

    // 1. CONFIRM stock removal (already reserved on order creation)
    await stockManager.confirmDelivery(
      commande.produit_id,
      commande.coursier_id,
      commande.variation || null,
      quantite,
      commande.id
    );

    // 2. Insert vente
    await supabase.from("ventes").insert({
      vendeur_id: commande.vendeur_id,
      vendeur_email: commande.vendeur_email,
      produit_id: commande.produit_id,
      commande_id: commande.id,
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

    // 3. Credit seller balance
    const nouveauSolde = (Number(seller.solde_commission) || 0) + commissionVendeur;
    const nouveauTotal = (Number(seller.total_commissions_gagnees) || 0) + commissionVendeur;
    await supabase.from("sellers").update({
      solde_commission: nouveauSolde,
      total_commissions_gagnees: nouveauTotal,
    }).eq("id", commande.vendeur_id);

    // 4. Notify vendor
    await supabase.from("notifications_vendeur").insert({
      vendeur_id: commande.vendeur_id,
      vendeur_email: commande.vendeur_email,
      titre: "🎉 Livraison confirmée !",
      message: `Votre commande ${commande.reference_commande || commande.id} a été livrée avec succès !\n\n📦 Produit : ${commande.produit_nom}${commande.variation ? ` (${commande.variation})` : ""}\n🔢 Quantité : ${quantite}\n💵 Prix de vente : ${prixFinalClient.toLocaleString("fr-FR")} FCFA\n🏷️ Prix de gros : ${prixGros.toLocaleString("fr-FR")} FCFA\n\n💰 Votre commission : ${commissionVendeur.toLocaleString("fr-FR")} FCFA\n💳 Nouveau solde : ${nouveauSolde.toLocaleString("fr-FR")} FCFA`,
      type: "succes",
    });
  };

  // === BUSINESS LOGIC: Échec livraison / Annulation ===
  const handleEchecOrAnnulee = async (commande) => {
    if (!commande.produit_id) return;
    const quantite = commande.quantite || 1;

    // Only restore if stock was reserved and not yet definitively removed
    const stockReserve = commande.stock_reserve !== false;
    const stockRetire = commande.stock_retire_definitif === true;

    if (!stockReserve || stockRetire) return;

    // RESTORE stock to exact variation + exact coursier via stockManager
    await stockManager.restoreStock(
      commande.produit_id,
      commande.coursier_id,
      commande.variation || null,
      quantite,
      commande.id,
      nouveauStatut === "annulee" ? "annulation" : "echec"
    );
  };

  const sauvegarder = async () => {
    if (!commandeSelectionnee) return;
    setEnCours(true);

    try {
      const updateData = { statut: nouveauStatut };

      if (coursierSelectionne) {
        updateData.coursier_id = coursierSelectionne;
        const coursier = coursiersDisponibles.find(c => c.id === coursierSelectionne);
        if (coursier) {
          updateData.coursier_nom = coursier.nom;
        }
      }

      // Add delivery date and stock flags based on status
      if (nouveauStatut === "livree") {
        updateData.date_livraison_effective = new Date().toISOString();
        updateData.stock_retire_definitif = true;
      }
      if (nouveauStatut === "echec_livraison" || nouveauStatut === "annulee") {
        updateData.stock_reserve = false;
        updateData.stock_retire_definitif = false;
      }

      await adminApi.updateCommandeVendeur(commandeSelectionnee.id, updateData);

      // === Business logic based on status transition ===
      if (nouveauStatut === "livree" && commandeSelectionnee.produit_id) {
        await handleLivree(commandeSelectionnee);
      } else if (nouveauStatut === "echec_livraison" || nouveauStatut === "annulee") {
        await handleEchecOrAnnulee(commandeSelectionnee);
      }

      // Notification vendeur (skip for livree — already sent in handleLivree)
      if (nouveauStatut !== "livree") {
        const statusLabels = {
          validee_admin: "✅ Validée par l'admin",
          attribuee_livreur: "🚚 Assignée au livreur",
          en_livraison: "📦 En cours de livraison",
          echec_livraison: "❌ Livraison échouée",
          annulee: "🚫 Annulée",
        };

        const notifMessage = nouveauStatut === "echec_livraison"
          ? `${commandeSelectionnee.produit_nom} - ❌ Livraison échouée. Stock restauré.`
          : `${commandeSelectionnee.produit_nom} - Statut: ${statusLabels[nouveauStatut] || nouveauStatut}`;

        await adminApi.createNotificationVendeur({
          vendeur_id: commandeSelectionnee.vendeur_id,
          vendeur_email: commandeSelectionnee.vendeur_email,
          titre: "📦 Mise à jour commande",
          message: notifMessage,
          type: nouveauStatut === "echec_livraison" ? "alerte" : "info",
          lien: `/MesCommandesVendeur`,
        });
      }

      // Audit
      await adminApi.createJournalAudit({
        action: "Statut commande modifié",
        module: "commande",
        details: `Commande ${commandeSelectionnee.reference_commande || commandeSelectionnee.id} - Statut: ${nouveauStatut}${coursierSelectionne ? ` - Coursier: ${updateData.coursier_nom}` : ""}`,
        entite_id: commandeSelectionnee.id,
      });

      queryClient.invalidateQueries({ queryKey: ["commandes_vendeur"] });
      setDialogOuvert(false);
      setEnCours(false);
    } catch (error) {
      alert("Erreur: " + error.message);
      setEnCours(false);
    }
  };

  if (loadingCommandes) {
    return <div className="space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtre */}
      <div className="flex gap-2 flex-wrap">
        <Select value={filtreStatut} onValueChange={setFiltreStatut}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUTS).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="self-center text-xs">
          {commandesFiltrees.length} commande(s)
        </Badge>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {commandesFiltrees.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <Truck className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p>Aucune commande dans ce statut</p>
          </div>
        ) : (
          commandesFiltrees.map((cmd) => (
            <div key={cmd.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{cmd.produit_nom}</h3>
                    <Badge className={STATUTS[cmd.statut]?.color}>{STATUTS[cmd.statut]?.label || cmd.statut}</Badge>
                    {cmd.reference_commande && (
                      <span className="text-xs text-slate-400">{cmd.reference_commande}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <p><strong>Vendeur:</strong> {cmd.vendeur_email}</p>
                    <p><strong>Client:</strong> {cmd.client_nom} — {cmd.client_telephone}</p>
                    <p>
                      <strong>Livraison:</strong>{" "}
                      {cmd.client_ville || "—"}{cmd.client_quartier ? `, ${cmd.client_quartier}` : ""}
                    </p>
                    <p><strong>Montant:</strong> {(cmd.montant_total || 0).toLocaleString("fr-FR")} FCFA</p>
                    {cmd.coursier_nom && <p><strong>Coursier:</strong> 🚚 {cmd.coursier_nom}</p>}
                  </div>
                </div>

                <Button onClick={() => ouvrir(cmd)} className="bg-[#1a1f5e] hover:bg-[#141952] w-full sm:w-auto">
                  {cmd.coursier_id ? "Modifier" : "Gérer"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOuvert} onOpenChange={setDialogOuvert}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gérer la commande</DialogTitle>
          </DialogHeader>

          {commandeSelectionnee && (
            <div className="space-y-5">
              {/* Order summary */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-sm font-medium text-slate-800">
                  {commandeSelectionnee.produit_nom} — {commandeSelectionnee.quantite || 1} unité(s)
                </p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {commandeSelectionnee.client_ville || "Ville non spécifiée"}
                  {commandeSelectionnee.client_quartier ? `, ${commandeSelectionnee.client_quartier}` : ""}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Client: {commandeSelectionnee.client_nom} — {commandeSelectionnee.client_telephone}
                </p>
              </div>

              {/* Warning */}
              {coursierError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{coursierError}</span>
                </div>
              )}

              {/* Coursier selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">
                  Assigner un coursier {commandeSelectionnee.client_ville ? `(${commandeSelectionnee.client_ville})` : ""}
                </label>

                {loadingCoursiers ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-4 justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Recherche des coursiers...
                  </div>
                ) : coursiersDisponibles.length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    Aucun coursier disponible. Créez-en un dans Gestion Coursiers.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
                    {coursiersDisponibles.map(c => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          coursierSelectionne === c.id
                            ? "border-amber-400 bg-amber-50"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name="coursier"
                          value={c.id}
                          checked={coursierSelectionne === c.id}
                          onChange={() => setCoursierSelectionne(c.id)}
                          className="accent-amber-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">🚚 {c.nom}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {c.telephone || "—"}
                            {c.frais_livraison_defaut > 0 && (
                              <span> • {Number(c.frais_livraison_defaut).toLocaleString("fr-FR")} FCFA</span>
                            )}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Statut</label>
                <Select value={nouveauStatut} onValueChange={setNouveauStatut}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUTS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>{val.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOuvert(false)}>Annuler</Button>
            <Button onClick={sauvegarder} disabled={enCours} className="bg-[#1a1f5e] hover:bg-[#141952]">
              {enCours ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
