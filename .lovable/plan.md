
## Objectif
Ajouter un bouton **« Copier les infos »** dans la modale de détail d'une commande (côté admin) pour que l'admin copie en un clic les informations clés à transmettre (ex. au coursier).

## Emplacement
`src/pages/CommandesVendeurs.jsx` — modale ouverte au clic sur l'icône œil (lignes 544-712).

## Format du texte copié
```
Commande : {produit_nom}

Nom : {client_nom}
Adresse : {client_ville}, {client_quartier} – {client_adresse}
Numéro : {client_telephone}
Montant total à payer : {prix_final_client + frais_livraison si livraison en sus, sinon prix_final_client} FCFA
Notes vendeur : {notes ou "—"}
```

Règle montant :
- Si `livraison_incluse = true` → montant = `prix_final_client` (les frais sont déjà inclus)
- Sinon → montant = `prix_final_client + frais_livraison`

## Implémentation
1. Bouton placé en haut de la modale (juste sous `DialogHeader`, à droite du badge statut) avec icône `Copy` (lucide-react) et libellé « Copier les infos ».
2. Handler `copierInfosCommande()` :
   - Construit la chaîne formatée ci-dessus
   - Utilise `navigator.clipboard.writeText(...)` avec fallback `document.execCommand("copy")` pour anciens navigateurs / contexte non-sécurisé
   - Toast de confirmation : « Informations copiées ✅ » (utilise `useToast` déjà importé dans le projet)
3. Aucun changement de logique métier ; aucun changement DB ; uniquement UI/presentation.

## Hors scope
- Pas de modification de la liste des commandes ni du flux de validation.
- Pas de changement sur la modale vendeur (`MesCommandesVendeur`).
