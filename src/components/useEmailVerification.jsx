import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Shared hook for sending and validating the 6-digit email verification code.
 * Used by InscriptionVendeur, ProfilVendeur and the EspaceVendeur lock screen.
 */
export function useEmailVerification() {
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  /**
   * Generate a fresh 6-digit code, persist it on the seller row, and dispatch
   * the verification email via the edge function.
   */
  const sendCode = async ({ sellerId, email, nom }) => {
    if (!sellerId || !email) {
      return { ok: false, error: "Informations manquantes" };
    }
    setSending(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { error: upErr } = await supabase
        .from("sellers")
        .update({
          email_verification_code: code,
          email_verification_expires_at: expiresAt,
        })
        .eq("id", sellerId);
      if (upErr) throw upErr;

      try {
        await supabase.functions.invoke("send-verification-email", {
          body: { email: email.toLowerCase().trim(), nom: nom || "", code },
        });
      } catch (e) {
        console.warn("[useEmailVerification] send failed:", e);
      }
      return { ok: true };
    } catch (e) {
      console.error("[useEmailVerification] sendCode error:", e);
      return { ok: false, error: e.message || "Envoi impossible" };
    } finally {
      setSending(false);
    }
  };

  /**
   * Validate the 6-digit code against the seller row.
   * On success: marks email_verified=true, clears the code, sets seller_status
   * to active_seller if it was pending_verification.
   */
  const verifyCode = async ({ sellerId, code }) => {
    if (!sellerId || !code || code.length !== 6) {
      return { ok: false, error: "Code à 6 chiffres requis" };
    }
    setVerifying(true);
    try {
      const { data: seller, error } = await supabase
        .from("sellers")
        .select("id, email_verification_code, email_verification_expires_at, seller_status, email_verified")
        .eq("id", sellerId)
        .maybeSingle();
      if (error || !seller) {
        return { ok: false, error: "Compte introuvable" };
      }
      if (seller.email_verified) {
        return { ok: true, alreadyVerified: true };
      }
      if (seller.email_verification_code !== code) {
        return { ok: false, error: "Code invalide" };
      }
      if (
        seller.email_verification_expires_at &&
        new Date(seller.email_verification_expires_at) < new Date()
      ) {
        return { ok: false, error: "Code expiré. Demandez un nouveau code." };
      }

      const updateData = {
        email_verified: true,
        email_verification_code: null,
      };
      // If the seller never finished onboarding, push them out of the
      // pending_verification state so they regain access immediately.
      if (seller.seller_status === "pending_verification") {
        updateData.seller_status = "active_seller";
      }

      const { error: upErr } = await supabase
        .from("sellers")
        .update(updateData)
        .eq("id", sellerId);
      if (upErr) throw upErr;

      return { ok: true };
    } catch (e) {
      console.error("[useEmailVerification] verifyCode error:", e);
      return { ok: false, error: e.message || "Vérification impossible" };
    } finally {
      setVerifying(false);
    }
  };

  return { sendCode, verifyCode, sending, verifying };
}
