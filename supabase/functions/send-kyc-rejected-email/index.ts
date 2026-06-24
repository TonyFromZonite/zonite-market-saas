import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function authorizeAdmin(req: Request): Promise<{ ok: boolean; status?: number; msg?: string }> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, msg: 'Missing Authorization' };
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) return { ok: true };
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, msg: 'Invalid token' };
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: isAdmin } = await admin.rpc('is_admin_or_sous_admin', { _user_id: data.user.id });
  if (!isAdmin) return { ok: false, status: 403, msg: 'Admin required' };
  return { ok: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.msg }), {
      status: auth.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, nom, raison } = await req.json();
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const safeRaison = String(raison || '').slice(0, 500);
    console.log(`[send-kyc-rejected-email] Sending to ${email}`);

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
      subject: "Zonite Market - KYC non validé",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1f5e, #2d34a5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #F5C518; margin: 0; font-size: 28px;">Zonite Market</h1>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1E293B;">Bonjour ${nom},</h2>
            <p style="color: #64748B;">Malheureusement, votre dossier KYC n'a pas été validé.</p>
            <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #991B1B; font-weight: bold; margin: 0 0 5px;">Raison du rejet :</p>
              <p style="color: #B91C1C; margin: 0;">${safeRaison}</p>
            </div>
            <p style="color: #64748B;">Vous pouvez resoumettre vos documents depuis votre espace vendeur.</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="color: #94A3B8; font-size: 12px; text-align: center;">L'équipe Zonite Market</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('[send-kyc-rejected-email] Resend error:', error);
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
