/**
 * AUDIT 20 — Sécurité RPC admin_adjust_seller_commission
 *
 * Vérifie que la RPC n'est exécutable que par un utilisateur authentifié
 * possédant le rôle 'admin'. Les appels anonymes ou par un utilisateur
 * sans rôle admin doivent échouer.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

describe.skipIf(!canRun)("Audit 20 — RPC admin_adjust_seller_commission (sécurité)", () => {
  it("20.1 anon : appel refusé (pas de rôle admin)", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await anon.rpc("admin_adjust_seller_commission", {
      _seller_id: "00000000-0000-0000-0000-000000000000",
      _delta: 1000,
      _motif: "test sécurité anonyme",
      _admin_email: "anon@test.local",
    });

    // Doit échouer : soit refus d'EXECUTE (revoke PUBLIC/anon),
    // soit RAISE EXCEPTION 'Accès refusé : admin requis'.
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    const msg = (error?.message || "").toLowerCase();
    expect(
      msg.includes("admin") ||
        msg.includes("permission") ||
        msg.includes("denied") ||
        msg.includes("accès") ||
        msg.includes("acces")
    ).toBe(true);
  });

  it("20.2 La fonction existe bien côté backend (erreur métier, pas 404)", async () => {
    const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await anon.rpc("admin_adjust_seller_commission", {
      _seller_id: "00000000-0000-0000-0000-000000000000",
      _delta: 0,
      _motif: "x",
      _admin_email: "anon@test.local",
    });
    // Ne doit pas être un "function not found" (PGRST202)
    expect(error?.code).not.toBe("PGRST202");
  });
});
