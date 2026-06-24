import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const BLOCKED_EMAIL_PATTERNS = ['tempmail', 'guerrillamail', 'throwaway', 'mailinator', 'yopmail', 'sharklasers'];
function isBlockedEmail(email: string): boolean {
  const lc = String(email || '').toLowerCase();
  return BLOCKED_EMAIL_PATTERNS.some((p) => lc.includes(p));
}

// Authorize: caller must be either an internal edge function (Authorization Bearer = service-role key)
// or an authenticated Supabase user. Returns the authenticated user id when applicable.
async function authorize(req: Request): Promise<
  { ok: true; isService: boolean; userId?: string } | { ok: false; status: number; msg: string }
> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, status: 401, msg: 'Missing Authorization' };
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && token === serviceKey) return { ok: true, isService: true };
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, msg: 'Invalid token' };
  return { ok: true, isService: false, userId: data.user.id };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const auth = await authorize(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.msg }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, nom, code } = await req.json();
    if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!code || !/^\d{4,8}$/.test(String(code))) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (isBlockedEmail(email)) {
      return new Response(JSON.stringify({ error: 'Email domain not allowed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If caller is a regular user (not service-role), enforce ownership: the target email
    // must match the caller's auth.users email or a seller row owned by them. Prevents using
    // this function as an arbitrary email relay.
    if (!auth.isService) {
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const targetEmail = String(email).toLowerCase().trim();
      const { data: userRes } = await admin.auth.admin.getUserById(auth.userId!);
      const callerEmail = (userRes?.user?.email || '').toLowerCase().trim();
      let ownsEmail = callerEmail && callerEmail === targetEmail;
      if (!ownsEmail) {
        const { data: seller } = await admin
          .from('sellers')
          .select('id')
          .eq('user_id', auth.userId)
          .eq('email', targetEmail)
          .maybeSingle();
        ownsEmail = !!seller;
      }
      if (!ownsEmail) {
        return new Response(JSON.stringify({ error: 'Forbidden: email does not belong to caller' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`[send-verification-email] Sending to ${email}`);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('[send-verification-email] RESEND_API_KEY not set, skipping send');
      return new Response(JSON.stringify({ success: true, skipped: true, message: 'No RESEND_API_KEY configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const safeNom = escapeHtml(nom || '');
    const safeCode = escapeHtml(code);

    const resend = new Resend(resendKey);
    const { data, error } = await resend.emails.send({
      from: 'Zonite Market <hello@zonite.org>',
      to: email,
      subject: "Zonite Market - Code de vérification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1a1f5e, #2d34a5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: #F5C518; margin: 0; font-size: 28px;">Zonite Market</h1>
            <p style="color: #CBD5E1; margin-top: 5px;">Plateforme de vente</p>
          </div>
          <div style="background: white; padding: 30px; border: 1px solid #E2E8F0; border-radius: 0 0 12px 12px;">
            <h2 style="color: #1E293B;">Bonjour ${safeNom} 👋</h2>
            <p style="color: #64748B;">Votre code de vérification est :</p>
            <div style="background: #F1F5F9; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a1f5e;">${safeCode}</span>
            </div>
            <p style="color: #64748B; font-size: 14px;">Ce code expire dans 24 heures.</p>
            <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 20px 0;">
            <p style="color: #94A3B8; font-size: 12px; text-align: center;">L'équipe Zonite Market</p>
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
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
