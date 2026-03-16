/**
 * Base44 → Supabase compatibility layer.
 * Drop-in replacement: all pages keep using `base44.entities.X.method()`
 * but calls go to Supabase under the hood.
 */
import { supabase } from "@/integrations/supabase/client";

// Entity name → Supabase table mapping
const TABLE_MAP = {
  Seller: "sellers",
  Produit: "produits",
  ConfigApp: "config_app",
  CommandeVendeur: "commandes_vendeur",
  Notification: "notifications_vendeur",
  Vente: "ventes",
  Categorie: "categories",
  Zone: "zones",
  Livraison: "livraisons",
  Coursier: "coursiers",
  PaiementCommission: "paiements_commission",
  DemandePaiement: "demandes_paiement_vendeur",
  TicketSupport: "tickets_support",
  JournalAudit: "journal_audit",
  SousAdmin: "sous_admins",
  AdminPermission: "admin_permissions",
  FAQ: "faq_items",
  RetourProduit: "retours_produit",
  MouvementStock: "mouvements_stock",
  CandidatureVendeur: "candidatures_vendeur",
};

// Base44 field → Supabase field mapping
const FIELD_MAP = {
  created_date: "created_at",
  updated_date: "updated_at",
};

function mapFields(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const mapped = {};
  for (const [key, value] of Object.entries(obj)) {
    mapped[FIELD_MAP[key] || key] = value;
  }
  return mapped;
}

function mapFieldsReverse(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const reverseMap = {};
  for (const [k, v] of Object.entries(FIELD_MAP)) reverseMap[v] = k;
  const mapped = {};
  for (const [key, value] of Object.entries(obj)) {
    mapped[reverseMap[key] || key] = value;
  }
  return mapped;
}

function mapResultRows(rows) {
  return (rows || []).map(mapFieldsReverse);
}

/**
 * Parse Base44-style sort string.
 * "-created_date" → { column: "created_at", ascending: false }
 * "nom" → { column: "nom", ascending: true }
 */
function parseSort(sortStr) {
  if (!sortStr) return null;
  const desc = sortStr.startsWith("-");
  const field = desc ? sortStr.slice(1) : sortStr;
  return {
    column: FIELD_MAP[field] || field,
    ascending: !desc,
  };
}

/**
 * Create an entity proxy that provides .filter(), .list(), .create(), .update(), .delete()
 */
function createEntityProxy(tableName) {
  return {
    /**
     * Filter records. 
     * filter(filterObj, sort?, limit?)
     * filter({}) returns all records.
     */
    async filter(filters = {}, sort, limit) {
      let query = supabase.from(tableName).select("*");

      // Apply filters
      const mappedFilters = mapFields(filters);
      for (const [key, value] of Object.entries(mappedFilters)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }

      // Apply sort
      const sortParsed = parseSort(sort);
      if (sortParsed) {
        query = query.order(sortParsed.column, { ascending: sortParsed.ascending });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      // Apply limit
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return mapResultRows(data);
    },

    /**
     * List all records with optional sort and limit.
     * list(sort?, limit?)
     */
    async list(sort, limit) {
      let query = supabase.from(tableName).select("*");

      const sortParsed = parseSort(sort);
      if (sortParsed) {
        query = query.order(sortParsed.column, { ascending: sortParsed.ascending });
      } else {
        query = query.order("created_at", { ascending: false });
      }

      if (limit) {
        query = query.limit(limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return mapResultRows(data);
    },

    /**
     * Create a new record.
     */
    async create(record) {
      const mapped = mapFields(record);
      const { data, error } = await supabase
        .from(tableName)
        .insert(mapped)
        .select()
        .single();
      if (error) throw error;
      return mapFieldsReverse(data);
    },

    /**
     * Update a record by ID.
     */
    async update(id, updates) {
      const mapped = mapFields(updates);
      const { data, error } = await supabase
        .from(tableName)
        .update(mapped)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return mapFieldsReverse(data);
    },

    /**
     * Delete a record by ID.
     */
    async delete(id) {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq("id", id);
      if (error) throw error;
      return true;
    },

    /**
     * Get a single record by ID.
     */
    async get(id) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return mapFieldsReverse(data);
    },
  };
}

// Build entities object with proxy for each entity
const entities = {};
for (const [entityName, tableName] of Object.entries(TABLE_MAP)) {
  entities[entityName] = createEntityProxy(tableName);
}

// Functions proxy - maps base44.functions.invoke() to Supabase edge functions or direct queries
const functions = {
  async invoke(functionName, params = {}) {
    // Map known function names to direct Supabase operations
    switch (functionName) {
      case "getAllVendeurs": {
        const { data, error } = await supabase.from("sellers").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return { data: mapResultRows(data) };
      }

      case "validateKYC": {
        const { seller_id, statut, notes } = params;
        const updates = {
          statut_kyc: statut,
          seller_status: statut === "valide" ? "active_seller" : "kyc_required",
        };
        const { error } = await supabase.from("sellers").update(updates).eq("id", seller_id);
        if (error) return { data: { success: false, error: error.message } };

        // Log to candidatures
        await supabase.from("candidatures_vendeur").insert({
          seller_id,
          statut: statut === "valide" ? "approuve" : "rejete",
          notes_admin: notes || "",
        });

        // Log audit
        await supabase.from("journal_audit").insert({
          action: `KYC ${statut}`,
          entite: "vendeur",
          entite_id: seller_id,
          details: { statut, notes },
        });

        return { data: { success: true } };
      }

      case "createVente": {
        const { data, error } = await supabase.from("ventes").insert({
          client_nom: params.client_nom || "",
          client_telephone: params.client_telephone || "",
          client_adresse: params.client_adresse || "",
          zone_livraison: params.zone_livraison || "",
          produits: params.produits || [],
          total: params.montant_total || 0,
          mode_paiement: params.mode_paiement || "",
          statut: "en_attente",
          notes: params.notes || "",
        }).select().single();
        if (error) throw error;
        return { data: { success: true, vente: mapFieldsReverse(data) } };
      }

      case "registerVendeur": {
        const { email, password, nom_complet, telephone } = params;
        // Sign up with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) return { data: { success: false, error: authError.message } };

        // Generate verification code
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        // Create seller record
        const { error: sellerError } = await supabase.from("sellers").insert({
          email,
          nom_complet,
          telephone: telephone || "",
          user_id: authData.user?.id,
          seller_status: "pending_verification",
          role: "user",
          verification_code: code,
          verification_code_expires_at: expires,
        });
        if (sellerError) return { data: { success: false, error: sellerError.message } };

        return { data: { success: true, verification_code: code } };
      }

      case "verifyEmail": {
        const { email, code } = params;
        const { data: sellers, error } = await supabase
          .from("sellers")
          .select("*")
          .eq("email", email)
          .eq("verification_code", code)
          .single();
        if (error || !sellers) return { data: { success: false, error: "Code invalide" } };

        if (new Date(sellers.verification_code_expires_at) < new Date()) {
          return { data: { success: false, error: "Code expiré" } };
        }

        await supabase.from("sellers").update({
          seller_status: "kyc_required",
          verification_code: null,
        }).eq("id", sellers.id);

        return { data: { success: true, seller: mapFieldsReverse(sellers) } };
      }

      case "submitKYC": {
        const { seller_id, photo_identite_url, photo_identite_verso_url, selfie_url } = params;
        await supabase.from("sellers").update({
          seller_status: "kyc_pending",
          statut_kyc: "en_attente",
          photo_identite_url,
          photo_identite_verso_url: photo_identite_verso_url || "",
          selfie_url: selfie_url || "",
        }).eq("id", seller_id);

        await supabase.from("candidatures_vendeur").insert({
          seller_id,
          statut: "en_attente",
        });

        return { data: { success: true } };
      }

      case "completeTraining": {
        const { seller_id } = params;
        await supabase.from("sellers").update({
          training_completed: true,
          catalogue_debloque: true,
        }).eq("id", seller_id);
        return { data: { success: true } };
      }

      case "loginVendeur": {
        const { email, password } = params;
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) return { data: { success: false, error: "Email ou mot de passe incorrect" } };

        const { data: seller } = await supabase.from("sellers").select("*").eq("email", email).single();
        if (!seller) return { data: { success: false, error: "Compte vendeur introuvable" } };

        return { data: { success: true, seller: mapFieldsReverse(seller) } };
      }

      case "loginAdmin": {
        const { email, password } = params;
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) return { data: { success: false, error: "Identifiants incorrects" } };

        const { data: seller } = await supabase.from("sellers").select("*").eq("email", email).single();
        if (!seller) return { data: { success: false, error: "Compte introuvable" } };
        if (seller.role !== "admin" && seller.role !== "sous_admin") {
          return { data: { success: false, error: "Accès non autorisé" } };
        }

        return { data: { success: true, admin: mapFieldsReverse(seller) } };
      }

      case "resetPassword": {
        const { email } = params;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/ResetPassword`,
        });
        if (error) return { data: { success: false, error: error.message } };
        return { data: { success: true } };
      }

      case "changePassword": {
        const { seller_id, ancien_mdp, nouveau_mdp } = params;
        const { error } = await supabase.auth.updateUser({ password: nouveau_mdp });
        if (error) return { data: { success: false, error: error.message } };
        return { data: { success: true } };
      }

      default: {
        // Try calling as edge function
        try {
          const { data, error } = await supabase.functions.invoke(functionName, { body: params });
          if (error) throw error;
          return { data };
        } catch (err) {
          console.warn(`Function ${functionName} not found, returning empty result`, err);
          return { data: { success: false, error: `Function ${functionName} not implemented` } };
        }
      }
    }
  },
};

// Auth proxy
const auth = {
  async me() {
    // Try to get from Supabase auth session
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: seller } = await supabase
        .from("sellers")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (seller) return mapFieldsReverse(seller);
      return { id: user.id, email: user.email };
    }
    return null;
  },

  async signOut() {
    await supabase.auth.signOut();
  },
};

// Storage / integrations proxy
const integrations = {
  Core: {
    async UploadFile({ file }) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error } = await supabase.storage
        .from("kyc-documents")
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("kyc-documents")
        .getPublicUrl(filePath);

      return { file_url: urlData.publicUrl };
    },
  },
};

// Export the compatibility object
export const base44 = {
  entities,
  functions,
  auth,
  integrations,
};

export default base44;
