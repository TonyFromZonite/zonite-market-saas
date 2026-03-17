

## Plan: Fix KYC Emails, Support Tickets & Notifications

### Issues Found

1. **KYC approved email**: `send-kyc-approved-email` expects `{ email, nom }` but `GestionKYC.jsx` (line 62) sends `{ email, full_name }` — the `nom` variable is `undefined` in the email template.

2. **KYC rejected email**: `send-kyc-rejected-email` expects `{ email, nom, raison }` but `GestionKYC.jsx` (line 68) sends `{ email, full_name, raison }` — same issue, `nom` is `undefined`.

3. **NotificationCenterVendeur.jsx**: Still uses `base44` API and queries by `destinataire_email` which doesn't exist in `notifications_vendeur` table. Console is flooded with errors. Needs migration to Supabase, querying by `vendeur_id` (from the current user's seller record).

4. **NotificationBell.jsx**: Still uses `base44` API entirely. Needs migration to Supabase.

5. **SupportAdmin.jsx**: Uses `base44` for tickets listing, FAQ, and notifications. Also calls missing `adminApi` functions: `updateTicketSupport`, `updateNotificationVendeur`, `createFaqItem`, `updateFaqItem`, `deleteFaqItem`. These functions don't exist in `adminApi.jsx`.

6. **SupportAdmin ticket response** (line 145): `adminApi.createNotificationVendeur` uses `vendeur_email` as fallback for `vendeur_id` — this inserts a string email into a UUID column, causing insert failures. Need to look up the seller's UUID first.

### Fix Plan

#### Fix 1 — KYC email field names (`GestionKYC.jsx`)
- Line 62: Change `full_name` to `nom` in the approved email payload
- Line 68: Change `full_name` to `nom` in the rejected email payload

#### Fix 2 — Add missing adminApi functions (`adminApi.jsx`)
Add these functions:
- `updateTicketSupport(id, data)` — update `tickets_support`
- `updateNotificationVendeur(id, data)` — update `notifications_vendeur`  
- `createFaqItem(data)` — insert into `faq_items`
- `updateFaqItem(id, data)` — update `faq_items`
- `deleteFaqItem(id)` — delete from `faq_items`

#### Fix 3 — Migrate SupportAdmin.jsx to Supabase
Replace `base44` calls:
- Tickets: `supabase.from('tickets_support').select('*').order('created_at', { ascending: false })`
- FAQ: `supabase.from('faq_items').select('*').order('ordre')`
- Notifications: `supabase.from('notifications_vendeur').select('*').order('created_at', { ascending: false })`
- Fix ticket response: look up `vendeur_id` from `sellers` table by email before creating notification

#### Fix 4 — Migrate NotificationCenterVendeur.jsx to Supabase
Replace `base44` calls with direct Supabase queries:
- Get current user via `supabase.auth.getUser()`
- Look up seller by `user_id`
- Query `notifications_vendeur` by `vendeur_id`
- Mark as read/delete via Supabase directly

#### Fix 5 — Migrate NotificationBell.jsx to Supabase
Replace all `base44` calls with Supabase queries. Use `supabase.auth.getUser()` for session, query by proper columns.

### Files to modify
1. `src/pages/GestionKYC.jsx` — Fix email payload field names
2. `src/components/adminApi.jsx` — Add 5 missing functions
3. `src/pages/SupportAdmin.jsx` — Migrate from base44 to Supabase
4. `src/components/NotificationCenterVendeur.jsx` — Migrate from base44 to Supabase
5. `src/components/NotificationBell.jsx` — Migrate from base44 to Supabase

