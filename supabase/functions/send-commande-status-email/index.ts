import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const STATUTS_FR: Record<string, string> = {
  en_attente_validation_admin: "En attente de validation",
  validee: "Validée par l'admin",
  en_livraison: "En cours de livraison",
  livree: "Livrée avec succès",
  echec: "Échec de livraison",
  annulee: "Annulée",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, nom, statut, reference } = await req.json();
    console.log(`[send-commande-status-email] Sending to ${email}, ref: ${reference}, statut: ${statut}`);

    const statutLabel = STATUTS_FR[statut] || statut;
    const isSuccess = statut === 'livree';
    const bgColor = isSuccess ? '#ECFDF5' : '#FEF3C7';
    const textColor = isSuccess ? '#065F46' : '#92400E';

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: 'Zonite Market <hello@zonite.org>',
      to: email,
      subject: `Zonite Market - Statut commande ${reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1f5e, #2d34a5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #F5C518; margin: 0; font-size: 28px;">Zonite Market</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1E293B;">Bonjour ${nom},</h2>
            <p style="color: #64748B;">Mise à jour de votre commande <strong>${reference}</strong> :</p>
            <div style="background: ${bgColor}; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
              <p style="color: ${textColor}; font-weight: bold; font-size: 18px; margin: 0;">${statutLabel}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="color: #94A3B8; font-size: 12px; text-align: center;">L'équipe Zonite Market</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[send-commande-status-email] Resend error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
