Le lien Webmail LWS qui ne s’ouvre pas n’est probablement pas lié à l’app ZONITE ni au domaine d’envoi `notify.zonite.org` : celui-ci est bien vérifié. Le souci est plutôt côté LWS / DNS mail du sous-domaine utilisé par leur bouton.

Plan d’action recommandé :

1. Depuis LWS, faire clic droit sur le bouton ou lien Webmail puis copier l’adresse du lien.
2. Me coller ici l’URL exacte copiée, sans mot de passe ni information sensible.
3. Je vérifierai si le lien pointe vers `mail.zonite.org`, `webmail.zonite.org`, une URL LWS/Roundcube, ou une URL cassée.
4. Selon le cas :
   - si c’est `mail.zonite.org` ou `webmail.zonite.org`, il faudra corriger les DNS chez le gestionnaire du domaine ;
   - si c’est une URL LWS, il faudra plutôt tester blocage navigateur/session/pop-up ou ouvrir en navigation privée ;
   - si le lien est vide ou invalide, il faudra régénérer/réinitialiser l’accès webmail côté LWS.

À faire maintenant : copie-colle uniquement l’adresse du lien Webmail que LWS ouvre quand tu cliques dessus.