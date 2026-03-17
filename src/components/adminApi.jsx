/**
 * Admin API - Wraps Supabase calls for admin operations.
 * Compatibility layer for existing pages.
 */
import { supabase } from "@/integrations/supabase/client";

export const adminApi = {
  // Sellers
  async updateVendeur(id, data) {
    const { error } = await supabase.from("sellers").update(data).eq("id", id);
    if (error) throw error;
  },

  // Products
  async createProduit(data) {
    const { error } = await supabase.from("produits").insert(data);
    if (error) throw error;
  },
  async updateProduit(id, data) {
    const { error } = await supabase.from("produits").update(data).eq("id", id);
    if (error) throw error;
  },
  async deleteProduit(id) {
    const { error } = await supabase.from("produits").delete().eq("id", id);
    if (error) throw error;
  },

  // Categories
  async createCategorie(data) {
    const { error } = await supabase.from("categories").insert(data);
    if (error) throw error;
  },
  async updateCategorie(id, data) {
    const { error } = await supabase.from("categories").update(data).eq("id", id);
    if (error) throw error;
  },
  async deleteCategorie(id) {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw error;
  },

  // Orders
  async updateCommandeVendeur(id, data) {
    const { error } = await supabase.from("commandes_vendeur").update(data).eq("id", id);
    if (error) throw error;
  },

  // Ventes
  async updateVente(id, data) {
    const { error } = await supabase.from("ventes").update(data).eq("id", id);
    if (error) throw error;
  },

  // Livraisons
  async createLivraison(data) {
    const { error } = await supabase.from("livraisons").insert(data);
    if (error) throw error;
  },
  async updateLivraison(id, data) {
    const { error } = await supabase.from("livraisons").update(data).eq("id", id);
    if (error) throw error;
  },
  async deleteLivraison(id) {
    const { error } = await supabase.from("livraisons").delete().eq("id", id);
    if (error) throw error;
  },

  // Notifications vendeur
  async createNotificationVendeur(data) {
    const { error } = await supabase.from("notifications_vendeur").insert({
      vendeur_id: data.vendeur_id || data.vendeur_email, // fallback
      vendeur_email: data.vendeur_email,
      titre: data.titre,
      message: data.message,
      type: data.type || "info",
      action_url: data.lien || data.action_url || null,
      lu: data.lue ?? false,
    });
    if (error) console.error("createNotificationVendeur error:", error);
  },

  // Journal audit
  async createJournalAudit(data) {
    const { error } = await supabase.from("journal_audit").insert({
      action: data.action,
      module: data.module || "systeme",
      details: data.details ? { text: data.details } : null,
      entite_id: data.entite_id || null,
      entite_type: data.entite_type || null,
      utilisateur: data.utilisateur || null,
    });
    if (error) console.error("createJournalAudit error:", error);
  },

  // Mouvement stock
  async createMouvementStock(data) {
    const { error } = await supabase.from("mouvements_stock").insert({
      produit_id: data.produit_id,
      type: data.type_mouvement || data.type || "sortie",
      quantite: data.quantite,
      stock_avant: data.stock_avant,
      stock_apres: data.stock_apres,
      notes: data.raison || data.notes || null,
      reference_id: data.reference_vente || data.reference_id || null,
    });
    if (error) console.error("createMouvementStock error:", error);
  },

  // Retours
  async createRetourProduit(data) {
    const { error } = await supabase.from("retours_produit").insert({
      commande_id: data.commande_id,
      vendeur_id: data.vendeur_id,
      produit_id: data.produit_id,
      quantite: data.quantite_retournee || data.quantite || 1,
      raison: data.raison,
      statut: data.statut || "en_attente",
    });
    if (error) throw error;
  },

  // Config
  async getConfig(cle) {
    const { data } = await supabase.from("config_app").select("*").eq("cle", cle).maybeSingle();
    return data;
  },
  async updateConfig(id, updates) {
    const { error } = await supabase.from("config_app").update(updates).eq("id", id);
    if (error) throw error;
  },

  // Tickets support
  async updateTicketSupport(id, data) {
    const updateData = {};
    if (data.reponse_admin !== undefined) updateData.reponse_admin = data.reponse_admin;
    if (data.statut !== undefined) updateData.statut = data.statut;
    if (data.lu_par_vendeur !== undefined) updateData.lu_par_vendeur = data.lu_par_vendeur;
    if (data.admin_email || data.repondu_par) updateData.repondu_par = data.admin_email || data.repondu_par;
    if (data.date_reponse || data.repondu_at) updateData.repondu_at = data.date_reponse || data.repondu_at;
    const { error } = await supabase.from("tickets_support").update(updateData).eq("id", id);
    if (error) throw error;
  },

  // Notifications vendeur update
  async updateNotificationVendeur(id, data) {
    const updateData = {};
    if (data.lu !== undefined || data.lue !== undefined) updateData.lu = data.lu ?? data.lue;
    const { error } = await supabase.from("notifications_vendeur").update(updateData).eq("id", id);
    if (error) throw error;
  },

  // FAQ
  async createFaqItem(data) {
    const { error } = await supabase.from("faq_items").insert(data);
    if (error) throw error;
  },
  async updateFaqItem(id, data) {
    const { error } = await supabase.from("faq_items").update(data).eq("id", id);
    if (error) throw error;
  },
  async deleteFaqItem(id) {
    const { error } = await supabase.from("faq_items").delete().eq("id", id);
    if (error) throw error;
  },
};
