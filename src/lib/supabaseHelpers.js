/**
 * Supabase query helpers — optimized with column selection and limits.
 */
import { supabase } from "@/integrations/supabase/client";
import { processImageForUpload } from "@/lib/imageProcessor";


// Default column sets per table to avoid SELECT *
const TABLE_COLUMNS = {
  sellers: 'id, email, full_name, username, telephone, ville, quartier, role, seller_status, statut_kyc, solde_commission, solde_en_attente, total_commissions_gagnees, total_commissions_payees, catalogue_debloque, training_completed, email_verified, photo_profil_url, user_id, created_at, updated_at, kyc_raison_rejet, numero_mobile_money, operateur_mobile_money, experience_vente, motivation, whatsapp, date_naissance, kyc_type_document, kyc_document_recto_url, kyc_document_verso_url, kyc_selfie_url',
  commandes_vendeur: 'id, vendeur_id, vendeur_email, produit_id, produit_nom, produit_reference, variation, quantite, prix_unitaire, montant_total, prix_final_client, frais_livraison, client_nom, client_telephone, client_ville, client_quartier, client_adresse, statut, notes, notes_admin, coursier_id, coursier_nom, reference_commande, created_at, updated_at',
  produits: 'id, nom, reference, description, categorie_id, prix_achat, prix_gros, prix_vente, stock_global, seuil_alerte_stock, variations, stocks_par_coursier, images, actif, featured, created_at, updated_at, lien_telegram',
  ventes: 'id, vendeur_id, vendeur_email, produit_id, commande_id, quantite, montant_total, commission_vendeur, profit_zonite, marge_zonite, prix_achat, prix_gros, prix_final_client, prix_achat_unitaire, created_at',
  notifications_admin: 'id, titre, message, type, lu, vendeur_email, reference_id, created_at',
  notifications_vendeur: 'id, vendeur_id, vendeur_email, titre, message, type, lu, action_url, created_at',
  tickets_support: 'id, vendeur_id, vendeur_email, sujet, message, statut, priorite, categorie, reponse_admin, repondu_par, repondu_at, lu_par_vendeur, created_at',
};

function getColumns(table) {
  return TABLE_COLUMNS[table] || '*';
}

function parseSortField(sortStr) {
  if (!sortStr) return { column: "created_at", ascending: false };
  const desc = sortStr.startsWith("-");
  const field = desc ? sortStr.slice(1) : sortStr;
  const fieldMap = { created_date: "created_at", updated_date: "updated_at" };
  return { column: fieldMap[field] || field, ascending: !desc };
}

export async function listTable(table, sort, limit = 100) {
  let query = supabase.from(table).select(getColumns(table));
  const sortInfo = parseSortField(sort);
  query = query.order(sortInfo.column, { ascending: sortInfo.ascending });
  query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    console.error(`list ${table}:`, error);
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      throw new Error('SESSION_EXPIRED');
    }
    return [];
  }
  return data || [];
}

export async function filterTable(table, filters, sort, limit = 100) {
  let query = supabase.from(table).select(getColumns(table));
  if (filters && typeof filters === "object") {
    for (const [key, val] of Object.entries(filters)) {
      if (table === "produits" && key === "statut" && val === "actif") {
        query = query.eq("actif", true);
      } else {
        const colMap = { created_date: "created_at" };
        query = query.eq(colMap[key] || key, val);
      }
    }
  }
  const sortInfo = parseSortField(sort);
  query = query.order(sortInfo.column, { ascending: sortInfo.ascending });
  query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    console.error(`filter ${table}:`, error);
    if (error.code === 'PGRST301' || error.message?.includes('JWT')) {
      throw new Error('SESSION_EXPIRED');
    }
    return [];
  }
  return data || [];
}

export async function getRecord(table, id) {
  const { data, error } = await supabase.from(table).select(getColumns(table)).eq("id", id).single();
  if (error) { console.error(`get ${table}:`, error); return null; }
  return data;
}

export async function createRecord(table, record) {
  const { data, error } = await supabase.from(table).insert(record).select().single();
  if (error) { console.error(`create ${table}:`, error); throw error; }
  return data;
}

export async function updateRecord(table, id, updates) {
  const { data, error } = await supabase.from(table).update(updates).eq("id", id).select().single();
  if (error) { console.error(`update ${table}:`, error); throw error; }
  return data;
}

export async function deleteRecord(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) { console.error(`delete ${table}:`, error); throw error; }
  return true;
}

export async function uploadFile(file) {
  // Normalisation : HEIC → JPEG, resize ≤1600px, compression qualité 0.85
  const processed = await processImageForUpload(file);
  const safeName = (processed.name || `image_${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${Date.now()}_${safeName}`;
  const { data, error } = await supabase.storage.from("kyc-documents").upload(fileName, processed);
  if (error) throw error;
  // Bucket is private — return a URL that points to the public proxy Edge Function.
  return { file_url: getProductImageUrl(data.path) };
}


/**
 * Returns a publicly accessible URL for a product image.
 * - Accepts either a bare path ("1234_foo.jpg") or a legacy public URL
 *   (".../storage/v1/object/public/kyc-documents/1234_foo.jpg").
 * - Rewrites it to the serve-product-image Edge Function so that the
 *   underlying private bucket stays private.
 * - Leaves unrelated URLs (http(s) to other hosts, data:, blob:) untouched.
 */
export function getProductImageUrl(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  const projectId = "jpopxydfttoseckcakqp";
  const proxyBase = `https://${projectId}.supabase.co/functions/v1/serve-product-image`;

  // Already pointing at the proxy
  if (url.includes("/serve-product-image")) return url;

  // Legacy public/sign URL for the kyc-documents bucket
  const marker = "/kyc-documents/";
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    let path = url.slice(idx + marker.length).split("?")[0].replace(/^\/+/, "");
    // KYC paths must never be served by this proxy
    if (!path || path.startsWith("kyc/")) return url;
    return `${proxyBase}?path=${encodeURIComponent(path)}`;
  }

  // Bare path
  if (!url.startsWith("http") && !url.startsWith("/")) {
    if (url.startsWith("kyc/")) return url;
    return `${proxyBase}?path=${encodeURIComponent(url)}`;
  }

  return url;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Not authenticated");
  return {
    id: user.id,
    email: user.email,
    role: user.user_metadata?.role || "user",
    full_name: user.user_metadata?.full_name || "",
  };
}

export function subscribeToTable(table, callback) {
  const channel = supabase
    .channel(`${table}_changes`)
    .on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      callback({ id: payload.new?.id || payload.old?.id, data: payload.new, type: payload.eventType });
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}
