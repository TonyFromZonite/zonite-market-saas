

## Plan: Fix KYC validation — don't unlock catalogue

### Root Cause

In `src/pages/GestionKYC.jsx` line 46, when admin validates KYC:
```js
updates.seller_status = 'active_seller';
updates.catalogue_debloque = true;  // ← BUG: should NOT be set here
```

The catalogue should only be unlocked when the vendor completes training (handled in `VideoFormation.jsx`).

### Fix

**`src/pages/GestionKYC.jsx` (line 46)**: Remove `updates.catalogue_debloque = true;` from the KYC validation block. The seller becomes `active_seller` but `catalogue_debloque` stays `false` until training is completed.

### Files to modify
- `src/pages/GestionKYC.jsx` — Remove one line (line 46)

