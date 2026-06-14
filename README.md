# AskInkAI

> Pose tes questions à Claude en dessinant les lettres. Sans parler. Sans clavier.

AskInkAI est une webapp qui permet de dialoguer avec l'IA Claude en dessinant les lettres à la main sur un écran tactile. Chaque lettre dessinée est reconnue et ajoutée à la question. L'utilisateur envoie ensuite sa question et reçoit une réponse lisible et écoutable.

---

## Vision

La plupart des interfaces IA reposent sur le clavier ou la voix. AskInkAI explore une troisième voie : **l'écriture silencieuse et gestuelle**. Elle est pensée pour les contextes où l'on ne peut ou ne veut pas parler, et où le clavier est inconfortable (mobilité, accessibilité, créativité).

---

## Fonctionnalités MVP

| Fonctionnalité | Description |
|---|---|
| Canvas de dessin | Grande zone tactile pour dessiner une lettre à la fois |
| Reconnaissance manuscrite | Lettre reconnue ajoutée automatiquement à la question |
| Geste espace | Trait horizontal gauche → droite : ajoute un espace |
| Geste suppression | Trait horizontal droite → gauche : supprime le dernier caractère |
| Feedback vocal | L'app énonce chaque lettre reconnue, espace, ou suppression |
| Champ question éditable | Affichage et édition manuelle de la question |
| Dictée vocale | Bouton micro pour saisir la question par la voix |
| Envoi à Claude | La question est envoyée à l'API Anthropic |
| Réponse affichée | La réponse de Claude est affichée clairement |
| Lecture vocale | La réponse peut être lue à voix haute |
| Longueur de réponse | Toggle 3 niveaux : très courte / moyenne / complète |
| Stockage clé API chiffré | Web Crypto AES-GCM + IndexedDB, jamais en clair |
| Déconnexion | Supprime toutes les données locales chiffrées |

---

## Stack technique

- **React 18** + **TypeScript**
- **Vite** (build tool)
- **Tailwind CSS** (styling responsive mobile-first)
- **Web Speech API** (dictée + lecture vocale)
- **Web Crypto API** + **IndexedDB** (stockage sécurisé clé API)
- **Anthropic API** (Claude)

---

## Lancer le projet

```bash
npm install
npm run dev
```

Ouvrir `http://localhost:5173`

---

## Sécurité — Avertissement important

> Cette application stocke la clé API Anthropic **chiffrée localement** dans le navigateur via Web Crypto API (AES-GCM) + IndexedDB.
>
> Cette approche est **acceptable pour un prototype personnel ou MVP local**, car elle évite le stockage en clair.
>
> **En production publique**, il ne faut JAMAIS exposer une clé API côté navigateur :
> - La clé doit rester côté serveur (backend)
> - L'utilisateur s'authentifie à l'app, pas à Anthropic directement
> - Le backend appelle Claude et retourne la réponse
> - Le navigateur ne voit jamais la clé API

---

## Documentation

- [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) — Spécifications produit complètes
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Architecture technique
- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) — Plan de développement MVP

---

## Licence

Projet privé — MVP personnel.
