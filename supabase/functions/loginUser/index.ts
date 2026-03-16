import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hash, compare } from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, userType } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Email et mot de passe requis" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const normalizedEmail = email.trim().toLowerCase();

    // Determine which roles to accept
    const allowedRoles =
      userType === "admin" ? ["admin", "sous_admin"] : ["vendeur", "user"];

    const { data: sellers, error } = await supabaseAdmin
      .from("sellers")
      .select("*")
      .eq("email", normalizedEmail);

    if (error) throw error;

    // Find seller with matching role
    const seller = sellers?.find((s: any) => allowedRoles.includes(s.role));

    if (!seller) {
      return new Response(
        JSON.stringify({ success: false, error: "Aucun compte trouvé" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if account is suspended
    if (seller.seller_status === "suspended") {
      return new Response(
        JSON.stringify({ success: false, error: "Compte suspendu" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify password
    if (!seller.password_hash) {
      return new Response(
        JSON.stringify({ success: false, error: "Mot de passe non configuré" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const passwordValid = await compare(password, seller.password_hash);
    if (!passwordValid) {
      return new Response(
        JSON.stringify({ success: false, error: "Mot de passe incorrect" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For vendeur: check if pending approval
    if (
      userType === "vendeur" &&
      ["pending_verification", "pending_kyc"].includes(seller.seller_status)
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          pendingApproval: true,
          error: "Votre compte est en attente de validation",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build session object
    const session: any = {
      id: seller.id,
      email: seller.email,
      nom_complet: seller.nom_complet,
      role: seller.role,
      seller_status: seller.seller_status,
      statut_kyc: seller.statut_kyc,
      telephone: seller.telephone,
      catalogue_debloque: seller.catalogue_debloque,
      training_completed: seller.training_completed,
      solde_commission: seller.solde_commission,
    };

    // For sous_admin, fetch permissions
    if (seller.role === "sous_admin") {
      const { data: sousAdmin } = await supabaseAdmin
        .from("sous_admins")
        .select("permissions, actif")
        .eq("seller_id", seller.id)
        .single();

      if (sousAdmin && !sousAdmin.actif) {
        return new Response(
          JSON.stringify({ success: false, error: "Compte sous-admin désactivé" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      session.permissions = sousAdmin?.permissions || [];
    }

    return new Response(
      JSON.stringify({ success: true, session }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("loginUser error:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Erreur serveur" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
