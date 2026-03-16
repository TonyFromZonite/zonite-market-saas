/**
 * Base44 → Supabase Compatibility Layer
 * Drop-in replacement so ALL existing JSX files work without modification.
 * Maps base44.entities.X, base44.auth, base44.functions, base44.integrations to Supabase.
 */
import { supabase } from '@/integrations/supabase/client';

// Re-export supabase for direct usage
export { supabase };

// ── Entity → Supabase table mapping ──
const TABLE_MAP = {
  Seller: 'sellers',
  Produit: 'produits',
  Categorie: 'categories',
  Vente: 'ventes',
  CommandeVendeur: 'commandes_vendeur',
  Zone: 'zones',
  Coursier: 'coursiers',
  Livraison: 'livraisons',
  Notification: 'notifications_vendeur',
  NotificationVendeur: 'notifications_vendeur',
  DemandePaiementVendeur: 'demandes_paiement_vendeur',
  PaiementCommission: 'paiements_commission',
  CandidatureVendeur: 'candidatures_vendeur',
  RetourProduit: 'retours_produit',
  TicketSupport: 'tickets_support',
  SousAdmin: 'sous_admins',
  ConfigApp: 'config_app',
  JournalAudit: 'journal_audit',
  MouvementStock: 'mouvements_stock',
  AdminPermission: 'admin_permissions',
  FaqItem: 'faq_items',
};

// ── Sort string parser ──
function parseSort(sortStr) {
  if (!sortStr) return null;
  const desc = sortStr.startsWith('-');
  let col = desc ? sortStr.slice(1) : sortStr;
  const fieldMap = { created_date: 'created_at', updated_date: 'updated_at' };
  col = fieldMap[col] || col;
  return { column: col, ascending: !desc };
}

// ── Build a query proxy for one entity ──
function createEntityProxy(tableName) {
  return {
    async list(sortStr, limit) {
      let q = supabase.from(tableName).select('*');
      const sort = parseSort(sortStr);
      if (sort) q = q.order(sort.column, { ascending: sort.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async filter(filters, sortStr, limit) {
      let q = supabase.from(tableName).select('*');
      if (filters && typeof filters === 'object') {
        Object.entries(filters).forEach(([key, value]) => {
          if (value === null) q = q.is(key, null);
          else q = q.eq(key, value);
        });
      }
      const sort = parseSort(sortStr);
      if (sort) q = q.order(sort.column, { ascending: sort.ascending });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    async get(id) {
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    async create(record) {
      const { data, error } = await supabase.from(tableName).insert(record).select().single();
      if (error) throw error;
      return data;
    },
    async update(id, updates) {
      const { data, error } = await supabase.from(tableName).update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };
}

const entitiesHandler = {
  get(_, entityName) {
    const table = TABLE_MAP[entityName];
    if (!table) {
      console.warn(`[base44 compat] Unknown entity "${entityName}", using as-is`);
      return createEntityProxy(entityName.toLowerCase());
    }
    return createEntityProxy(table);
  },
};

const entities = new Proxy({}, entitiesHandler);
const asServiceRole = { entities: new Proxy({}, entitiesHandler) };

// ── Auth ──
const auth = {
  async me() {
    // Check sessionStorage first (legacy sessions)
    const vendeurSession = sessionStorage.getItem('vendeur_session');
    if (vendeurSession) {
      try { return JSON.parse(vendeurSession); } catch {}
    }
    const adminSession = sessionStorage.getItem('admin_session');
    if (adminSession) {
      try { return JSON.parse(adminSession); } catch {}
    }
    const sousAdminSession = sessionStorage.getItem('sous_admin');
    if (sousAdminSession) {
      try { return JSON.parse(sousAdminSession); } catch {}
    }

    // Fallback to Supabase Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw { status: 401, message: 'Not authenticated' };
    return { email: user.email, id: user.id, role: user.user_metadata?.role || 'user' };
  },

  logout(redirectUrl) {
    sessionStorage.removeItem('admin_session');
    sessionStorage.removeItem('sous_admin');
    sessionStorage.removeItem('vendeur_session');
    supabase.auth.signOut();
    if (redirectUrl) {
      window.location.href = '/Connexion';
    }
  },

  redirectToLogin(returnUrl) {
    window.location.href = '/Connexion';
  },
};

// ── Functions ──
const functions = {
  async invoke(functionName, payload) {
    switch (functionName) {

      case 'checkEmailExists': {
        const { email } = payload;
        const { data: sellers } = await supabase.from('sellers').select('id').eq('email', email);
        return { data: { exists: sellers && sellers.length > 0 } };
      }

      case 'getAllVendeurs': {
        const { data, error } = await supabase.from('sellers').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return { data: data || [] };
      }

      case 'validateKYC': {
        const { seller_id, statut, notes } = payload;
        const updates = { statut_kyc: statut };
        if (statut === 'approuve') updates.seller_status = 'pending_training';
        else if (statut === 'rejete') updates.seller_status = 'kyc_rejected';
        const { data, error } = await supabase.from('sellers').update(updates).eq('id', seller_id).select().single();
        if (error) throw error;
        await supabase.from('candidatures_vendeur').insert({ seller_id, statut, notes_admin: notes });
        return { data: { success: true, seller: data } };
      }

      case 'updateKYCDocuments': {
        const { email, photo_identite_url, photo_identite_verso_url, selfie_url } = payload;
        const { data: sellers } = await supabase.from('sellers').select('id').eq('email', email);
        if (!sellers || sellers.length === 0) return { data: { success: false, error: 'Vendeur non trouvé' } };
        const { data, error } = await supabase.from('sellers').update({
          photo_identite_url, photo_identite_verso_url, selfie_url,
          statut_kyc: 'en_attente', seller_status: 'pending_kyc',
        }).eq('id', sellers[0].id).select().single();
        if (error) throw error;
        return { data: { success: true, seller: data } };
      }

      case 'vendeurActions': {
        const { action, vendeur_email, payload: actionPayload } = payload;
        switch (action) {
          case 'getSellerByEmail': {
            const { data: sellers, error } = await supabase.from('sellers').select('*').eq('email', vendeur_email);
            if (error) throw error;
            return { data: sellers && sellers.length > 0 ? sellers[0] : null };
          }
          case 'updateSeller': {
            const { seller_id, ...updates } = actionPayload || {};
            const { data, error } = await supabase.from('sellers').update(updates).eq('id', seller_id).select().single();
            if (error) throw error;
            return { data };
          }
          default:
            console.warn(`[base44 compat] vendeurActions/${action} not handled`);
            return { data: null };
        }
      }

      case 'completeTraining': {
        const { email } = payload;
        const { data: sellers } = await supabase.from('sellers').select('id').eq('email', email);
        if (sellers && sellers.length > 0) {
          await supabase.from('sellers').update({
            training_completed: true, seller_status: 'active', catalogue_debloque: true,
          }).eq('id', sellers[0].id);
        }
        return { data: { success: true } };
      }

      case 'changeUserRole': {
        const { user_email, new_role } = payload;
        const { data: sellers } = await supabase.from('sellers').select('id').eq('email', user_email);
        if (sellers && sellers.length > 0) {
          await supabase.from('sellers').update({ role: new_role }).eq('id', sellers[0].id);
        }
        return { data: { success: true } };
      }

      case 'deleteSellerComplete': {
        const { seller_id } = payload;
        const { error } = await supabase.from('sellers').delete().eq('id', seller_id);
        if (error) throw error;
        return { data: { success: true } };
      }

      case 'getProductAvailability': {
        const { produit_id } = payload;
        const { data, error } = await supabase.from('produits').select('*').eq('id', produit_id).single();
        if (error) throw error;
        return { data: { produit: data, available: data?.stock > 0 } };
      }

      case 'fullSystemAudit':
      case 'auditGhostAccounts':
        return { data: { report: { status: 'ok', issues: [], message: 'Audit non disponible' } } };

      default: {
        console.warn(`[base44 compat] Unknown function "${functionName}", trying edge function`);
        try {
          const { data, error } = await supabase.functions.invoke(functionName, { body: payload });
          if (error) throw error;
          return { data };
        } catch (e) {
          console.error(`[base44 compat] Edge function "${functionName}" failed:`, e);
          return { data: { success: false, error: e.message } };
        }
      }
    }
  },
};

// ── Integrations (file upload) ──
const integrations = {
  Core: {
    async UploadFile({ file }) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('kyc-documents').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('kyc-documents').getPublicUrl(filePath);
      return { file_url: publicUrl };
    },
  },
};

export const base44 = { entities, asServiceRole, auth, functions, integrations };
export default base44;
