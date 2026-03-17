import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error("Non autorisé");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Accès refusé: admin uniquement");

    const { seller_id } = await req.json();
    if (!seller_id) throw new Error("seller_id requis");

    // Get seller info
    const { data: seller, error: sellerErr } = await supabaseAdmin
      .from("sellers")
      .select("id, user_id, email")
      .eq("id", seller_id)
      .single();

    if (sellerErr || !seller) throw new Error("Vendeur introuvable");

    // Delete all related data in order (foreign key dependencies)
    const tables = [
      { table: "ventes", column: "vendeur_id" },
      { table: "paiements_commission", column: "vendeur_id" },
      { table: "demandes_paiement_vendeur", column: "vendeur_id" },
      { table: "retours_produit", column: "vendeur_id" },
      { table: "commandes_vendeur", column: "vendeur_id" },
      { table: "notifications_vendeur", column: "vendeur_id" },
      { table: "tickets_support", column: "vendeur_id" },
      { table: "candidatures_vendeur", column: "seller_id" },
    ];

    for (const { table, column } of tables) {
      await supabaseAdmin.from(table).delete().eq(column, seller_id);
    }

    // Delete sous_admin entry if exists
    await supabaseAdmin.from("admin_permissions").delete().eq("sous_admin_email", seller.email);
    await supabaseAdmin.from("sous_admins").delete().eq("seller_id", seller_id);

    // Delete user_roles
    if (seller.user_id) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", seller.user_id);
    }

    // Delete the seller record
    await supabaseAdmin.from("sellers").delete().eq("id", seller_id);

    // Delete the auth user
    if (seller.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(seller.user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
