

## Problem Diagnosis

The login fails because:

1. **No edge function exists.** Both vendor and admin login call `base44.functions.invoke('loginUser', ...)`, which falls through to a non-existent Supabase edge function, returning `{ success: false }` — hence the "Identifiants incorrects" error.

2. **The sellers table is completely empty.** There is no admin account, no vendor account — nothing in the database.

3. **No authentication system.** The app stores `password_hash` in the sellers table and uses sessionStorage for sessions — it's a custom auth system, not Supabase Auth. But the backend function to verify credentials doesn't exist.

## Plan

### Step 1: Create `loginUser` edge function
A backend function that:
- Receives `{ email, password, userType }`
- Queries the `sellers` table by email and role
- Compares password (using bcrypt hash stored in `password_hash`)
- Returns `{ success: true, session: { id, email, nom_complet, role, seller_status, permissions } }`
- For `sous_admin`, also fetches permissions from `sous_admins` table

### Step 2: Create `hash-password` edge function
Needed for registration and password management. Uses bcrypt to hash passwords.

### Step 3: Seed the admin account
Insert the admin record into the `sellers` table via a database migration:
- email: `tonykodjeu@gmail.com`
- password: bcrypt hash of `ZoniteAdmin2024!`
- role: `admin`
- nom_complet: `Serges Kodjeu`
- seller_status: `active`

### Step 4: Handle `loginUser` in base44Client.js
Instead of falling through to the edge function default case, add a dedicated `case 'loginUser'` in the `base44Client.js` switch that calls the edge function properly, with better error handling.

### Technical Details

**Edge function `loginUser/index.ts`:**
```
- Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS
- Queries sellers table by email
- Filters by role based on userType (admin/sous_admin for admin login, vendeur for vendor)
- Uses bcrypt to compare password_hash
- Returns session object with relevant fields
```

**Database migration:**
```sql
INSERT INTO sellers (email, nom_complet, role, seller_status, password_hash)
VALUES ('tonykodjeu@gmail.com', 'Serges Kodjeu', 'admin', 'active', '<bcrypt_hash>');
```

This will make both admin and vendor login functional.

