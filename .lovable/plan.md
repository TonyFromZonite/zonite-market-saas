

## Plan: Fix Admin Notification Bell System

### Current State

There are **two** notification bell components:
1. **`NotificationCenter.jsx`** — vendor-only (queries `notifications_vendeur`), used in `AdminHeader.jsx` (line 61)
2. **`NotificationBell.jsx`** — dual-purpose (queries both tables), but **not used anywhere** in admin layout

The admin header currently renders `NotificationCenter` which only shows **vendor** notifications, not admin ones.

### Changes

#### 1. Rewrite `NotificationCenter.jsx` to be context-aware (admin vs vendor)

Detect if current user is admin (via `user_roles` table). If admin:
- Query `notifications_admin` instead of `notifications_vendeur`
- Show type icons (🎫 support, 📋 kyc, 🛒 commande, 💰 paiement, 👤 vendeur, ℹ️ info)
- On click: navigate to relevant page based on `type`
- "Mark all as read" marks all `notifications_admin` where `lu = false`
- Badge shows count up to 99+
- Realtime subscription on `notifications_admin` table (INSERT events)
- Show toast on new notification

If vendor (existing behavior): keep current logic unchanged.

#### 2. Add admin notification inserts for missing events

Currently only these insert into `notifications_admin`: KYC submission, KYC resubmission, support tickets, support ticket replies.

**Missing — add to `NouvelleCommandeVendeur.jsx`**: When vendor submits an order, insert notification with `type: 'commande'`.

**Missing — add to `DemandePaiement.jsx`**: When vendor requests payment, insert notification with `type: 'paiement'`.

#### 3. SQL migration: enable realtime for `commandes_vendeur` and `sellers`

`notifications_admin` and `tickets_support` already added to realtime publication. Add `commandes_vendeur` and `sellers`.

#### 4. Delete `NotificationBell.jsx` (unused duplicate)

### Files to modify
1. `src/components/NotificationCenter.jsx` — Rewrite with admin/vendor detection
2. `src/pages/NouvelleCommandeVendeur.jsx` — Add admin notification on order creation
3. `src/pages/DemandePaiement.jsx` — Add admin notification on payment request
4. `src/components/NotificationBell.jsx` — Delete (unused)
5. SQL migration — Enable realtime for additional tables

### Navigation mapping for admin notification clicks
- `type: 'kyc'` → `/GestionKYC`
- `type: 'support'` → `/SupportAdmin`
- `type: 'commande'` → `/Commandes`
- `type: 'paiement'` → `/PaiementsVendeurs`
- `type: 'vendeur'` → `/Vendeurs`

