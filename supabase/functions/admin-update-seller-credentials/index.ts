import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ONE_SHOT_TOKEN = 'ZONITE_ADMIN_UPDATE_2026_JosephPodka_ONESHOT';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    if (body?.token !== ONE_SHOT_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { seller_id, user_id, new_email, new_password } = body;
    if (!seller_id || !user_id || !new_email || !new_password) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1) Update auth.users
    const { error: authErr } = await admin.auth.admin.updateUserById(user_id, {
      email: new_email,
      password: new_password,
      email_confirm: true,
    });
    if (authErr) throw new Error(`auth update failed: ${authErr.message}`);

    // 2) Update sellers.email (service_role bypasses privileged trigger)
    const { error: sellErr } = await admin
      .from('sellers')
      .update({ email: new_email, email_verified: true })
      .eq('id', seller_id);
    if (sellErr) throw new Error(`sellers update failed: ${sellErr.message}`);

    // 3) Audit log
    await admin.from('journal_audit').insert({
      action: 'admin_update_seller_credentials',
      module: 'sellers',
      utilisateur: 'admin_oneshot',
      entite_type: 'sellers',
      entite_id: seller_id,
      details: { new_email, password_changed: true },
    });

    return new Response(JSON.stringify({ success: true, seller_id, user_id, new_email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
