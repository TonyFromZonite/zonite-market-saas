import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = claimsData.claims.sub as string
    const admin = createClient(supabaseUrl, serviceKey)

    // Locate seller row by user_id (fallback to email if missing)
    let { data: seller } = await admin
      .from('sellers')
      .select('id, user_id, email')
      .eq('user_id', userId)
      .maybeSingle()

    if (!seller) {
      const email = (claimsData.claims.email as string | undefined)?.toLowerCase()
      if (email) {
        const { data: byEmail } = await admin
          .from('sellers')
          .select('id, user_id, email')
          .eq('email', email)
          .maybeSingle()
        seller = byEmail
        if (seller && !seller.user_id) {
          await admin.from('sellers').update({ user_id: userId }).eq('id', seller.id)
        }
      }
    }

    if (!seller) {
      return new Response(JSON.stringify({ error: 'Seller not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: updated, error: updErr } = await admin
      .from('sellers')
      .update({
        training_completed: true,
        catalogue_debloque: true,
        conditions_acceptees: true,
        training_completed_at: new Date().toISOString(),
      })
      .eq('id', seller.id)
      .select('id, training_completed, catalogue_debloque, conditions_acceptees, training_completed_at')
      .single()

    if (updErr) {
      console.error('[complete-training] update error:', updErr)
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, seller: updated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[complete-training] exception:', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
