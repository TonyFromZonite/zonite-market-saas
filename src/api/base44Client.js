/**
 * Compatibility shim: wraps Supabase client with the old base44 API surface.
 * This allows all existing pages to work without modification.
 * 
 * base44.entities.EntityName.list(sort, limit) → supabase.from(table).select().order().limit()
 * base44.entities.EntityName.filter(filters, sort, limit) → supabase.from(table).select().eq().order().limit()
 * base44.entities.EntityName.create(data) → supabase.from(table).insert(data)
 * base44.entities.EntityName.update(id, data) → supabase.from(table).update(data).eq('id', id)
 * base44.entities.EntityName.delete(id) → supabase.from(table).delete().eq('id', id)
 * base44.entities.EntityName.get(id) → supabase.from(table).select().eq('id', id).single()
 * base44.functions.invoke(name, body) → supabase.functions.invoke(name, { body })
 * base44.auth.me() → supabase.auth.getUser()
 */

import { supabase } from "@/integrations/supabase/client";

// Map entity names to actual Supabase table names
const TABLE_MAP = {
  Seller: "sellers",
  Produit: "produits",
  Categorie: "categories",
  Vente: "ventes",
  CommandeVendeur: "commandes_vendeur",
  Livraison: "livraisons",
  MouvementStock: "mouvements_stock",
  JournalAudit: "journal_audit",
  NotificationVendeur: "notifications_vendeur",
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
  // Map common Base44 field names to Supabase column names
  const fieldMap = {
    created_date: "created_at",
    updated_date: "updated_at",
  };
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
      if (error) { console.error(`[base44 shim] list ${tableName}:`, error); return []; }
      return data || [];
    },

    async filter(filters, sort, limit) {
      let query = supabase.from(tableName).select("*");
      if (filters && typeof filters === "object") {
        for (const [key, val] of Object.entries(filters)) {
          const colMap = { created_date: "created_at" };
          query = query.eq(colMap[key] || key, val);
        }
      }
      const sortInfo = parseSortField(sort);
      if (sortInfo) query = query.order(sortInfo.column, { ascending: sortInfo.ascending });
      else query = query.order("created_at", { ascending: false });
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) { console.error(`[base44 shim] filter ${tableName}:`, error); return []; }
      return data || [];
    },

    async get(id) {
      const { data, error } = await supabase.from(tableName).select("*").eq("id", id).single();
      if (error) { console.error(`[base44 shim] get ${tableName}:`, error); return null; }
      return data;
    },

    async create(record) {
      const { data, error } = await supabase.from(tableName).insert(record).select().single();
      if (error) { console.error(`[base44 shim] create ${tableName}:`, error); throw error; }
      return data;
    },

    async update(id, updates) {
      const { data, error } = await supabase.from(tableName).update(updates).eq("id", id).select().single();
      if (error) { console.error(`[base44 shim] update ${tableName}:`, error); throw error; }
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) { console.error(`[base44 shim] delete ${tableName}:`, error); throw error; }
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

// Create entities proxy that lazily creates entity helpers
const entitiesHandler = {
  get(_, entityName) {
    const tableName = TABLE_MAP[entityName];
    if (!tableName) {
      console.warn(`[base44 shim] Unknown entity: ${entityName}, trying lowercase`);
      return createEntityProxy(entityName.toLowerCase());
    }
    return createEntityProxy(tableName);
  },
};

export const base44 = {
  entities: new Proxy({}, entitiesHandler),

  // Service role proxy (same as regular for client — RLS handles access)
  asServiceRole: {
    entities: new Proxy({}, entitiesHandler),
  },

  functions: {
    async invoke(functionName, body) {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) { console.error(`[base44 shim] function ${functionName}:`, error); throw error; }
      return { data };
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
    redirectToLogin(returnUrl) {
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

// Also export supabase for direct use
export { supabase };
