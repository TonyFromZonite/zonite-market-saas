
## Plan: Fix 4 Issues — Password, Username, Profile, KYC

### Analysis

**Critical finding**: `InscriptionVendeur.jsx`, `ProfilVendeur.jsx`, and `GestionKYC.jsx` all use the old `base44` API instead of Supabase. These need to be migrated for any fixes to work.

**DB field mismatch**: The registration form uses `photo_identite_url`/`selfie_url` but the `sellers` table has `kyc_document_recto_url`/`kyc_document_verso_url`/`kyc_selfie_url`. GestionKYC also references the old field names.

**Storage**: The `kyc-documents` bucket exists but has no RLS policies for admin read access.

---

### FIX 1 — Password Security

**InscriptionVendeur.jsx** (line 91-96): Strengthen password validation from 6 chars to:
- Min 8 characters
- At least 1 uppercase letter
- At least 1 digit
- Show inline validation errors before submit

No dashboard config needed — validation is client-side.

### FIX 2 — Username at Registration

**InscriptionVendeur.jsx**:
- Add `username` field to form state (line 28)
- Add username as FIRST field in Step 1 form (before line 323)
- Add debounced availability check (query `sellers` table by username)
- Show green checkmark / red X indicator
- Validation: `/^[a-z0-9_]{3,20}$/`
- Include `username` in the registration call

**Problem**: Registration currently goes through `base44.functions.invoke('registerVendeur')` which is the old API. Need to replace with direct Supabase auth signup + sellers insert:
1. `supabase.auth.signUp({ email, password, options: { data: { role: 'vendeur', full_name } } })`
2. Insert into `sellers` table with `user_id`, `email`, `full_name`, `username`, `telephone`
3. Send verification email via edge function

**Connexion.jsx**: Already handles username resolution (lines 62-81) — no changes needed.

**DB**: Set admin username via insert tool: `UPDATE sellers SET username = 'admin' WHERE email = 'tonykodjeu@gmail.com'`

### FIX 3 — Vendor Full Name in Profile

**ProfilVendeur.jsx** (line 36): Currently uses `base44.entities.Seller.filter()`. Replace with:
```js
const { data: seller } = await supabase
  .from('sellers')
  .select('*')
  .eq('user_id', session.user_id)
  .single();
```
The `full_name` column exists in DB. The display code (line 95-98) already references `nom_complet` which maps to the old Base44 field. Update to use `full_name` consistently, with fallback: `seller.full_name || 'Non renseigné'`.

### FIX 4 — KYC Documents in Admin

**GestionKYC.jsx**: Currently uses `base44.functions.invoke('getAllVendeurs')`. Replace with direct Supabase query:
```js
const { data } = await supabase.from('sellers').select('*');
```
Update image display to use correct DB column names: `kyc_document_recto_url`, `kyc_document_verso_url`, `kyc_selfie_url`.

**Storage RLS**: Add policy for admin read access on `kyc-documents` bucket via migration:
```sql
CREATE POLICY "admin_read_kyc" ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));
```

**InscriptionVendeur.jsx KYC submission** (step 4 / `soumettre`): Replace `base44` upload with Supabase Storage upload to `kyc-documents` bucket, then update `sellers` with the correct column names (`kyc_document_recto_url`, etc.).

**Admin notification**: Add notification insert when KYC is submitted.

---

### Files to modify:
1. **src/pages/InscriptionVendeur.jsx** — Migrate to Supabase, add username field, strengthen password validation, fix KYC upload
2. **src/pages/ProfilVendeur.jsx** — Migrate to Supabase, fix full_name display
3. **src/pages/GestionKYC.jsx** — Migrate to Supabase, fix KYC image column names
4. **src/pages/ResoumissionKYC.jsx** — Migrate to Supabase for uploads
5. **Migration SQL** — Storage RLS policy for kyc-documents
6. **Data update** — Set username='admin' for tonykodjeu@gmail.com
