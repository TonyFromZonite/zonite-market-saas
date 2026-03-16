import { supabase } from "@/integrations/supabase/client";
import { getVendeurSession } from "@/components/useSessionGuard";

const invoke = async (action: string, payload: Record<string, any> = {}) => {
  const session = getVendeurSession();
  const vendeur_email = session?.email || null;

  if (!vendeur_email) {
    throw new Error('Session vendeur introuvable. Veuillez vous reconnecter.');
  }

  // Direct Supabase operations instead of Base44 function invocation
  switch (action) {
    case 'createDemandePaiement': {
      const { data, error } = await supabase
        .from('demandes_paiement_vendeur')
        .insert({ ...payload.data, vendeur_id: session?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    case 'marquerNotificationLue': {
      const { error } = await supabase
        .from('notifications_vendeur')
        .update({ lu: true })
        .eq('id', payload.notifId);
      if (error) throw error;
      return { success: true };
    }
    case 'toutMarquerLu': {
      const { error } = await supabase
        .from('notifications_vendeur')
        .update({ lu: true })
        .in('id', payload.notifIds);
      if (error) throw error;
      return { success: true };
    }
    case 'createTicketSupport': {
      const { data, error } = await supabase
        .from('tickets_support')
        .insert({ ...payload.data, vendeur_id: session?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
    case 'marquerTicketLu': {
      const { error } = await supabase
        .from('tickets_support')
        .update({ lu: true })
        .eq('id', payload.ticketId);
      if (error) throw error;
      return { success: true };
    }
    case 'debloquerCatalogue': {
      const { error } = await supabase
        .from('sellers')
        .update({ catalogue_debloque: true, training_completed: true })
        .eq('id', payload.compteId);
      if (error) throw error;
      return { success: true };
    }
    case 'getSellerByEmail': {
      const { data } = await supabase
        .from('sellers')
        .select('*')
        .eq('email', vendeur_email)
        .single();
      return { seller: data };
    }
    case 'updateProfil': {
      const { error } = await supabase
        .from('sellers')
        .update(payload)
        .eq('email', vendeur_email);
      if (error) throw error;
      return { success: true };
    }
    default:
      throw new Error(`Action vendeur inconnue: ${action}`);
  }
};

export const vendeurApi = {
  createDemandePaiement: (data: any) => invoke('createDemandePaiement', { data }),
  marquerNotificationLue: (notifId: string) => invoke('marquerNotificationLue', { notifId }),
  toutMarquerLu: (notifIds: string[]) => invoke('toutMarquerLu', { notifIds }),
  createTicketSupport: (data: any) => invoke('createTicketSupport', { data }),
  marquerTicketLu: (ticketId: string) => invoke('marquerTicketLu', { ticketId }),
  debloquerCatalogue: (compteId: string) => invoke('debloquerCatalogue', { compteId }),
  getSellerByEmail: (email: string) => invoke('getSellerByEmail', {}),
  updateProfil: (payload: any) => invoke('updateProfil', payload),
};
