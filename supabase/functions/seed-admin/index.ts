// seed-admin: admin-only password / role utility.
// SECURITY:
//   - Requires caller to be an admin (JWT verified via Supabase) OR
//     the request to carry the SUPABASE_SERVICE_ROLE_KEY in the Authorization header
//     (internal edge-function-to-edge-function call).
//   - The previously hardcoded admin password has been removed.
//   - Default mode (no body) only ensures username/role mapping for an EXISTING admin row.
//     It NEVER resets the admin password.
//   - "update_password" mode lets an admin set a password for any user_id (used by
//     the sous-admins management page).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function authorize(req: Request, supabaseAdmin: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, msg: "Missing Authorization header" };

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) return { ok: true, isService: true };

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, msg: "Invalid token" };

  const { data: isAdmin, error: rpcErr } = await supabaseAdmin.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });
  if (rpcErr) return { ok: false, status: 500, msg: rpcErr.message };
  if (!isAdmin) return { ok: false, status: 403, msg: "Admin role required" };
  return { ok: true, userId: data.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const auth = await authorize(req, supabaseAdmin);
    if (!auth.ok) return json({ success: false, error: auth.msg }, auth.status);

    let body: any = {};
    try { body = await req.json(); } catch (_) { /* empty body allowed */ }

    // ── Mode 1: admin updates a password for any user (used by sous-admins UI)
    if (body?.action === "update_password") {
      const targetUserId: string | undefined = body.user_id;
      const newPassword: string | undefined = body.password;
      if (!targetUserId || !newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return json({ success: false, error: "user_id et password (>=8 caractères) requis" }, 400);
      }
      const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });
      if (upErr) return json({ success: false, error: upErr.message }, 400);
      return json({ success: true, message: "Password updated" });
    }

    // ── Mode 2: ensure username/role mapping for the EXISTING primary admin.
    // Never creates auth users, never sets passwords.
    const email = "tonykodjeu@gmail.com";
    const { data: existingSellers } = await supabaseAdmin
      .from("sellers")
      .select("id, email, user_id")
      .eq("email", email);

    if (!existingSellers || existingSellers.length === 0) {
      return json({
        success: false,
        error: "Admin row introuvable. La création initiale doit être faite manuellement.",
      }, 404);
    }

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
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: seller.user_id, role: "admin" });
      }
    }
    return json({
      success: true,
      message: "Admin username/role ensured",
      seller_id: seller.id,
    });
  } catch (err: any) {
    console.error("seed-admin error:", err);
    return json({ success: false, error: err?.message || "Unknown error" }, 500);
  }
});
