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

    // Check if user already exists
    const { data: existingSellers } = await supabaseAdmin
      .from("sellers")
      .select("id, email")
      .eq("email", email);

    if (existingSellers && existingSellers.length > 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Admin already exists", seller_id: existingSellers[0].id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "admin",
        full_name: "Serges Kodjeu",
      },
    });

    if (authError) {
      // If user exists in auth but not in sellers
      if (authError.message?.includes("already been registered")) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email === email);
        if (existingUser) {
          // Create seller profile for existing auth user
          const { data: seller, error: sellerError } = await supabaseAdmin
            .from("sellers")
            .insert({
              user_id: existingUser.id,
              email,
              nom_complet: "Serges Kodjeu",
              role: "admin",
              seller_status: "active",
              statut_kyc: "valide",
              catalogue_debloque: true,
              training_completed: true,
            })
            .select()
            .single();

          if (sellerError) throw sellerError;
          return new Response(
            JSON.stringify({ success: true, message: "Seller profile created for existing auth user", seller }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      throw authError;
    }

    // Create seller profile
    const { data: seller, error: sellerError } = await supabaseAdmin
      .from("sellers")
      .insert({
        user_id: authData.user.id,
        email,
        nom_complet: "Serges Kodjeu",
        role: "admin",
        seller_status: "active",
        statut_kyc: "valide",
        catalogue_debloque: true,
        training_completed: true,
      })
      .select()
      .single();

    if (sellerError) throw sellerError;

    return new Response(
      JSON.stringify({ success: true, message: "Admin created successfully", user_id: authData.user.id, seller }),
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
