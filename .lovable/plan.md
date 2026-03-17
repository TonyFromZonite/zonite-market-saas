

## Plan: Fix AideVendeur.jsx — Migrate from base44 to Supabase

### Issues Found

**AideVendeur.jsx** is still entirely on the legacy `base44` API, causing multiple failures:

1. **Line 2**: Imports `base44` from legacy client
2. **Line 42**: `base44.entities.FaqItem.filter(...)` — FAQ query uses legacy API
3. **Lines 53-55**: `base44.auth.me()` and `base44.entities.Seller.filter(...)` — seller lookup uses legacy API
4. **Lines 61-63**: `base44.entities.TicketSupport.filter(...)` — tickets query uses legacy API
5. **Line 69-77**: `vendeurApi.createTicketSupport()` doesn't pass `vendeur_id` (only `vendeur_email` and `vendeur_nom`), but the Supabase `tickets_support` table requires `vendeur_id` (non-nullable UUID). This causes insert failures.
6. **Line 91**: `vendeurApi.marquerTicketLu(ticket.id)` — this function doesn't exist in `vendeurApi.jsx`

### Fix Plan

#### 1. `src/pages/AideVendeur.jsx` — Full migration to Supabase
- Remove `base44` import
- Replace `base44.auth.me()` + seller lookup with `supabase.auth.getUser()` + `supabase.from("sellers").select("*").eq("user_id", user.id).single()`
- Replace FAQ query with `supabase.from("faq_items").select("*").eq("actif", true).order("ordre")`
- Replace tickets query with `supabase.from("tickets_support").select("*").eq("vendeur_id", sellerId).order("created_at", { ascending: false })`
- Fix `soumettre()` to pass `vendeur_id: compteVendeur.id` to `vendeurApi.createTicketSupport()`
- Replace `vendeurApi.marquerTicketLu()` with direct Supabase call

#### 2. `src/components/vendeurApi.jsx` — Add missing function
- Add `marquerTicketLu(id)` — updates `tickets_support` set `lu_par_vendeur = true` where `id = id`

### Also creates admin notification on ticket creation
When a vendor creates a ticket, insert a notification into `notifications_admin` so admins see it.

### Files to modify
1. `src/pages/AideVendeur.jsx` — Migrate from base44 to Supabase
2. `src/components/vendeurApi.jsx` — Add `marquerTicketLu`

