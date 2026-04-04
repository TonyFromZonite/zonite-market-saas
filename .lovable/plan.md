

# Plan d'audit complet — Pré-publication

Checklist exhaustive de toutes les fonctionnalités à tester manuellement avant publication.

---

## 1. Authentification & Sessions

| # | Test | Comment vérifier |
|---|------|-----------------|
| 1.1 | Connexion vendeur (email + mot de passe) | Se connecter, vérifier redirection vers EspaceVendeur |
| 1.2 | Connexion vendeur par nom d'utilisateur | Utiliser le @username au lieu de l'email |
| 1.3 | Connexion admin (email + mot de passe) | Se connecter, vérifier redirection vers TableauDeBord |
| 1.4 | Connexion sous-admin | Se connecter, vérifier accès limité aux modules autorisés |
| 1.5 | Mot de passe oublié | Cliquer "Mot de passe oublié", vérifier réception email |
| 1.6 | Réinitialisation mot de passe (page ResetPassword) | Suivre le lien email, changer le mot de passe |
| 1.7 | Déconnexion vendeur | Bouton déconnexion, vérifier suppression session |
| 1.8 | Déconnexion admin | Idem côté admin |
| 1.9 | Session persistante après refresh | Recharger la page, vérifier qu'on reste connecté |
| 1.10 | Accès page protégée sans session → redirection Connexion | Ouvrir /EspaceVendeur sans être connecté |

## 2. Inscription vendeur

| # | Test |
|---|------|
| 2.1 | Inscription avec les 4 champs (Nom, @username, Email, Mot de passe) |
| 2.2 | Vérification email (code OTP à 6 chiffres) |
| 2.3 | Username unique — erreur si déjà pris |
| 2.4 | Email unique — erreur si déjà utilisé |
| 2.5 | Inscription avec code de parrainage valide (via URL `?ref=CODE` ou saisie manuelle) |
| 2.6 | Inscription avec code de parrainage invalide → message d'erreur |
| 2.7 | Nouveau vendeur a `statut_kyc = non_soumis` (pas d'apparition dans KYC admin) |
| 2.8 | Barre de navigation absente sur la page d'inscription |
| 2.9 | Page EnAttenteValidation — barre de navigation absente |

## 3. Parrainage

| # | Test |
|---|------|
| 3.1 | Le parrain voit son filleul dans la section Parrainage (EspaceVendeur) |
| 3.2 | Le filleul voit son parrain dans son profil |
| 3.3 | Notification envoyée au parrain quand un filleul s'inscrit |
| 3.4 | Code de parrainage unique généré pour chaque vendeur |
| 3.5 | Lien de parrainage partageable (WhatsApp, copier) |

## 4. Onboarding vendeur

| # | Test |
|---|------|
| 4.1 | Wizard de bienvenue (3 étapes) s'affiche à la première connexion |
| 4.2 | Wizard ne se ré-affiche pas après complétion |
| 4.3 | Progression du profil (badge, pourcentage) visible |
| 4.4 | Badge vendeur (Nouveau → Diamant) correct selon les ventes |

## 5. Formation & Catalogue

| # | Test |
|---|------|
| 5.1 | Page VideoFormation — vidéos YouTube s'affichent |
| 5.2 | Compléter la formation débloque le catalogue |
| 5.3 | Catalogue bloqué si formation non terminée |
| 5.4 | CatalogueVendeur — navigation par catégorie |
| 5.5 | ProduitDetail — affichage images, prix, description, variations |
| 5.6 | Bouton partage produit (WhatsApp) fonctionne |

## 6. KYC

| # | Test |
|---|------|
| 6.1 | Soumission KYC type CNI (recto + verso + selfie) |
| 6.2 | Soumission KYC type Passeport (photo + selfie) |
| 6.3 | Blocage soumission si documents manquants |
| 6.4 | Admin voit les dossiers KYC "en_attente" uniquement quand soumis |
| 6.5 | Admin approuve → statut_kyc = valide |
| 6.6 | Admin rejette → statut_kyc = rejete + raison |
| 6.7 | Vendeur reçoit notification KYC approuvé/rejeté |
| 6.8 | Ressoumission KYC après rejet (page ResoumissionKYC) |
| 6.9 | Email envoyé au vendeur lors approbation/rejet KYC |

## 7. Commandes vendeur

| # | Test |
|---|------|
| 7.1 | NouvelleCommandeVendeur — ville en texte libre avec suggestions |
| 7.2 | Quartier en texte libre avec suggestions |
| 7.3 | Estimation livraison affichée (fourchette min-max ou 1 500 FCFA par défaut) |
| 7.4 | Pas de sélection de coursier côté vendeur |
| 7.5 | Validation stock par ville (pas par coursier) |
| 7.6 | Commande créée avec statut `en_attente_validation_admin` |
| 7.7 | Référence commande générée automatiquement |
| 7.8 | MesCommandesVendeur — liste des commandes du vendeur |
| 7.9 | Filtrage par statut fonctionne |
| 7.10 | Détail commande accessible |

## 8. Gestion commandes (Admin)

| # | Test |
|---|------|
| 8.1 | GestionCommandes — liste toutes les commandes |
| 8.2 | Validation admin → statut `validee_admin` |
| 8.3 | Attribution coursier — filtrage par zone/quartier en priorité |
| 8.4 | Attribution coursier — fallback par ville puis tous |
| 8.5 | Passage en livraison → statut `en_livraison` |
| 8.6 | Livraison confirmée → statut `livree` + commission créditée |
| 8.7 | Annulation commande → stock restauré |
| 8.8 | Notification vendeur à chaque changement de statut |
| 8.9 | Email envoyé au vendeur lors changement statut |

## 9. Produits (Admin)

| # | Test |
|---|------|
| 9.1 | Produits — liste avec recherche et filtres |
| 9.2 | Ajout produit (nom, prix, images, catégorie, variations) |
| 9.3 | Modification produit |
| 9.4 | Activation/désactivation produit |
| 9.5 | Stock global et stock par coursier |
| 9.6 | Alerte stock critique (seuil) |
| 9.7 | Catégories — CRUD catégories |

## 10. Coursiers & Zones (Admin)

| # | Test |
|---|------|
| 10.1 | GestionCoursiers — ajout coursier (nom, téléphone, ville, zones) |
| 10.2 | Attribution zones de livraison à un coursier |
| 10.3 | Activation/désactivation coursier |
| 10.4 | GestionZones — liste zones de livraison par ville |
| 10.5 | Zones avec quartiers associés |
| 10.6 | Ajout/modification zone |

## 11. Commissions & Paiements

| # | Test |
|---|------|
| 11.1 | Commission créditée automatiquement à la livraison |
| 11.2 | Solde commission visible dans EspaceVendeur |
| 11.3 | DemandePaiement — soumission (montant, Mobile Money) |
| 11.4 | KYC requis pour demander un paiement |
| 11.5 | PaiementsVendeurs (admin) — liste demandes |
| 11.6 | Approbation paiement → solde débité |
| 11.7 | Rejet paiement → solde restauré |
| 11.8 | Historique paiements visible côté vendeur |

## 12. Retours

| # | Test |
|---|------|
| 12.1 | RetoursAdmin — liste retours |
| 12.2 | Traitement retour → impact commission |
| 12.3 | Stock restauré après retour accepté |

## 13. Support

| # | Test |
|---|------|
| 13.1 | AideVendeur — FAQ affichée |
| 13.2 | Création ticket support (sujet, message, catégorie) |
| 13.3 | SupportAdmin — liste tickets, réponse admin |
| 13.4 | Notification vendeur quand réponse reçue |

## 14. Notifications

| # | Test |
|---|------|
| 14.1 | NotificationsVendeur — liste notifications non lues |
| 14.2 | Marquage notification comme lue |
| 14.3 | Badge compteur notifications dans la nav |
| 14.4 | Notifications admin (NotificationCenter) |
| 14.5 | Notification parrainage (nouveau filleul) |

## 15. Profil vendeur

| # | Test |
|---|------|
| 15.1 | ProfilVendeur — affichage infos personnelles |
| 15.2 | Modification profil (téléphone, ville, quartier, photo) |
| 15.3 | Informations Mobile Money modifiables |
| 15.4 | Section parrain visible |

## 16. Dashboard admin (TableauDeBord)

| # | Test |
|---|------|
| 16.1 | Statistiques du jour (commandes, CA, commissions) |
| 16.2 | Graphique des ventes |
| 16.3 | Top produits |
| 16.4 | Top vendeurs |
| 16.5 | Stock critique affiché |
| 16.6 | Badge KYC en attente (compteur) |

## 17. Sous-admins

| # | Test |
|---|------|
| 17.1 | GestionSousAdmins — ajout sous-admin (depuis vendeur existant) |
| 17.2 | Attribution permissions modulaires |
| 17.3 | Sous-admin ne voit que les modules autorisés |
| 17.4 | Accès direct par URL à module non autorisé → écran de verrouillage |
| 17.5 | Journal audit — tentative d'accès non autorisé loguée |

## 18. Configuration

| # | Test |
|---|------|
| 18.1 | ConfigurationApp — modification paramètres (taux commission, etc.) |
| 18.2 | ConfigurationAdminPassword — changement mot de passe admin |

## 19. Rapports

| # | Test |
|---|------|
| 19.1 | RapportsVentes — statistiques par période |
| 19.2 | Onglet ventes par vendeur |
| 19.3 | JournalAudit — historique actions admin |

## 20. Ventes directes (Admin)

| # | Test |
|---|------|
| 20.1 | NouvelleVente — formulaire de vente directe |
| 20.2 | Sélection localisation (SelecteurLocalisation) |
| 20.3 | Stock décrémenté après vente |

## 21. Sécurité

| # | Test |
|---|------|
| 21.1 | Verrou biométrique (BiometricLock) si activé |
| 21.2 | AppLockScreen — déverrouillage correct |
| 21.3 | Sessions admin/vendeur ne se mélangent pas |
| 21.4 | RLS — un vendeur ne peut pas voir les données d'un autre |

## 22. PWA & Mobile

| # | Test |
|---|------|
| 22.1 | InstallPrompt — bannière d'installation s'affiche |
| 22.2 | Application fonctionne hors ligne (cache) |
| 22.3 | Pull-to-refresh fonctionne sur mobile |
| 22.4 | Navigation bottom bar vendeur responsive |
| 22.5 | Toutes les pages s'affichent correctement sur mobile (907px) |

## 23. Emails

| # | Test |
|---|------|
| 23.1 | Email de vérification envoyé à l'inscription |
| 23.2 | Email changement statut commande |
| 23.3 | Email KYC approuvé / rejeté |
| 23.4 | Queue d'emails (process-email-queue) fonctionne |

---

## Ordre recommandé de test

1. **Inscription** (2.1 → 2.9) puis **Connexion** (1.1 → 1.10)
2. **Parrainage** (3.1 → 3.5) — inscrire un 2e compte avec code
3. **Onboarding** (4.1 → 4.4) puis **Formation** (5.1 → 5.3)
4. **Catalogue** (5.4 → 5.6) puis **Commande vendeur** (7.1 → 7.10)
5. **Admin** : Commandes (8), Produits (9), Coursiers (10)
6. **Finances** : Commissions (11), Retours (12)
7. **Support** (13), **Notifications** (14), **Profil** (15)
8. **Dashboard** (16), **Sous-admins** (17), **Config** (18), **Rapports** (19)
9. **Sécurité** (21), **PWA/Mobile** (22), **Emails** (23)

Cela couvre **~100 points de vérification** sur les 23 modules de l'application.

