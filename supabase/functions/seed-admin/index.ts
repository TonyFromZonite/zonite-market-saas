import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const email = "tonykodjeu@gmail.com";
    const password = "ZoniteAdmin2024!";

    // Check if seller already exists
    const { data: existingSellers } = await supabaseAdmin
      .from("sellers")
      .select("id, email, user_id")
      .eq("email", email);

    if (existingSellers && existingSellers.length > 0) {
      // Ensure username and user_roles exist
      const seller = existingSellers[0];
      await supabaseAdmin.from("sellers").update({ username: "admin" }).eq("id", seller.id);
      if (seller.user_id) {
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", seller.user_id)
          .eq("role", "admin")
          .maybeSingle();
        if (!existingRole) {
          await supabaseAdmin.from("user_roles").insert({ user_id: seller.user_id, role: "admin" });
        }
      }
      return new Response(
        JSON.stringify({ success: true, message: "Admin already exists, ensured username and role", seller_id: seller.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Try to create auth user or find existing
    let userId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "admin", full_name: "Serges Kodjeu" },
    });

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email === email);
        if (!existingUser) throw new Error("Auth user exists but not found in listUsers");
        userId = existingUser.id;
        // Update password and metadata
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: { role: "admin", full_name: "Serges Kodjeu" },
        });
      } else {
        throw authError;
      }
    } else {
      userId = authData.user.id;
    }

    // Create seller profile
    const { data: seller, error: sellerError } = await supabaseAdmin
      .from("sellers")
      .insert({
        user_id: userId,
        email,
        full_name: "Serges Kodjeu",
        username: "admin",
        role: "admin",
        seller_status: "active_seller",
        statut_kyc: "valide",
        catalogue_debloque: true,
        training_completed: true,
        email_verified: true,
      })
      .select()
      .single();

    if (sellerError) throw sellerError;

    // Create user_roles entry
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });

    return new Response(
      JSON.stringify({ success: true, message: "Admin created successfully", user_id: userId, seller_id: seller.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("seed-admin error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
