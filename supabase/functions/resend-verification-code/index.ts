// Anti-spam resend OTP edge function
// Limits: 60s cooldown between sends, max 5 sends per 30-minute window per seller.
// Admins bypass throttling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COOLDOWN_SECONDS = 60;
const WINDOW_MINUTES = 30;
const MAX_PER_WINDOW = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const { seller_id, email } = body || {};
    if (!seller_id && !email) {
      return json({ error: "seller_id ou email requis" }, 400);
    }

    // Detect admin from caller JWT (bypass throttle)
    let isAdmin = false;
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData } = await userClient.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        const { data: rr } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .in("role", ["admin", "sous_admin"]);
        isAdmin = !!(rr && rr.length > 0);
      }
    }

    // Load seller
    const query = admin.from("sellers").select(
      "id, email, full_name, email_verified, email_verification_last_sent_at, email_verification_send_count, email_verification_window_start"
    );
    const { data: seller, error: selErr } = seller_id
      ? await query.eq("id", seller_id).maybeSingle()
      : await query.eq("email", String(email).toLowerCase().trim()).maybeSingle();

    if (selErr) return json({ error: selErr.message }, 500);
    if (!seller) return json({ error: "Vendeur introuvable" }, 404);
    if (seller.email_verified) return json({ error: "Email déjà vérifié" }, 400);

    const now = Date.now();

    if (!isAdmin) {
      // Cooldown check
      const last = seller.email_verification_last_sent_at
        ? new Date(seller.email_verification_last_sent_at).getTime()
        : 0;
      const elapsed = Math.floor((now - last) / 1000);
      if (last && elapsed < COOLDOWN_SECONDS) {
        const retryAfter = COOLDOWN_SECONDS - elapsed;
        return json(
          { error: `Patientez ${retryAfter}s avant de redemander un code`, retry_after: retryAfter },
          429
        );
      }

      // Window/quota check
      const windowStart = seller.email_verification_window_start
        ? new Date(seller.email_verification_window_start).getTime()
        : 0;
      const windowAge = now - windowStart;
      const withinWindow = windowStart && windowAge < WINDOW_MINUTES * 60_000;
      const count = withinWindow ? (seller.email_verification_send_count || 0) : 0;
      if (count >= MAX_PER_WINDOW) {
        const retryAfter = Math.ceil((WINDOW_MINUTES * 60_000 - windowAge) / 1000);
        return json(
          {
            error: `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfter / 60)} min.`,
            retry_after: retryAfter,
          },
          429
        );
      }
    }

    // Generate + persist new code and counters
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const windowStartTs = seller.email_verification_window_start
      ? new Date(seller.email_verification_window_start).getTime()
      : 0;
    const withinWindow = windowStartTs && now - windowStartTs < WINDOW_MINUTES * 60_000;
    const newCount = withinWindow ? (seller.email_verification_send_count || 0) + 1 : 1;
    const newWindowStart = withinWindow
      ? new Date(windowStartTs).toISOString()
      : new Date(now).toISOString();

    const { error: updErr } = await admin
      .from("sellers")
      .update({
        email_verification_code: code,
        email_verification_expires_at: expiresAt,
        email_verification_last_sent_at: new Date(now).toISOString(),
        email_verification_send_count: newCount,
        email_verification_window_start: newWindowStart,
      })
      .eq("id", seller.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Send email
    let mailSendFailed = false;
    let mailErrorMsg: string | null = null;
    try {
      const { error: mailErr } = await admin.functions.invoke("send-verification-email", {
        body: { email: seller.email, nom: seller.full_name, code },
      });
      if (mailErr) {
        mailSendFailed = true;
        mailErrorMsg = mailErr.message || "send-verification-email error";
        console.error("[resend-verification-code] mail error:", mailErr);
      }
    } catch (e) {
      mailSendFailed = true;
      mailErrorMsg = (e as Error)?.message || "send-verification-email exception";
      console.error("[resend-verification-code] mail exception:", e);
    }

    if (mailSendFailed) {
      return json(
        {
          error: "Échec d'envoi de l'email. Réessayez dans un instant ou vérifiez vos spams.",
          details: mailErrorMsg,
        },
        502,
      );
    }

    return json({
      ok: true,
      cooldown_seconds: COOLDOWN_SECONDS,
      attempts_used: newCount,
      attempts_max: MAX_PER_WINDOW,
      window_minutes: WINDOW_MINUTES,
    });
  } catch (e: any) {
    return json({ error: e?.message || "Erreur inconnue" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
