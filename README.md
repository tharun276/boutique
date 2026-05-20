# Gestion Beaute

Application locale pour gerer une petite vente de produits de beaute.

## Ouvrir

Double-clique sur `index.html`.

## Comptes de depart

- Patron: identifiant `patron`, mot de passe `1234`.
- Livreur: identifiant `livreur`, mot de passe `1234`.

Le patron peut creer, modifier et supprimer les comptes depuis l'onglet `Comptes`.

Si la connexion ne marche plus, clique sur `Reinitialiser les acces` sur l'ecran de connexion. Cela remet seulement les comptes de base, sans supprimer les ventes, clients ou produits.

## Ce qui est inclus

- Connexion patron et connexion livreur.
- Espace patron avec tous les onglets de gestion.
- Espace livreur avec uniquement ses livraisons, le montant a encaisser, son gain et le bouton pour marquer une livraison terminee.
- Onglet `Ventes` avec toutes les ventes, les infos client, les produits, le total, le cout, le livreur et le benefice.
- Historique client: clique sur le nom d'un client pour voir tout ce qu'il a achete depuis le debut.
- Produits avec stock, prix d'achat, prix de vente, promo et duree d'utilisation.
- Clients avec numero, adresse et note.
- Vente avec plusieurs produits pour le meme client.
- Calcul automatique du total, des promos, du cout produit, du livreur et du benefice.
- Livraison: 2 EUR par produit livre, retire du benefice.
- Rappels de fin d'utilisation avec message WhatsApp prepare.
- Message livreur WhatsApp prepare avec adresse, produits et gain.
- Export/import JSON pour garder une sauvegarde.

## Promotions et anciennes ventes

Une vente garde le prix du jour de la vente. Si tu modifies une promotion ou le prix d'un produit plus tard, les anciennes ventes ne changent pas.

## Important pour les messages automatiques

Les liens WhatsApp ouvrent un message deja prepare. Pour envoyer automatiquement sans cliquer, il faut connecter une vraie API comme WhatsApp Business Cloud API, Twilio SMS ou Brevo, avec l'accord des clients. Cette partie demande des identifiants API et un petit backend.

## Important pour plusieurs telephones

Cette version sauvegarde les donnees dans le navigateur de l'ordinateur. Pour que toi et les livreurs puissiez vous connecter chacun depuis votre telephone avec les memes donnees en temps reel, il faudra ajouter une base de donnees et un backend.
