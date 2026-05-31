import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function makeOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

    const body = await req.json().catch(() => null);
    if (!body) return jsonResponse({ error: "JSON invalide" }, 400);

    const full_name = String(body.full_name || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");
    const username = String(body.username || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, "");
    const parraine_par = body.parraine_par
      ? String(body.parraine_par).toUpperCase().trim()
      : null;

    // Validation
    if (!full_name || full_name.length < 2) {
      return jsonResponse({ error: "Nom complet requis", field: "full_name" }, 400);
    }
    if (!username || username.length < 3 || username.length > 20) {
      return jsonResponse(
        { error: "Nom d'utilisateur invalide (3-20 caractères)", field: "username" },
        400,
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Email invalide", field: "email" }, 400);
    }
    if (!password || password.length < 6) {
      return jsonResponse(
        { error: "Mot de passe trop court (min 6 caractères)", field: "password" },
        400,
      );
    }

    // ── 1. Reprise : sellers existant non vérifié ────────────────────────────
    const { data: existingSeller } = await admin
      .from("sellers")
      .select("id, email, email_verified, full_name, user_id")
      .eq("email", email)
      .maybeSingle();

    if (existingSeller) {
      if (existingSeller.email_verified === true) {
        return jsonResponse(
          { error: "Cet email a déjà un compte vérifié. Connectez-vous.", field: "email" },
          409,
        );
      }

      // Reprise : régénérer OTP + renvoyer
      const code = makeOtp();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await admin
        .from("sellers")
        .update({
          email_verification_code: code,
          email_verification_expires_at: expiresAt,
          seller_status: "pending_verification",
        })
        .eq("id", existingSeller.id);

      const { error: mailErr } = await admin.functions.invoke(
        "send-verification-email",
        { body: { email, nom: existingSeller.full_name || full_name, code } },
      );
      if (mailErr) {
        console.error("[register-seller] resume mail error:", mailErr);
        return jsonResponse(
          { error: "Impossible d'envoyer le code de vérification. Réessayez." },
          502,
        );
      }

      return jsonResponse({
        resumed: true,
        seller_id: existingSeller.id,
        email,
      });
    }

    // ── 2. Username déjà pris ? ──────────────────────────────────────────────
    const { data: usernameTaken } = await admin
      .from("sellers")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (usernameTaken) {
      return jsonResponse(
        { error: "Ce nom d'utilisateur est déjà pris", field: "username" },
        409,
      );
    }

    // ── 3. Création atomique avec rollback ───────────────────────────────────
    let createdUserId: string | null = null;
    let createdSellerId: string | null = null;
    let createdRole = false;

    const rollback = async () => {
      try {
        if (createdRole && createdUserId) {
          await admin.from("user_roles").delete().eq("user_id", createdUserId);
        }
        if (createdSellerId) {
          await admin.from("sellers").delete().eq("id", createdSellerId);
        }
        if (createdUserId) {
          await admin.auth.admin.deleteUser(createdUserId);
        }
      } catch (e) {
        console.error("[register-seller] rollback error:", e);
      }
    };

    try {
      // 3a. Création auth user (email confirmé : on gère notre OTP métier)
      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, username },
      });

      if (authErr || !created?.user) {
        const msg = authErr?.message || "Erreur de création du compte";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
          return jsonResponse(
            { error: "Cet email a déjà un compte. Connectez-vous.", field: "email" },
            409,
          );
        }
        return jsonResponse({ error: msg }, 400);
      }
      createdUserId = created.user.id;

      // 3b. Insert sellers
      const otp = makeOtp();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const refCode = username
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 8);

      const { data: sellerRow, error: sellerErr } = await admin
        .from("sellers")
        .insert({
          user_id: createdUserId,
          full_name,
          username,
          email,
          code_parrainage: refCode,
          seller_status: "pending_verification",
          statut_kyc: "non_soumis",
          wizard_completed: false,
          email_verified: false,
          email_verification_code: otp,
          email_verification_expires_at: expiresAt,
          parraine_par: parraine_par || null,
        })
        .select("id")
        .single();

      if (sellerErr || !sellerRow) {
        await rollback();
        if (sellerErr?.code === "23505") {
          const detail = String(sellerErr.message || "").toLowerCase();
          const field = detail.includes("username")
            ? "username"
            : detail.includes("email")
              ? "email"
              : detail.includes("code_parrainage")
                ? "username"
                : undefined;
          return jsonResponse(
            { error: "Identifiant déjà utilisé", field },
            409,
          );
        }
        return jsonResponse(
          { error: sellerErr?.message || "Erreur création profil vendeur" },
          500,
        );
      }
      createdSellerId = sellerRow.id;

      // 3c. Insert user_roles
      const { error: roleErr } = await admin.from("user_roles").insert({
        user_id: createdUserId,
        role: "vendeur",
      });
      if (roleErr) {
        await rollback();
        return jsonResponse(
          { error: roleErr.message || "Erreur attribution rôle" },
          500,
        );
      }
      createdRole = true;

      // 3d. Envoi OTP — échec ⇒ rollback complet
      const { error: mailErr } = await admin.functions.invoke(
        "send-verification-email",
        { body: { email, nom: full_name, code: otp } },
      );
      if (mailErr) {
        console.error("[register-seller] verification email error:", mailErr);
        await rollback();
        return jsonResponse(
          { error: "Impossible d'envoyer le code de vérification. Réessayez." },
          502,
        );
      }

      return jsonResponse({
        seller_id: createdSellerId,
        user_id: createdUserId,
        email,
        resumed: false,
      });
    } catch (e) {
      console.error("[register-seller] unexpected:", e);
      await rollback();
      return jsonResponse(
        { error: (e as Error).message || "Erreur interne" },
        500,
      );
    }
  } catch (error) {
    console.error("[register-seller] fatal:", error);
    return jsonResponse(
      { error: (error as Error).message || "Erreur serveur" },
      500,
    );
  }
});
