import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import FormulaireVente from "@/components/vente/FormulaireVente";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function NouvelleVente() {
  const [enCours, setEnCours] = useState(false);
  const [succes, setSucces] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: produits = [] } = useQuery({
    queryKey: ["produits"],
    queryFn: async () => {
      const { data } = await supabase.from("produits").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: vendeurs = [] } = useQuery({
    queryKey: ["vendeurs"],
    queryFn: async () => {
      const { data } = await supabase.from("sellers").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const enregistrerVente = async (donnees) => {
    setEnCours(true);
    try {
      const produit = donnees.produitSelectionne;
      const vendeur = donnees.vendeurSelectionne;
      const ref = `CMD-${Date.now().toString(36).toUpperCase()}`;

      // 1. Create order in commandes_vendeur
      const { data: newOrder, error: orderError } = await supabase.from("commandes_vendeur").insert({
        vendeur_id: vendeur.id,
        vendeur_email: vendeur.email,
        produit_id: produit.id,
        produit_nom: produit.nom,
        produit_reference: produit.reference || null,
        variation: donnees.variation || null,
        quantite: donnees.quantite,
        prix_unitaire: produit.prix_gros,
        prix_final_client: donnees.prix_unitaire,
        montant_total: donnees.montantTotal,
        frais_livraison: donnees.coutLivraison || 0,
        livraison_incluse: false,
        client_nom: donnees.client_nom || "Client admin",
        client_telephone: donnees.client_telephone || "",
        client_ville: donnees.ville || "",
        client_adresse: donnees.client_adresse || "",
        notes: donnees.notes || "",
        reference_commande: ref,
        coursier_id: donnees.coursierId || null,
        coursier_nom: donnees.coursierNom || null,
        statut: "en_attente_validation_admin",
      }).select().single();

      if (orderError) throw orderError;

      // 2. Deduct stock from the selected coursier
      if (donnees.coursierId) {
        const updatedSPC = (produit.stocks_par_coursier || []).map((sc) => {
          if (sc.coursier_id !== donnees.coursierId) return sc;
          if (donnees.variation) {
            const newVarStock = (sc.stock_par_variation || []).map((sv) => {
              if (sv.variation_key !== donnees.variation) return sv;
              return { ...sv, quantite: Math.max(0, (sv.quantite || 0) - donnees.quantite) };
            });
            const newTotal = newVarStock.reduce((t, v) => t + (v.quantite || 0), 0);
            return { ...sc, stock_par_variation: newVarStock, stock_total: newTotal };
          } else {
            return { ...sc, stock_total: Math.max(0, (sc.stock_total || 0) - donnees.quantite) };
          }
        });
        const newStockGlobal = updatedSPC.reduce((t, s) => t + (s.stock_total || 0), 0);

        await supabase.from("produits").update({
          stocks_par_coursier: updatedSPC,
          stock_global: newStockGlobal,
        }).eq("id", produit.id);

        // 3. Record stock movement
        await supabase.from("mouvements_stock").insert({
          produit_id: produit.id,
          type: "sortie",
          quantite: donnees.quantite,
          stock_avant: produit.stock_global || 0,
          stock_apres: newStockGlobal,
          notes: `Commande ${ref} - ${donnees.variation || "sans variation"} via ${donnees.coursierNom || "admin"}`,
          reference_id: newOrder?.id || null,
        });
      }

      // 4. Admin notification
      await supabase.from("notifications_admin").insert({
        titre: "🛒 Nouvelle vente admin",
        message: `Vente de ${donnees.quantite}x ${produit.nom} par ${vendeur.full_name}`,
        type: "vente",
        vendeur_email: vendeur.email,
        reference_id: newOrder?.id || null,
      });

      // 5. Audit
      await supabase.from("journal_audit").insert({
        action: "Nouvelle vente enregistrée",
        module: "vente",
        details: { text: `${donnees.quantite}x ${produit.nom} (${donnees.variation || "N/A"}) - ${donnees.ville} - ${vendeur.full_name} - Total: ${donnees.montantTotal} FCFA` },
        entite_id: newOrder?.id || null,
        entite_type: "commande",
      });

      queryClient.invalidateQueries({ queryKey: ["produits"] });
      queryClient.invalidateQueries({ queryKey: ["vendeurs"] });
      queryClient.invalidateQueries({ queryKey: ["commandes_vendeur"] });
      setSucces(true);
    } catch (err) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setEnCours(false);
    }
  };

  if (succes) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Vente Enregistrée !</h2>
        <p className="text-slate-500 mb-6">La commande a été créée et le stock mis à jour.</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => setSucces(false)} className="bg-[#1a1f5e] hover:bg-[#141952]">Nouvelle Vente</Button>
          <Link to={createPageUrl("TableauDeBord")}><Button variant="outline">Tableau de Bord</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Enregistrer une Vente</h2>
        <p className="text-sm text-slate-500 mb-6">Le stock et les notifications seront mis à jour automatiquement.</p>
        <FormulaireVente produits={produits} vendeurs={vendeurs} onSubmit={enregistrerVente} enCours={enCours} />
      </div>
    </div>
  );
}
