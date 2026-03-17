import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, nom, code } = await req.json();
    console.log(`[send-verification-email] Sending to ${email}, code: ${code}`);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('[send-verification-email] RESEND_API_KEY not set, skipping send');
      return new Response(JSON.stringify({ success: true, skipped: true, message: 'No RESEND_API_KEY configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: 'ZONITE <onboarding@resend.dev>',
      to: email,
      subject: "ZONITE - Code de vérification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1f5e, #2d34a5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #F5C518; margin: 0; font-size: 28px;">ZONITE</h1>
            <p style="color: #CBD5E1; margin-top: 5px;">Plateforme de vente</p>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1E293B;">Bonjour ${nom} 👋</h2>
            <p style="color: #64748B;">Votre code de vérification est :</p>
            <div style="background: #F1F5F9; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1f5e;">${code}</span>
            </div>
            <p style="color: #64748B; font-size: 14px;">Ce code expire dans 24 heures.</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="color: #94A3B8; font-size: 12px; text-align: center;">L'équipe ZONITE</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[send-verification-email] Resend error:', error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[send-verification-email] Sent successfully:', data);
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[send-verification-email] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});