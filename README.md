# AskInkAI

> Pose tes questions à Claude en dessinant les lettres. Sans parler. Sans clavier.

**[→ Démo live](https://loursbrun.github.io/AskInkAI/)**

AskInkAI est une webapp qui permet de dialoguer avec l'IA Claude en dessinant les lettres à la main sur un écran tactile. Chaque lettre dessinée est reconnue et ajoutée à la question. L'utilisateur envoie ensuite sa question et reçoit une réponse lisible et écoutable.

---

## Architecture

```
AskInkAI/
├── spike/          Frontend React + TypeScript (Vite)
└── server/         Backend Express + TypeScript (SQLite)
```

Le frontend est déployé sur GitHub Pages. Le backend doit être hébergé séparément (Railway, Render, Fly.io…).

---

## Installation et lancement

### 1. Backend

```bash
cd server
npm install

# Copier et remplir les variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (voir section Variables d'environnement)

# Démarrage en développement
npm run dev
```

### 2. Frontend

```bash
cd spike
npm install

# En développement : le proxy Vite redirige /api → http://localhost:3001
npm run dev
```

Ouvrir `http://localhost:5173/AskInkAI/`

### 3. Build production

```bash
cd spike
npm run build
# Les fichiers sont dans spike/dist/
```

---

## Variables d'environnement

### `server/.env`

| Variable | Description | Exemple |
|---|---|---|
| `ENCRYPTION_KEY` | Clé AES-256 (64 hex) pour chiffrer les clés API | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_SECRET` | Secret JWT pour les cookies de session | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `FRONTEND_URL` | URL du frontend (CORS) | `http://localhost:5173` |
| `PORT` | Port d'écoute | `3001` |
| `CLAUDE_MODEL` | Modèle Claude | `claude-haiku-4-5-20251001` |
| `NODE_ENV` | Environnement | `development` |

### `spike/.env.local` (optionnel, production)

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL du backend en production (ex: `https://api.askink.example.com`) |

---

## Flux sécurisé de la clé API Claude

```
Utilisateur saisit la clé API dans le formulaire
         ↓
Frontend envoie la clé via HTTPS (POST /api/key)
         ↓
Backend chiffre avec AES-256-GCM (ENCRYPTION_KEY)
         ↓
Clé chiffrée stockée en base SQLite
         ↓
Seul un masque est renvoyé au frontend : "sk-ant-api0...abcd"
         ↓
Lors d'un appel à Claude (POST /api/ask) :
  - Backend récupère la clé chiffrée
  - Déchiffre temporairement en mémoire
  - Appelle l'API Anthropic côté serveur
  - Renvoie uniquement la réponse texte
  - La clé n'apparaît jamais dans les logs ni dans la réponse
```

---

## Parcours utilisateur

1. **Inscription / Connexion** — email + mot de passe (hash bcrypt)
2. **Configuration clé API** — saisie une fois, chiffrée côté serveur
3. **Entraînement** — dessiner chaque lettre 5 fois pour personnaliser la reconnaissance
4. **Reconnaissance** — dessiner des lettres → elles s'accumulent dans le champ texte
5. **Envoi à Claude** — cliquer "Envoyer" → réponse dans une modale + lecture audio automatique
6. **Contrôles audio** — barre en bas avec Play/Pause/Recommencer

---

## Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| Canvas de dessin | Grande zone tactile pour dessiner une lettre à la fois |
| Reconnaissance DBPathRecognizer | DTW sur séquences directionnelles, personnalisé par utilisateur |
| Geste espace | Trait horizontal gauche → droite |
| Geste suppression | Trait horizontal droite → gauche |
| Feedback vocal par lettre | L'app énonce chaque lettre reconnue |
| Authentification | Email + mot de passe, session JWT httpOnly |
| Clé API chiffrée | AES-256-GCM côté serveur, jamais exposée |
| Envoi à Claude | Proxy backend sécurisé |
| Réponse en modale | Texte complet lisible + bouton Copier |
| Lecture audio | Web Speech API, contrôles Play/Pause/Restart |

---

## Sécurité

- Mots de passe hashés avec **bcrypt** (12 rounds)
- Sessions **JWT httpOnly** (cookie non accessible au JS)
- Clés API chiffrées **AES-256-GCM** avec IV aléatoire
- Clé de chiffrement uniquement en **variable d'environnement serveur**
- La clé API n'est **jamais loggée** ni renvoyée au frontend
- CORS restreint à l'URL frontend configurée
- Cookies `sameSite: strict` en développement, `none + secure` en production HTTPS

---

## Déploiement backend (exemple Railway)

1. Pousser le dossier `server/` sur un dépôt ou connecter Railway à ce repo
2. Configurer les variables d'environnement dans le dashboard Railway
3. Mettre `FRONTEND_URL` à l'URL GitHub Pages
4. Mettre `NODE_ENV=production`
5. Mettre `VITE_API_URL` dans les secrets GitHub Actions pour le build frontend

---

## Documentation technique

- [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

---

## Licence

Projet privé — MVP personnel.
