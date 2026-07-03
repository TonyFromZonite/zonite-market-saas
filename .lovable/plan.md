## Diagnostic

Preuves DB :
- `notifications_admin` : dernière ligne = **2026‑06‑24 20:47** (0 nouvelle en 9 jours).
- `notifications_vendeur` : dernière ligne = **2026‑07‑03**, 152 non‑lues → le flux vendeur fonctionne.

Cause : la migration `20260624212709` a supprimé la policy `Authenticated insert admin notifs` sur `notifications_admin` (durcissement sécurité anti‑spam de la boîte admin, gardé par l’event trigger `guard_no_audit_notif_insert_leak`, cf. audit‑31). Depuis, tous les `supabase.from("notifications_admin").insert(...)` déclenchés côté vendeur sont **rejetés silencieusement par RLS**, donc l’admin ne reçoit plus rien.

Fichiers concernés (insertions client aujourd’hui bloquées) :
- `src/pages/NouvelleVente.jsx`
- `src/pages/NouvelleCommandeVendeur.jsx`
- `src/pages/DemandePaiement.jsx`
- `src/pages/AideVendeur.jsx`
- `src/pages/ResoumissionKYC.jsx`
- `src/pages/SupportAdmin.jsx` (admin qui répond à un ticket — écrit dans `notifications_admin` type `support` : admin sessions étant custom localStorage, `auth.uid()` peut ne pas être admin ; à passer par la RPC aussi).

Côté vendeur, le flux est OK (policy `Authenticated insert vendor notifs` toujours en place, temps réel activé, invalidation `["notifications_vendeur"]` propage bien vers la cloche). Aucune modification côté vendeur n’est nécessaire — si un cas précis subsiste, on l’adressera après vérif logs.

## Correctif

1) **Nouvelle migration** créant une fonction SECURITY DEFINER whitelistée par la sentinelle (elle contourne RLS sans nécessiter de policy permissive) :

```sql
CREATE OR REPLACE FUNCTION public.create_admin_notification(
  p_type text,
  p_titre text,
  p_message text,
  p_reference_id uuid DEFAULT NULL,
  p_vendeur_email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'auth required' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('kyc','support','commande','paiement','vendeur','info') THEN
    RAISE EXCEPTION 'invalid type' USING ERRCODE = '22023';
  END IF;
  -- Petit garde-fou anti-spam : max 20 inserts / 5 min / utilisateur
  IF (SELECT count(*) FROM public.notifications_admin
       WHERE created_at > now() - interval '5 minutes'
         AND vendeur_email = COALESCE(p_vendeur_email, (SELECT email FROM public.sellers WHERE user_id = v_uid LIMIT 1))
     ) > 20 THEN
    RAISE EXCEPTION 'rate limit' USING ERRCODE = '54000';
  END IF;
  INSERT INTO public.notifications_admin (type, titre, message, reference_id, vendeur_email, lu)
  VALUES (p_type, p_titre, p_message, p_reference_id, p_vendeur_email, false)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.create_admin_notification(text,text,text,uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_admin_notification(text,text,text,uuid,text) TO authenticated;
```

Aucune nouvelle policy sur `notifications_admin` → la sentinelle audit‑31 reste satisfaite.

2) **Remplacement des inserts client** dans les 6 fichiers listés :

```js
// avant
await supabase.from("notifications_admin").insert({ type, titre, message, reference_id, vendeur_email });
// après
await supabase.rpc("create_admin_notification", {
  p_type: type, p_titre: titre, p_message: message,
  p_reference_id: reference_id ?? null, p_vendeur_email: vendeur_email ?? null,
});
```

3) **Vérification** :
- exécuter la migration → `SELECT count(*) FROM notifications_admin WHERE created_at > now() - interval '1 minute'` après un test d’AideVendeur / DemandePaiement en preview.
- Ouvrir la cloche admin : l’invalidation `["notifications_admin"]` via Realtime + polling 15 s la rafraîchira automatiquement.
- `bun run vitest run src/test/audit-31-policies-insert-audit-notif.test.ts` doit toujours passer (aucune policy INSERT ajoutée).

## Hors périmètre

- Pas de refactor de `NotificationCenter` / `NotificationManager` / `notificationSystem.js`.
- Pas de changement RLS côté `notifications_vendeur`.
- Si après ce fix le côté vendeur reste anormal, on ouvrira un second ticket avec logs précis (page, symptôme).