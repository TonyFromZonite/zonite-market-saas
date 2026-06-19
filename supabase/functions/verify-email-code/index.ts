// Verify email OTP server-side using service role.
// Bypasses the `prevent_seller_privileged_updates` trigger that blocks
// vendors from updating `email_verified` / `seller_status` themselves.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const { seller_id, code } = body || {};

    if (!seller_id || !code) {
      return json({ error: "seller_id et code requis" }, 400);
    }
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return json({ error: "Code invalide (6 chiffres attendus)" }, 400);
    }

    const { data: seller, error: selErr } = await admin
      .from("sellers")
      .select(
        "id, email, full_name, email_verified, email_verification_code, email_verification_expires_at, user_id, statut_kyc, catalogue_debloque, training_completed, telephone, seller_status"
      )
      .eq("id", seller_id)
      .maybeSingle();

    if (selErr) return json({ error: selErr.message }, 500);
    if (!seller) return json({ error: "Compte introuvable" }, 404);

    if (seller.email_verified === true) {
      // Idempotent : on retourne success pour ne pas bloquer la redirection
      return json({ success: true, already_verified: true, seller });
    }

    if (!seller.email_verification_code || seller.email_verification_code !== code) {
      return json({ error: "Code invalide" }, 400);
    }
    if (
      seller.email_verification_expires_at &&
      new Date(seller.email_verification_expires_at) < new Date()
    ) {
      return json({ error: "Code expiré. Demandez un nouveau code." }, 400);
    }

    const { data: updated, error: updErr } = await admin
      .from("sellers")
      .update({
        email_verified: true,
        email_verification_code: null,
        seller_status: "active_seller",
      })
      .eq("id", seller.id)
      .select(
        "id, email, full_name, user_id, statut_kyc, catalogue_debloque, training_completed, telephone, seller_status, solde_commission, wizard_completed"
      )
      .maybeSingle();

    if (updErr) return json({ error: updErr.message }, 500);
    if (!updated) return json({ error: "Échec de l'activation" }, 500);

    return json({ success: true, seller: updated });
  } catch (e) {
    return json({ error: (e as Error).message || "Erreur serveur" }, 500);
  }
});
