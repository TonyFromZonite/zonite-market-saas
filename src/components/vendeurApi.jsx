/**
 * Vendeur API - Wraps Supabase calls for vendor operations.
 * Compatibility layer for existing pages.
 */
import { supabase } from "@/integrations/supabase/client";

export const vendeurApi = {
  async marquerNotificationLue(id) {
    const { error } = await supabase.from("notifications_vendeur").update({ lu: true }).eq("id", id);
    if (error) console.error("marquerNotificationLue error:", error);
  },

  async toutMarquerLu(ids) {
    for (const id of ids) {
      await supabase.from("notifications_vendeur").update({ lu: true }).eq("id", id);
    }
  },

  async createDemandePaiement(data) {
    const { error } = await supabase.from("demandes_paiement_vendeur").insert({
      vendeur_id: data.vendeur_id,
      vendeur_email: data.vendeur_email,
      montant: data.montant,
      numero_mobile_money: data.numero_mobile_money,
      operateur_mobile_money: data.operateur || data.operateur_mobile_money,
      statut: data.statut || "en_attente",
      notes: data.notes || null,
    });
    if (error) throw error;
  },

  async createTicketSupport(data) {
    const { error } = await supabase.from("tickets_support").insert({
      vendeur_id: data.vendeur_id,
      vendeur_email: data.vendeur_email,
      sujet: data.sujet,
      message: data.message,
      categorie: data.categorie || null,
      priorite: data.priorite || "normale",
    });
    if (error) throw error;
  },

  async updateSellerProfile(id, data) {
    const { error } = await supabase.from("sellers").update(data).eq("id", id);
    if (error) throw error;
  },

  async marquerTicketLu(id) {
    const { error } = await supabase.from("tickets_support").update({ lu_par_vendeur: true }).eq("id", id);
    if (error) console.error("marquerTicketLu error:", error);
  },
};
