import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROTECTED_EMAILS = new Set(["tonykodjeu@gmail.com"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deleteAccount(
  admin: ReturnType<typeof createClient>,
  email: string,
  userId: string | null,
  sellerId: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (PROTECTED_EMAILS.has(email.toLowerCase())) {
    return { ok: false, reason: "compte protégé" };
  }

  // Sécurité : refuser si admin/sous_admin
  if (userId) {
    const { data: rolesData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData || []).map((r: { role: string }) => r.role);
    if (roles.includes("admin") || roles.includes("sous_admin")) {
      return { ok: false, reason: "rôle administratif" };
    }
  }

  // Sécurité : refuser si email déjà vérifié
  if (sellerId) {
    const { data: sellerRow } = await admin
      .from("sellers")
      .select("email_verified")
      .eq("id", sellerId)
      .maybeSingle();
    if (sellerRow?.email_verified === true) {
      return { ok: false, reason: "compte vérifié" };
    }
  }

  if (userId) {
    await admin.from("user_roles").delete().eq("user_id", userId);
  }
  if (sellerId) {
    await admin.from("sellers").delete().eq("id", sellerId);
  } else if (userId) {
    // orphelin : tenter un cleanup par user_id au cas où
    await admin.from("sellers").delete().eq("user_id", userId);
  }
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth : appelant doit être admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Non autorisé" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } =
      await admin.auth.getUser(token);
    if (authError || !caller) return jsonResponse({ error: "Non autorisé" }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) return jsonResponse({ error: "Accès refusé : admin requis" }, 403);

    const body = await req.json().catch(() => ({}));
    const purgeAll = body?.purge_all === true;
    const targetEmail = body?.email
      ? String(body.email).toLowerCase().trim()
      : null;

    const results: { email: string; ok: boolean; reason?: string }[] = [];

    // ── Mode purge_all ───────────────────────────────────────────────────────
    if (purgeAll) {
      // 1) sellers non vérifiés
      const { data: unverifiedSellers } = await admin
        .from("sellers")
        .select("id, email, user_id")
        .eq("email_verified", false);

      for (const s of unverifiedSellers || []) {
        const res = await deleteAccount(admin, s.email, s.user_id, s.id);
        results.push({ email: s.email, ...res });
      }

      // 2) auth.users orphelins (pas de sellers, pas admin/sous_admin)
      const orphanEmails: { id: string; email: string }[] = [];
      let page = 1;
      while (true) {
        const { data: list, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error) break;
        const users = list?.users || [];
        if (users.length === 0) break;
        for (const u of users) {
          if (!u.email) continue;
          // Skip si déjà traité dans la passe sellers
          if (results.find((r) => r.email === u.email.toLowerCase())) continue;
          // Skip si sellers existe (vérifié)
          const { data: stillSeller } = await admin
            .from("sellers")
            .select("id, email_verified")
            .eq("user_id", u.id)
            .maybeSingle();
          if (stillSeller) continue;
          // Skip si admin/sous_admin
          const { data: rolesData } = await admin
            .from("user_roles")
            .select("role")
            .eq("user_id", u.id);
          const roles = (rolesData || []).map((r: { role: string }) => r.role);
          if (roles.includes("admin") || roles.includes("sous_admin")) continue;
          orphanEmails.push({ id: u.id, email: u.email });
        }
        if (users.length < 200) break;
        page += 1;
        if (page > 20) break; // garde-fou
      }

      for (const o of orphanEmails) {
        const res = await deleteAccount(admin, o.email, o.id, null);
        results.push({ email: o.email, ...res });
      }

      const deleted = results.filter((r) => r.ok).length;
      const skipped = results.filter((r) => !r.ok);

      // Audit
      await admin.from("journal_audit").insert({
        action: "cleanup_unverified_accounts_bulk",
        module: "vendeurs",
        utilisateur: caller.email,
        utilisateur_id: caller.id,
        details: {
          deleted_count: deleted,
          skipped_count: skipped.length,
          skipped,
        },
      });

      return jsonResponse({
        success: true,
        deleted_count: deleted,
        skipped_count: skipped.length,
        skipped,
      });
    }

    // ── Mode email unique ────────────────────────────────────────────────────
    if (!targetEmail) {
      return jsonResponse(
        { error: "Paramètre 'email' ou 'purge_all' requis" },
        400,
      );
    }

    const { data: seller } = await admin
      .from("sellers")
      .select("id, user_id, email_verified")
      .eq("email", targetEmail)
      .maybeSingle();

    let userId: string | null = seller?.user_id ?? null;
    if (!userId) {
      // Lookup auth user par email
      let page = 1;
      while (!userId) {
        const { data: list, error } = await admin.auth.admin.listUsers({
          page,
          perPage: 200,
        });
        if (error) break;
        const users = list?.users || [];
        if (users.length === 0) break;
        const match = users.find(
          (u) => u.email?.toLowerCase() === targetEmail,
        );
        if (match) {
          userId = match.id;
          break;
        }
        if (users.length < 200) break;
        page += 1;
        if (page > 20) break;
      }
    }

    if (!seller && !userId) {
      return jsonResponse({ error: "Compte introuvable" }, 404);
    }

    const res = await deleteAccount(
      admin,
      targetEmail,
      userId,
      seller?.id ?? null,
    );

    await admin.from("journal_audit").insert({
      action: "cleanup_unverified_account",
      module: "vendeurs",
      utilisateur: caller.email,
      utilisateur_id: caller.id,
      details: { email: targetEmail, ...res },
    });

    if (!res.ok) {
      return jsonResponse(
        { error: `Impossible de supprimer (${res.reason})` },
        400,
      );
    }
    return jsonResponse({ success: true, email: targetEmail });
  } catch (error) {
    console.error("[cleanup-unverified-account] fatal:", error);
    return jsonResponse(
      { error: (error as Error).message || "Erreur serveur" },
      500,
    );
  }
});
