

## Diagnostic

**Database check**: The `villes_cameroun` table contains all 12 cities correctly. The `quartiers` table is **empty** (0 rows). So the data exists but something in the UI may be preventing proper interaction.

**UI issue identified**: The "Gestion des Quartiers" section at the bottom of GestionZones only renders cities that already have quartiers (`if (qs.length === 0) return null`). Since there are zero quartiers, it shows nothing -- making it look like there are no cities.

**Code review of GestionZones.jsx**: The quartier creation dialog and zone creation dialog both fetch villes correctly. The forms look structurally sound. The main problems are UX-related and potentially a missing "delete" RLS policy for quartiers (admins have ALL via `is_admin_or_sous_admin`, so that should work).

## Plan

### 1. Fix the "Gestion des Quartiers" section to always show all cities
Currently line 264 `if (qs.length === 0) return null;` hides cities with no quartiers. Change this to always show every active city, with a message "Aucun quartier" and a quick-add button when empty.

### 2. Improve the Quartier creation dialog
- Pre-select the ville when clicking "+ Ajouter un quartier" from within a city card
- Allow adding multiple quartiers in sequence without closing the dialog (add a "Ajouter un autre" button)
- Show a success feedback after each addition

### 3. Improve the Zone creation flow
- After selecting a ville with no quartiers, show a prominent call-to-action to create quartiers first
- Auto-refresh the quartier list in the zone dialog after adding a quartier inline

### 4. Verify integration with other features
- Ensure `NouvelleCommandeVendeur` correctly queries quartiers filtered by `ville_id`
- Ensure `GestionCoursiers` zone selection works with newly created zones
- Ensure the `zones_livraison.quartiers_ids` JSONB array properly stores and reads quartier UUIDs

### Files to modify
- **`src/pages/GestionZones.jsx`**: Fix quartier section to show all cities, improve inline add UX, fix dialog pre-selection
- No database changes needed (schema and data are correct)

