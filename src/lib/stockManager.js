import { supabase } from "@/integrations/supabase/client";

export const stockManager = {
  /**
   * Get current stock for a specific variation in a specific coursier
   */
  async getVariationStock(produitId, coursierId, variationKey) {
    const { data: produit } = await supabase
      .from("produits")
      .select("stocks_par_coursier, stock_global")
      .eq("id", produitId)
      .single();

    if (!produit) return 0;

    const coursierStock = (produit.stocks_par_coursier || []).find(
      (s) => s.coursier_id === coursierId
    );
    if (!coursierStock) return 0;

    if (!variationKey) return coursierStock.stock_total || 0;

    const varStock = (coursierStock.stock_par_variation || []).find(
      (v) => v.variation_key === variationKey
    );
    return varStock?.quantite || 0;
  },

  /**
   * RESERVE stock when order is created
   * Deducts from exact variation + exact coursier
   */
  async reserveStock(produitId, coursierId, variationKey, quantite, commandeId) {
    // Get fresh product data
    const { data: produit } = await supabase
      .from("produits")
      .select("stocks_par_coursier, stock_global, nom")
      .eq("id", produitId)
      .single();

    if (!produit) throw new Error("Produit introuvable");

    const coursierStock = (produit.stocks_par_coursier || []).find(
      (s) => s.coursier_id === coursierId
    );
    if (!coursierStock) throw new Error("Aucun stock disponible dans cette zone");

    // Check variation stock
    let stockAvant = coursierStock.stock_total || 0;
    if (variationKey) {
      const varStock = (coursierStock.stock_par_variation || []).find(
        (v) => v.variation_key === variationKey
      );
      if (!varStock || varStock.quantite < quantite) {
        throw new Error(
          `Stock insuffisant. Disponible: ${varStock?.quantite || 0}, Demandé: ${quantite}`
        );
      }
      stockAvant = varStock.quantite;
    } else if (stockAvant < quantite) {
      throw new Error(
        `Stock insuffisant. Disponible: ${stockAvant}, Demandé: ${quantite}`
      );
    }

    // Update stock - reduce quantity
    const updatedStocks = (produit.stocks_par_coursier || []).map((s) => {
      if (s.coursier_id !== coursierId) return s;
      const newVarStock = (s.stock_par_variation || []).map((v) => {
        if (!variationKey || v.variation_key !== variationKey) return v;
        return { ...v, quantite: Math.max(0, v.quantite - quantite) };
      });
      const newTotal = variationKey
        ? newVarStock.reduce((t, v) => t + (v.quantite || 0), 0)
        : Math.max(0, (s.stock_total || 0) - quantite);
      return { ...s, stock_par_variation: newVarStock, stock_total: newTotal };
    });

    const newGlobal = updatedStocks.reduce((t, s) => t + (s.stock_total || 0), 0);

    // Save to DB
    const { error } = await supabase
      .from("produits")
      .update({ stocks_par_coursier: updatedStocks, stock_global: newGlobal })
      .eq("id", produitId);

    if (error) throw error;

    // Log movement
    await supabase.from("mouvements_stock").insert({
      produit_id: produitId,
      commande_id: commandeId,
      coursier_id: coursierId,
      variation_key: variationKey || null,
      type: "reservation",
      quantite,
      stock_avant: stockAvant,
      stock_apres: Math.max(0, stockAvant - quantite),
      notes: `Réservé - Commande ${commandeId} - ${variationKey || "sans variation"}`,
    });

    return { success: true, newGlobal, updatedStocks };
  },

  /**
   * RESTORE stock when order fails/cancelled/returned
   * Adds back to exact variation + exact coursier
   */
  async restoreStock(produitId, coursierId, variationKey, quantite, commandeId, reason = "echec") {
    const { data: produit } = await supabase
      .from("produits")
      .select("stocks_par_coursier, stock_global")
      .eq("id", produitId)
      .single();

    if (!produit) throw new Error("Produit introuvable");

    const coursierExists = (produit.stocks_par_coursier || []).find(
      (s) => s.coursier_id === coursierId
    );

    let updatedStocks;

    if (!coursierExists) {
      // Coursier not found → add it back
      updatedStocks = [
        ...(produit.stocks_par_coursier || []),
        {
          coursier_id: coursierId,
          stock_total: quantite,
          stock_par_variation: variationKey
            ? [{ variation_key: variationKey, quantite }]
            : [],
        },
      ];
    } else {
      updatedStocks = (produit.stocks_par_coursier || []).map((s) => {
        if (s.coursier_id !== coursierId) return s;

        if (!variationKey) {
          return { ...s, stock_total: (s.stock_total || 0) + quantite };
        }

        const varExists = (s.stock_par_variation || []).find(
          (v) => v.variation_key === variationKey
        );

        const newVarStock = varExists
          ? (s.stock_par_variation || []).map((v) =>
              v.variation_key === variationKey
                ? { ...v, quantite: v.quantite + quantite }
                : v
            )
          : [...(s.stock_par_variation || []), { variation_key: variationKey, quantite }];

        const newTotal = newVarStock.reduce((t, v) => t + (v.quantite || 0), 0);
        return { ...s, stock_par_variation: newVarStock, stock_total: newTotal };
      });
    }

    const newGlobal = updatedStocks.reduce((t, s) => t + (s.stock_total || 0), 0);

    const { error } = await supabase
      .from("produits")
      .update({ stocks_par_coursier: updatedStocks, stock_global: newGlobal })
      .eq("id", produitId);

    if (error) throw error;

    // Log movement
    await supabase.from("mouvements_stock").insert({
      produit_id: produitId,
      commande_id: commandeId,
      coursier_id: coursierId,
      variation_key: variationKey || null,
      type: reason === "retour" ? "retour" : "restauration",
      quantite,
      notes: `Stock restauré - ${reason} - ${variationKey || "sans variation"}`,
    });

    return { success: true, newGlobal };
  },

  /**
   * CONFIRM stock removal on delivery success
   * Stock already reduced on order creation — just log definitively
   */
  async confirmDelivery(produitId, coursierId, variationKey, quantite, commandeId) {
    await supabase.from("mouvements_stock").insert({
      produit_id: produitId,
      commande_id: commandeId,
      coursier_id: coursierId,
      variation_key: variationKey || null,
      type: "sortie_definitive",
      quantite,
      notes: `Livraison confirmée - ${variationKey || "sans variation"}`,
    });

    return { success: true };
  },
};
