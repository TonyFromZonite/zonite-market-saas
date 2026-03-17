
## Plan: Fix verification code "undefined" bug

### Root Cause

Two bugs in `InscriptionVendeur.jsx`:

1. **No code generated**: The registration flow (line 216-222) calls the edge function without generating a 6-digit code or storing it in the `sellers` table (`email_verification_code` / `email_verification_expires_at` columns).

2. **Wrong field name**: The client sends `{ email, full_name }` but the edge function (`send-verification-email/index.ts` line 13) destructures `{ email, nom, code }`. So both `nom` and `code` are `undefined` in the email.

### Fix 1 — `src/pages/InscriptionVendeur.jsx` (registration flow, lines 215-222)

After inserting into sellers, **before** calling the edge function:
- Generate a 6-digit code: `Math.floor(100000 + Math.random() * 900000).toString()`
- Store it in sellers: `UPDATE sellers SET email_verification_code = code, email_verification_expires_at = NOW() + 24h WHERE id = sellerData.id`
- Pass correct fields to edge function: `{ email, nom: form.nom_complet, code: verificationCode }`

### Fix 2 — `src/pages/InscriptionVendeur.jsx` (resend code flow, lines 279-291)

Same bug in `renvoyerCode`: no code is generated. Fix:
- Generate a new 6-digit code
- Update sellers table with new code and new expiry
- Send `{ email: vendeurEmail, nom: form.nom_complet, code: newCode }` to edge function

### Files to modify
- `src/pages/InscriptionVendeur.jsx` — Two sections (registration + resend)

No edge function changes needed — it already handles `{ email, nom, code }` correctly.
