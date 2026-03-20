import { supabase } from "@/integrations/supabase/client";

const BONUS_AMOUNT = 500; // FCFA per delivery
const MAX_DELIVERIES = 10;

/**
 * Credits 500 FCFA to the parrain when their filleul completes a delivery.
 * Only for the first 10 deliveries. Updates parrainages tracking.
 * @param {string} vendeurId - The filleul (seller who made the sale)
 */
export async function creditReferralBonus(vendeurId) {
  try {
    // Check if this vendor has a parrain via parrainages table
    const { data: parrainage } = await supabase
      .from("parrainages")
      .select("id, parrain_id, livraisons_comptees, commission_totale, actif")
      .eq("filleul_id", vendeurId)
      .eq("actif", true)
      .maybeSingle();

    if (!parrainage || (parrainage.livraisons_comptees || 0) >= MAX_DELIVERIES) {
      return null; // No active referral or limit reached
    }

    const newCount = (parrainage.livraisons_comptees || 0) + 1;
    const newTotal = (parrainage.commission_totale || 0) + BONUS_AMOUNT;
    const isComplete = newCount >= MAX_DELIVERIES;

    // 1. Update parrainages counter
    await supabase.from("parrainages").update({
      livraisons_comptees: newCount,
      commission_totale: newTotal,
      actif: !isComplete, // Deactivate after 10 deliveries
    }).eq("id", parrainage.id);

    // 2. Credit parrain balance atomically
    await supabase.rpc("credit_seller_commission", {
      _seller_id: parrainage.parrain_id,
      _commission: BONUS_AMOUNT,
    });

    // 3. Get parrain and filleul names for notification
    const { data: filleul } = await supabase
      .from("sellers")
      .select("full_name")
      .eq("id", vendeurId)
      .single();

    const { data: parrainSeller } = await supabase
      .from("sellers")
      .select("email")
      .eq("id", parrainage.parrain_id)
      .single();

    // 4. Notify parrain
    const remainingMsg = isComplete
      ? "🏆 C'était la dernière livraison du programme !"
      : `📊 ${newCount}/${MAX_DELIVERIES} livraisons comptées`;

    await supabase.from("notifications_vendeur").insert({
      vendeur_id: parrainage.parrain_id,
      vendeur_email: parrainSeller?.email || "",
      titre: "💰 Bonus parrainage !",
      message: `Votre filleul ${filleul?.full_name || "un vendeur"} vient de réussir une livraison !\n\n🎁 Bonus : +${BONUS_AMOUNT.toLocaleString("fr-FR")} FCFA\n${remainingMsg}`,
      type: "succes",
    });

    return { parrainId: parrainage.parrain_id, bonus: BONUS_AMOUNT, count: newCount };
  } catch (err) {
    console.warn("creditReferralBonus error:", err);
    return null;
  }
}
