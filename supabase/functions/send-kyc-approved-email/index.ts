import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, nom } = await req.json();
    console.log(`[send-kyc-approved-email] Sending to ${email}`);

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
      subject: "🎉 Votre compte Zonite Market est activé !",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1f5e, #2d34a5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #F5C518; margin: 0; font-size: 28px;">Zonite Market</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 48px;">🎉</span>
            </div>
            <h2 style="color: #1E293B; text-align: center;">Félicitations ${nom} !</h2>
            <p style="color: #64748B; text-align: center;">Bienvenue sur Zonite Market ! Votre compte est maintenant <strong style="color: #10B981;">activé</strong>.</p>
            <p style="color: #64748B; text-align: center;">Vous pouvez dès maintenant accéder au catalogue et passer vos premières commandes.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://zonite.org/Connexion" style="background: #F5C518; color: #1a1f5e; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold;">Me connecter →</a>
            </div>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="color: #94A3B8; font-size: 12px; text-align: center;">L'équipe Zonite Market</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[send-kyc-approved-email] Resend error:', error);
      const isValidationError = error.name === 'validation_error' || error.statusCode === 403;
      return new Response(JSON.stringify({ 
        success: isValidationError, skipped: isValidationError,
        warning: isValidationError ? 'Domain not verified' : undefined,
        error: isValidationError ? undefined : error.message 
      }), {
        status: isValidationError ? 200 : 400,
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
