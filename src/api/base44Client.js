/**
 * Compatibility shim: wraps Supabase client with the old base44 API surface.
 * ALL base44 calls are transparently routed to Supabase.
 */

import { supabase } from "@/integrations/supabase/client";

// Map entity names to actual Supabase table names
const TABLE_MAP = {
  Seller: "sellers",
  Vendeur: "sellers",
  Produit: "produits",
  Categorie: "categories",
  Vente: "ventes",
  CommandeVendeur: "commandes_vendeur",
  Livraison: "livraisons",
  Coursier: "livraisons",
  MouvementStock: "mouvements_stock",
  JournalAudit: "journal_audit",
  NotificationVendeur: "notifications_vendeur",
  Notification: "notifications_vendeur",
  NotificationAdmin: "notifications_admin",
  DemandePaiementVendeur: "demandes_paiement_vendeur",
  PaiementCommission: "paiements_commission",
  TicketSupport: "tickets_support",
  FaqItem: "faq_items",
  RetourProduit: "retours_produit",
  CandidatureVendeur: "candidatures_vendeur",
  ConfigApp: "config_app",
  StatistiquesJournalieres: "statistiques_journalieres",
  Zone: "zones",
  SousAdmin: "sous_admins",
  AdminPermission: "admin_permissions",
  UserRole: "user_roles",
};

function parseSortField(sortStr) {
  if (!sortStr) return null;
  const desc = sortStr.startsWith("-");
  const field = desc ? sortStr.slice(1) : sortStr;
  const fieldMap = { created_date: "created_at", updated_date: "updated_at" };
  return { column: fieldMap[field] || field, ascending: !desc };
}

function createEntityProxy(tableName) {
  return {
    async list(sort, limit) {
      let query = supabase.from(tableName).select("*");
      const sortInfo = parseSortField(sort);
      if (sortInfo) query = query.order(sortInfo.column, { ascending: sortInfo.ascending });
      else query = query.order("created_at", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) { console.error(`[shim] list ${tableName}:`, error); return []; }
      return data || [];
    },

    async filter(filters, sort, limit) {
      let query = supabase.from(tableName).select("*");
      if (filters && typeof filters === "object") {
        for (const [key, val] of Object.entries(filters)) {
          const colMap = { created_date: "created_at", statut: tableName === "produits" ? "actif" : "statut" };
          // Handle special filter for produits where statut="actif" means actif=true
          if (tableName === "produits" && key === "statut" && val === "actif") {
            query = query.eq("actif", true);
          } else {
            query = query.eq(colMap[key] || key, val);
          }
        }
      }
      const sortInfo = parseSortField(sort);
      if (sortInfo) query = query.order(sortInfo.column, { ascending: sortInfo.ascending });
      else query = query.order("created_at", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) { console.error(`[shim] filter ${tableName}:`, error); return []; }
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from(tableName).select("*").eq("id", id).single();
      if (error) { console.error(`[shim] get ${tableName}:`, error); return null; }
      return data;
    },

    async create(record) {
      const { data, error } = await supabase.from(tableName).insert(record).select().single();
      if (error) { console.error(`[shim] create ${tableName}:`, error); throw error; }
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabase.from(tableName).update(updates).eq("id", id).select().single();
      if (error) { console.error(`[shim] update ${tableName}:`, error); throw error; }
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) { console.error(`[shim] delete ${tableName}:`, error); throw error; }
      return true;
    },

    subscribe(callback) {
      const channel = supabase
        .channel(`${tableName}_changes`)
        .on("postgres_changes", { event: "*", schema: "public", table: tableName }, (payload) => {
          callback({ id: payload.new?.id || payload.old?.id, data: payload.new, type: payload.eventType });
        })
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

const entitiesHandler = {
  get(_, entityName) {
    const tableName = TABLE_MAP[entityName];
    if (!tableName) {
      console.warn(`[shim] Unknown entity: ${entityName}, trying lowercase`);
      return createEntityProxy(entityName.toLowerCase());
    }
    return createEntityProxy(tableName);
  },
};

// ── Handle base44.functions.invoke() calls ──
// These were Base44 cloud functions — we implement them as direct supabase operations
async function handleFunctionInvoke(functionName, body) {
  switch (functionName) {
    case 'getAllVendeurs': {
      const { data, error } = await supabase.from('sellers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return { data: data || [] };
    }

    case 'checkEmailExists': {
      const { data } = await supabase.from('sellers').select('id').eq('email', body.email).maybeSingle();
      return { data: { exists: !!data } };
    }

    case 'registerVendeur': {
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: body.email,
        password: body.mot_de_passe,
        options: { data: { role: 'user', full_name: body.nom_complet } }
      });
      if (authError) return { data: { success: false, error: authError.message } };

      // Create seller record
      const { error: sellerError } = await supabase.from('sellers').insert({
        user_id: authData.user?.id,
        email: body.email,
        full_name: body.nom_complet,
        telephone: body.telephone,
        seller_status: 'pending_verification',
        email_verified: false,
        statut_kyc: 'en_attente',
      });
      if (sellerError) return { data: { success: false, error: sellerError.message } };

      // Generate verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase.from('sellers').update({
        email_verification_code: code,
        email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }).eq('email', body.email);

      // Try to send verification email (edge function may not exist yet)
      try {
        await supabase.functions.invoke('send-verification-email', {
          body: { email: body.email, nom: body.nom_complet, code }
        });
      } catch (e) { console.warn('Email function not available:', e); }

      return { data: { success: true } };
    }

    case 'verifyEmailCode': {
      const { data: seller } = await supabase.from('sellers')
        .select('*').eq('email', body.email).maybeSingle();
      if (!seller) return { data: { success: false, error: 'Vendeur introuvable' } };
      if (seller.email_verification_code !== body.verification_code) {
        return { data: { success: false, error: 'Code invalide' } };
      }
      const expires = new Date(seller.email_verification_expires_at);
      if (expires < new Date()) {
        return { data: { success: false, error: 'Code expiré' } };
      }
      await supabase.from('sellers').update({
        email_verified: true,
        seller_status: 'kyc_required',
        email_verification_code: null,
      }).eq('email', body.email);
      return { data: { success: true } };
    }

    case 'resendVerificationCode': {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const { data: seller } = await supabase.from('sellers')
        .select('full_name').eq('email', body.email).maybeSingle();
      await supabase.from('sellers').update({
        email_verification_code: code,
        email_verification_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }).eq('email', body.email);
      try {
        await supabase.functions.invoke('send-verification-email', {
          body: { email: body.email, nom: seller?.full_name || '', code }
        });
      } catch (e) { console.warn('Email function not available:', e); }
      return { data: { success: true } };
    }

    case 'updateKYCDocuments': {
      const updates = {
        kyc_document_recto_url: body.photo_identite_url,
        kyc_document_verso_url: body.photo_identite_verso_url || null,
        kyc_selfie_url: body.selfie_url,
        seller_status: 'kyc_pending',
        statut_kyc: 'en_attente',
      };
      const { error } = await supabase.from('sellers').update(updates).eq('email', body.email);
      if (error) return { data: { success: false, error: error.message } };

      // Notify admin
      const { data: seller } = await supabase.from('sellers')
        .select('id, full_name').eq('email', body.email).maybeSingle();
      if (seller) {
        await supabase.from('notifications_admin').insert({
          titre: 'Nouveau KYC soumis',
          message: `${seller.full_name} a soumis ses documents KYC`,
          type: 'kyc',
          vendeur_email: body.email,
          reference_id: seller.id,
        });
      }
      return { data: { success: true } };
    }

    case 'validateKYC': {
      const isValid = body.statut === 'valide';
      const updates = {
        statut_kyc: body.statut,
        seller_status: isValid ? 'active_seller' : 'kyc_required',
        kyc_raison_rejet: isValid ? null : (body.notes || 'Documents non conformes'),
      };
      const { error } = await supabase.from('sellers').update(updates).eq('id', body.seller_id);
      if (error) return { data: { success: false, error: error.message } };

      // Get seller info for notification
      const { data: seller } = await supabase.from('sellers')
        .select('email, full_name, id').eq('id', body.seller_id).maybeSingle();
      if (seller) {
        await supabase.from('notifications_vendeur').insert({
          vendeur_id: seller.id,
          vendeur_email: seller.email,
          titre: isValid ? 'Compte activé !' : 'KYC rejeté',
          message: isValid
            ? 'Votre compte ZONITE est maintenant actif. Vous pouvez commencer à vendre !'
            : `Votre dossier KYC a été rejeté. Raison: ${body.notes || 'Documents non conformes'}`,
          type: isValid ? 'succes' : 'alerte',
        });
        // Send email
        try {
          const fn = isValid ? 'send-kyc-approved-email' : 'send-kyc-rejected-email';
          const emailBody = isValid
            ? { email: seller.email, nom: seller.full_name }
            : { email: seller.email, nom: seller.full_name, raison: body.notes || 'Documents non conformes' };
          await supabase.functions.invoke(fn, { body: emailBody });
        } catch (e) { console.warn('Email function not available:', e); }
      }
      return { data: { success: true } };
    }

    case 'vendeurActions': {
      if (body.action === 'getSellerByEmail') {
        const { data } = await supabase.from('sellers')
          .select('*').eq('email', body.vendeur_email).maybeSingle();
        return { data: { seller: data } };
      }
      if (body.action === 'updateProfil') {
        const { error } = await supabase.from('sellers')
          .update(body.payload).eq('email', body.vendeur_email);
        if (error) return { data: { success: false, error: error.message } };
        return { data: { success: true } };
      }
      return { data: { success: false, error: 'Action inconnue' } };
    }

    case 'createOrderAtomically': {
      const ref = `CMD-${Date.now().toString(36).toUpperCase()}`;
      const { data: order, error } = await supabase.from('commandes_vendeur').insert({
        reference_commande: ref,
        vendeur_id: body.vendeur_id,
        vendeur_email: body.vendeur_email,
        produit_id: body.produit_id,
        produit_nom: body.produit_nom,
        variation: body.variation,
        quantite: body.quantite,
        prix_unitaire: body.prix_gros,
        prix_final_client: body.prix_final_client,
        montant_total: body.prix_final_client * body.quantite,
        livraison_incluse: body.livraison_incluse || false,
        client_nom: body.client_nom,
        client_telephone: body.client_telephone,
        client_ville: body.client_ville,
        client_quartier: body.client_quartier || '',
        client_adresse: body.client_adresse || '',
        notes: body.notes || '',
        statut: 'en_attente_validation_admin',
      }).select().single();
      if (error) return { data: { success: false, error: error.message } };

      // Notify admin
      await supabase.from('notifications_admin').insert({
        titre: 'Nouvelle commande vendeur',
        message: `${body.vendeur_email} a passé une commande pour ${body.produit_nom}`,
        type: 'commande',
        reference_id: order.id,
      });
      return { data: { success: true, order } };
    }

    case 'deleteSellerComplete': {
      const { error } = await supabase.from('sellers').delete().eq('id', body.seller_id);
      if (error) throw error;
      return { data: { success: true } };
    }

    case 'changeUserRole': {
      const { data: seller } = await supabase.from('sellers')
        .select('user_id').eq('email', body.user_email).maybeSingle();
      if (seller?.user_id) {
        await supabase.from('user_roles').upsert({
          user_id: seller.user_id,
          role: body.new_role,
        }, { onConflict: 'user_id' });
        await supabase.from('sellers').update({ role: body.new_role }).eq('email', body.user_email);
      }
      return { data: { success: true } };
    }

    case 'changePasswordVendeur': {
      // This requires service role - redirect to Supabase auth
      const { error } = await supabase.auth.updateUser({ password: body.newPassword });
      if (error) return { data: { success: false, error: error.message } };
      return { data: { success: true } };
    }

    default: {
      // Try invoking as a real edge function
      try {
        const { data, error } = await supabase.functions.invoke(functionName, { body });
        if (error) throw error;
        return { data };
      } catch (e) {
        console.warn(`[shim] Function ${functionName} not found, returning empty:`, e);
        return { data: { success: false, error: `Function ${functionName} not available` } };
      }
    }
  }
}

export const base44 = {
  entities: new Proxy({}, entitiesHandler),

  asServiceRole: {
    entities: new Proxy({}, entitiesHandler),
  },

  functions: {
    async invoke(functionName, body) {
      return handleFunctionInvoke(functionName, body);
    },
  },

  auth: {
    async me() {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) throw new Error("Not authenticated");
      return {
        id: user.id,
        email: user.email,
        role: user.user_metadata?.role || "user",
        full_name: user.user_metadata?.full_name || "",
      };
    },
    async logout(redirectUrl) {
      await supabase.auth.signOut();
      if (redirectUrl) window.location.href = redirectUrl;
    },
    redirectToLogin() {
      window.location.href = "/Connexion";
    },
  },

  integrations: {
    Core: {
      async UploadFile({ file }) {
        const fileName = `${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage.from("kyc-documents").upload(fileName, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("kyc-documents").getPublicUrl(data.path);
        return { file_url: urlData.publicUrl };
      },
    },
  },
};

export { supabase };
