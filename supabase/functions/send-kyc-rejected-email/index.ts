import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, nom, raison } = await req.json();
    
    console.log(`[send-kyc-rejected-email] Sending to ${email}, raison: ${raison}`);

    const emailContent = {
      to: email,
      subject: "ZONITE - KYC non validé",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1f5e, #2d34a5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #F5C518; margin: 0; font-size: 28px;">ZONITE</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1E293B;">Bonjour ${nom},</h2>
            <p style="color: #64748B;">Malheureusement, votre dossier KYC n'a pas été validé.</p>
            <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #991B1B; font-weight: bold; margin: 0 0 5px;">Raison du rejet :</p>
              <p style="color: #B91C1C; margin: 0;">${raison}</p>
            </div>
            <p style="color: #64748B;">Vous pouvez resoumettre vos documents depuis votre espace vendeur.</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="color: #94A3B8; font-size: 12px; text-align: center;">L'équipe ZONITE</p>
          </div>
        </div>
      `,
    };

    console.log('[send-kyc-rejected-email] Email prepared for:', email);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
