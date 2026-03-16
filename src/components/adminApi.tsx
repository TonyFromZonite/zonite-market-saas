import { supabase } from "@/integrations/supabase/client";
import { getAdminSession, getSousAdminSession } from "@/components/useSessionGuard";

const invoke = async (action: string, payload: Record<string, any> = {}) => {
  const session = getAdminSession() || getSousAdminSession();
  if (!session) throw new Error('Session admin introuvable.');

  switch (action) {
    // Produit
    case 'createProduit': {
      const { data, error } = await supabase.from('produits').insert(payload.data).select().single();
      if (error) throw error; return data;
    }
    case 'updateProduit': {
      const { error } = await supabase.from('produits').update(payload.data).eq('id', payload.produitId);
      if (error) throw error; return { success: true };
    }
    case 'deleteProduit': {
      const { error } = await supabase.from('produits').delete().eq('id', payload.produitId);
      if (error) throw error; return { success: true };
    }
    // Commande Vendeur
    case 'updateCommandeVendeur': {
      const { error } = await supabase.from('commandes_vendeur').update(payload.data).eq('id', payload.commandeId);
      if (error) throw error; return { success: true };
    }
    // Vendeur
    case 'listVendeurs': {
      const { data } = await supabase.from('sellers').select('*').order('created_at', { ascending: false });
      return data || [];
    }
    case 'updateVendeur': {
      const { error } = await supabase.from('sellers').update(payload.data).eq('id', payload.vendeurId);
      if (error) throw error; return { success: true };
    }
    case 'validateKycAndActivate': {
      const { error } = await supabase.from('sellers')
        .update({ seller_status: 'active_seller', statut_kyc: 'approuve' })
        .eq('id', payload.vendeurId);
      if (error) throw error;
      // Send notification
      await supabase.from('notifications_vendeur').insert({
        vendeur_id: payload.vendeurId,
        titre: 'Compte activé',
        message: 'Votre compte a été validé. Vous avez maintenant accès à toutes les fonctionnalités.',
        type: 'success',
      });
      return { success: true };
    }
    case 'deleteVendeur': {
      const { error } = await supabase.from('sellers').delete().eq('id', payload.vendeurId);
      if (error) throw error; return { success: true };
    }
    // Sous-Admin
    case 'createSousAdmin': {
      const { data, error } = await supabase.from('sous_admins').insert(payload.data).select().single();
      if (error) throw error;
      await supabase.from('sellers').update({ role: 'sous_admin' }).eq('id', payload.data.seller_id);
      return data;
    }
    case 'deleteSousAdmin': {
      const sa = await supabase.from('sous_admins').select('seller_id').eq('id', payload.sousAdminId).single();
      if (sa.data) await supabase.from('sellers').update({ role: 'user' }).eq('id', sa.data.seller_id);
      const { error } = await supabase.from('sous_admins').delete().eq('id', payload.sousAdminId);
      if (error) throw error; return { success: true };
    }
    // Tickets
    case 'updateTicketSupport': {
      const { error } = await supabase.from('tickets_support').update(payload.data).eq('id', payload.ticketId);
      if (error) throw error; return { success: true };
    }
    // Notifications
    case 'createNotificationVendeur': {
      const { data, error } = await supabase.from('notifications_vendeur').insert(payload.data).select().single();
      if (error) throw error; return data;
    }
    // Paiements
    case 'updateDemandePaiement': {
      const { error } = await supabase.from('demandes_paiement_vendeur').update(payload.data).eq('id', payload.demandeId);
      if (error) throw error; return { success: true };
    }
    // Categories
    case 'createCategorie': {
      const { data, error } = await supabase.from('categories').insert(payload.data).select().single();
      if (error) throw error; return data;
    }
    case 'updateCategorie': {
      const { error } = await supabase.from('categories').update(payload.data).eq('id', payload.categorieId);
      if (error) throw error; return { success: true };
    }
    case 'deleteCategorie': {
      const { error } = await supabase.from('categories').delete().eq('id', payload.categorieId);
      if (error) throw error; return { success: true };
    }
    // Journal Audit
    case 'createJournalAudit': {
      const { error } = await supabase.from('journal_audit').insert(payload.data);
      if (error) throw error; return { success: true };
    }
    // Config App
    case 'updateConfigApp': {
      const { error } = await supabase.from('config_app').update(payload.data).eq('id', payload.configId);
      if (error) throw error; return { success: true };
    }
    // Ventes
    case 'updateVente': {
      const { error } = await supabase.from('ventes').update(payload.data).eq('id', payload.venteId);
      if (error) throw error; return { success: true };
    }
    // Livraison
    case 'createLivraison': {
      const { data, error } = await supabase.from('livraisons').insert(payload.data).select().single();
      if (error) throw error; return data;
    }
    case 'updateLivraison': {
      const { error } = await supabase.from('livraisons').update(payload.data).eq('id', payload.livraisonId);
      if (error) throw error; return { success: true };
    }
    // Mouvement stock
    case 'createMouvementStock': {
      const { data, error } = await supabase.from('mouvements_stock').insert(payload.data).select().single();
      if (error) throw error; return data;
    }
    default:
      throw new Error(`Action admin inconnue: ${action}`);
  }
};

export const adminApi = {
  createProduit: (data: any) => invoke('createProduit', { data }),
  updateProduit: (produitId: string, data: any) => invoke('updateProduit', { produitId, data }),
  deleteProduit: (produitId: string) => invoke('deleteProduit', { produitId }),
  updateCommandeVendeur: (commandeId: string, data: any) => invoke('updateCommandeVendeur', { commandeId, data }),
  listVendeurs: () => invoke('listVendeurs'),
  updateVendeur: (vendeurId: string, data: any) => invoke('updateVendeur', { vendeurId, data }),
  validateKycAndActivate: (payload: any) => invoke('validateKycAndActivate', payload),
  deleteVendeur: (vendeurId: string) => invoke('deleteVendeur', { vendeurId }),
  createSousAdmin: (data: any) => invoke('createSousAdmin', { data }),
  deleteSousAdmin: (sousAdminId: string) => invoke('deleteSousAdmin', { sousAdminId }),
  updateTicketSupport: (ticketId: string, data: any) => invoke('updateTicketSupport', { ticketId, data }),
  createNotificationVendeur: (data: any) => invoke('createNotificationVendeur', { data }),
  updateDemandePaiement: (demandeId: string, data: any) => invoke('updateDemandePaiement', { demandeId, data }),
  createCategorie: (data: any) => invoke('createCategorie', { data }),
  updateCategorie: (categorieId: string, data: any) => invoke('updateCategorie', { categorieId, data }),
  deleteCategorie: (categorieId: string) => invoke('deleteCategorie', { categorieId }),
  createJournalAudit: (data: any) => invoke('createJournalAudit', { data }),
  updateConfigApp: (configId: string, data: any) => invoke('updateConfigApp', { configId, data }),
  updateVente: (venteId: string, data: any) => invoke('updateVente', { venteId, data }),
  createLivraison: (data: any) => invoke('createLivraison', { data }),
  updateLivraison: (livraisonId: string, data: any) => invoke('updateLivraison', { livraisonId, data }),
  createMouvementStock: (data: any) => invoke('createMouvementStock', { data }),
};
