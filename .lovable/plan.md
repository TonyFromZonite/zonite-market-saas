

## Plan: Fix All RLS & Production Bugs

### Root Cause Analysis

I found **3 critical RLS policy bugs** that break core flows:

#### Bug 1 — Vendor registration fails on `sellers` INSERT
After `signUp`, the Supabase client may not have an active session yet (race condition or auto-confirm issue). The policy `auth.uid() IS NOT NULL` fails. **Fix**: After `signUp`, explicitly call `signInWithPassword` to guarantee a session before inserting into `sellers`.

#### Bug 2 — `user_roles` INSERT blocked for new vendors
Registration inserts into `user_roles`, but the only write policy is `Admins manage user_roles` (admin-only). New vendors can never insert their own role.
**Fix**: Add an INSERT policy allowing authenticated users to insert their own role: `auth.uid() = user_id`.

#### Bug 3 — `notifications_admin` INSERT blocked for vendors
Six pages (AideVendeur, InscriptionVendeur, ResoumissionKYC, NouvelleCommandeVendeur, DemandePaiement, SupportAdmin) try to insert into `notifications_admin` from vendor context. The only policy is `is_admin_or_sous_admin()` — vendors are blocked.
**Fix**: Add an INSERT policy allowing any authenticated user to insert notifications.

---

### SQL Migration (single migration)

```sql
-- Fix 1: Allow authenticated users to insert their own role
CREATE POLICY "Users insert own role"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix 2: Allow any authenticated user to create admin notifications
CREATE POLICY "Authenticated insert admin notifs"
ON public.notifications_admin FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
```

### Code Fix — `InscriptionVendeur.jsx`

After `signUp` succeeds, add an explicit `signInWithPassword` call before inserting into `sellers`:

```js
// After signUp succeeds:
await supabase.auth.signInWithPassword({
  email: form.email.trim().toLowerCase(),
  password: form.mot_de_passe,
});
// Now auth.uid() is guaranteed — proceed with sellers insert
```

### Files to modify
1. **SQL migration** — Add 2 new RLS policies (`user_roles` INSERT, `notifications_admin` INSERT)
2. **`src/pages/InscriptionVendeur.jsx`** — Add explicit sign-in after sign-up to guarantee session

### No other changes needed
- `tickets_support` INSERT policy already works for vendors
- `commandes_vendeur` INSERT policy already works for vendors
- `demandes_paiement_vendeur` INSERT policy already works for vendors
- Storage upload policies already allow authenticated users

