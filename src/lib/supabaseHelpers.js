/**
 * Supabase query helpers — replaces base44 entity API surface.
 * Provides list/filter/get/create/update/delete for any table.
 */
import { supabase } from "@/integrations/supabase/client";

function parseSortField(sortStr) {
  if (!sortStr) return { column: "created_at", ascending: false };
  const desc = sortStr.startsWith("-");
  const field = desc ? sortStr.slice(1) : sortStr;
  const fieldMap = { created_date: "created_at", updated_date: "updated_at" };
  return { column: fieldMap[field] || field, ascending: !desc };
}

export async function listTable(table, sort, limit) {
  let query = supabase.from(table).select("*");
  const sortInfo = parseSortField(sort);
  query = query.order(sortInfo.column, { ascending: sortInfo.ascending });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) { console.error(`list ${table}:`, error); return []; }
  return data || [];
}

export async function filterTable(table, filters, sort, limit) {
  let query = supabase.from(table).select("*");
  if (filters && typeof filters === "object") {
    for (const [key, val] of Object.entries(filters)) {
      // Handle special case for produits where statut="actif" means actif=true
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
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) { console.error(`filter ${table}:`, error); return []; }
  return data || [];
}

export async function getRecord(table, id) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).single();
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
  const fileName = `${Date.now()}_${file.name}`;
  const { data, error } = await supabase.storage.from("kyc-documents").upload(fileName, file);
  if (error) throw error;
  const { data: urlData } = supabase.storage.from("kyc-documents").getPublicUrl(data.path);
  return { file_url: urlData.publicUrl };
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
