## Objectif
Sur la page ProfilVendeur, supprimer visuellement le badge de statut « ✓ Actif » lorsque le KYC a été validé et que le compte passe en `active_seller`, afin qu'aucun élément lié à la vérification ne reste affiché.

## Contexte actuel
Dans `src/pages/ProfilVendeur.jsx` (lignes ~323-326), le header affiche un badge coloré :
- `active_seller` → fond émeraude + texte « ✓ Actif »
- autres statuts → fond jaune + texte « En attente »

La bannière `BanniereKycPending` est déjà conditionnée à `seller_status === "kyc_pending"` et disparaît donc quand le KYC est validé. Seul le badge vert persiste.

## Changement prévu
Rendre le badge conditionnel : **ne pas l'afficher quand `seller_status === "active_seller"`**.
Pour les autres statuts (`kyc_pending`, `kyc_required`, etc.), le badge jaune « En attente » reste affiché (la bannière KYC continue de gérer l'appel à l'action).

```text
Avant :
<Badge className="...">
  {compteVendeur?.seller_status === "active_seller" ? "✓ Actif" : "En attente"}
</Badge>

Après :
{compteVendeur?.seller_status !== "active_seller" && (
  <Badge className="...">
    {compteVendeur?.seller_status === "active_seller" ? "✓ Actif" : "En attente"}
  </Badge>
)}
```

## Fichier concerné
- `src/pages/ProfilVendeur.jsx` uniquement.

## Vérification
1. Lancer le build/vite pour s'assurer qu'il n'y a pas d'erreur de syntaxe.
2. Vérifier visuellement que le badge vert n'apparaît plus pour un vendeur `active_seller`.

## Non concerné
- Pas de changement de backend, de statut, ni de logique KYC.
- Les autres pages vendeur restent inchangées.