# ARCHITECTURE.md — AskInkAI

## 1. Stack technique retenue

| Couche | Technologie | Justification |
|---|---|---|
| Framework UI | **React 18 + TypeScript** | Hooks natifs pour canvas/audio, typage strict pour crypto/API, écosystème large |
| Build | **Vite 5** | DX optimale, HMR instantané, zero-config pour React+TS |
| Styling | **Tailwind CSS v3** | Utility-first, responsive mobile-first natif, pas de runtime JS |
| State | **React Context + useReducer** | Suffisant pour MVP, pas de dépendance externe |
| Canvas | **Canvas API native** | Contrôle total des strokes, pas de lib intermédiaire |
| Voix (input) | **Web Speech API — SpeechRecognition** | Natif navigateur, zéro dépendance |
| Voix (output) | **Web Speech API — SpeechSynthesis** | Natif navigateur, zéro dépendance |
| Crypto | **Web Crypto API** | Natif, AES-GCM, disponible sur tous navigateurs modernes |
| Stockage | **IndexedDB** (via idb) | Stockage binaire, clés crypto non sérialisables en localStorage |
| API IA | **Anthropic SDK** (@anthropic-ai/sdk) | SDK officiel, typé |

### Alternatives écartées

| Alternative | Raison du rejet |
|---|---|
| Next.js | SSR inutile, complexité sans bénéfice pour MVP client-only |
| Vue / Svelte | Écosystème plus petit pour canvas + crypto + mobile |
| Redux / Zustand | Overkill pour le scope MVP |
| Fabric.js / Konva | Abstraction inutile, Canvas natif suffit |
| CryptoJS | Déprécié, pas CSPRNG, Web Crypto API préférable |
| localStorage seul | Stockage clé en clair, inacceptable |

---

## 2. Architecture des dossiers

```
AskInkAI/
├── public/
│   └── favicon.svg               # Logo SVG
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx     # Wrapper layout global responsive
│   │   │   └── TopBar.tsx        # Logo + input + micro + déconnexion
│   │   ├── canvas/
│   │   │   └── DrawingCanvas.tsx # Canvas + gestion strokes + gestures
│   │   ├── buttons/
│   │   │   ├── TriangleButton.tsx      # Composant bouton triangulaire réutilisable
│   │   │   ├── SendButton.tsx          # Coin bas-droite
│   │   │   ├── ClearButton.tsx         # Coin bas-gauche
│   │   │   ├── VoicePlayButton.tsx     # Coin haut-gauche
│   │   │   └── ResponseLengthButton.tsx # Coin haut-droite
│   │   ├── response/
│   │   │   └── ResponseArea.tsx  # Zone affichage réponse Claude
│   │   ├── modals/
│   │   │   └── ApiKeyModal.tsx   # Modal saisie clé API au premier lancement
│   │   └── ui/
│   │       ├── Logo.tsx          # SVG logo + nom app
│   │       └── MicButton.tsx     # Bouton micro dans TopBar
│   ├── services/
│   │   ├── secureApiKeyStorage.ts  # Web Crypto + IndexedDB (chiffrement AES-GCM)
│   │   ├── claudeClient.ts         # Appels API Anthropic + gestion longueur réponse
│   │   ├── handwritingRecognizer.ts # Interface reconnaissance + simulation MVP
│   │   ├── speechSynthesis.ts      # Feedback vocal (output)
│   │   └── speechRecognition.ts    # Dictée vocale (input)
│   ├── hooks/
│   │   ├── useCanvas.ts            # Logique canvas : dessin, strokes, effacement
│   │   ├── useGestureDetector.ts   # Analyse stroke → geste ou lettre
│   │   ├── useQuestion.ts          # État de la question (ajout/suppression/reset)
│   │   ├── useSpeechSynthesis.ts   # Hook feedback vocal
│   │   ├── useSpeechRecognition.ts # Hook dictée vocale
│   │   ├── useApiKey.ts            # Chargement/sauvegarde clé API chiffrée
│   │   └── useClaudeResponse.ts    # Appel Claude + états loading/error/response
│   ├── context/
│   │   └── AppContext.tsx          # Contexte global : question, réponse, config
│   ├── types/
│   │   └── index.ts                # Types TypeScript partagés
│   ├── utils/
│   │   ├── gestureAnalyzer.ts      # Algorithme d'analyse de stroke géométrique
│   │   └── constants.ts            # Constantes app (seuils gestes, niveaux réponse, etc.)
│   ├── App.tsx                     # Racine app, routing conditionnel (clé API présente ?)
│   ├── main.tsx                    # Point d'entrée React
│   └── index.css                   # Tailwind base + custom CSS variables
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── tsconfig.node.json
```

---

## 3. Architecture des composants

### Hiérarchie

```
App
├── ApiKeyModal          (si pas de clé)
└── AppLayout
    ├── TopBar
    │   ├── Logo
    │   ├── QuestionInput (champ éditable)
    │   ├── MicButton
    │   └── LogoutButton
    ├── CanvasZone
    │   ├── VoicePlayButton   (coin haut-gauche)
    │   ├── ResponseLengthButton (coin haut-droite)
    │   ├── DrawingCanvas     (centre)
    │   ├── ClearButton       (coin bas-gauche)
    │   └── SendButton        (coin bas-droite)
    └── ResponseArea
```

---

## 4. Flux de données

### Flux principal : dessin → question → réponse

```
[DrawingCanvas]
    │ stroke terminé
    ▼
[useGestureDetector]
    │ analyse géométrique
    ├── geste espace    → [useQuestion].addSpace()  → [useSpeechSynthesis].speak("espace")
    ├── geste suppression → [useQuestion].backspace() → [useSpeechSynthesis].speak("supprimé")
    └── lettre dessinée → [handwritingRecognizer].recognize(stroke)
                              │ lettre reconnue
                              ▼
                        [useQuestion].addLetter(letter)
                        [useSpeechSynthesis].speak(letter)
                        [DrawingCanvas].clear()

[SendButton] clic
    │
    ▼
[useClaudeResponse].sendQuestion(question, responseLength)
    │
    ▼
[claudeClient].ask(apiKey, question, lengthInstruction)
    │
    ▼
[ResponseArea] affiche réponse

[VoicePlayButton] clic
    │
    ▼
[useSpeechSynthesis].speak(response) / pause / resume
```

### Flux clé API

```
App mount
    │
    ▼
[useApiKey].hasApiKey()
    ├── false → affiche ApiKeyModal
    │               │ clé saisie + validée
    │               ▼
    │           [secureApiKeyStorage].saveApiKey(key)
    │               │ chiffrement AES-GCM
    │               ▼
    │           [IndexedDB] : {encryptedKey, iv, cryptoKey}
    │           App passe en mode "prêt"
    └── true  → [secureApiKeyStorage].getApiKey()
                    │ déchiffrement AES-GCM
                    ▼
                clé API en mémoire (jamais dans DOM/console)
```

---

## 5. Module secureApiKeyStorage

### Schéma de chiffrement

```
┌─────────────────────────────────────────────────────┐
│  Web Crypto API                                      │
│                                                      │
│  generateKey(AES-GCM, 256bit)  ──→  CryptoKey       │
│                                        │             │
│  encrypt(apiKey, CryptoKey, IV)  ──→  encrypted[]   │
│                                                      │
│  IndexedDB "askink-db"                               │
│  ├── store "crypto" : { cryptoKey: CryptoKey }      │
│  └── store "secrets" : { encryptedKey, iv }         │
└─────────────────────────────────────────────────────┘
```

### API publique

```typescript
saveApiKey(apiKey: string): Promise<void>
getApiKey(): Promise<string | null>
hasApiKey(): Promise<boolean>
deleteApiKey(): Promise<void>
clearApiSession(): Promise<void>
```

---

## 6. Module handwritingRecognizer

### Interface abstraite (pluggable)

```typescript
interface HandwritingRecognizer {
  recognize(stroke: StrokePoint[]): Promise<RecognitionResult>
}

interface RecognitionResult {
  type: 'letter' | 'gesture'
  value: string      // lettre ou 'space' | 'backspace'
  confidence: number // 0-1
}
```

### Implémentation MVP : SimulatedRecognizer

Algorithme simple basé sur les caractéristiques du stroke :
- Longueur totale du tracé
- Ratio largeur/hauteur du bounding box
- Nombre de changements de direction
- Durée du tracé

Retourne une lettre vraisemblable ou un geste.

### Future implémentation : TFJSRecognizer

À brancher via la même interface, utilisant TensorFlow.js EMNIST.

---

## 7. Module claudeClient

```typescript
interface ClaudeClientConfig {
  apiKey: string
  responseLength: ResponseLength  // 'short' | 'medium' | 'full'
}

async function askClaude(
  question: string,
  config: ClaudeClientConfig
): Promise<string>
```

Instructions système selon la longueur :

| Niveau | Instruction |
|---|---|
| short | "Réponds en 1 à 2 phrases maximum, de façon très concise." |
| medium | "Réponds de façon équilibrée, en quelques phrases claires." |
| full | "Réponds de façon détaillée et complète." |

---

## 8. Responsive layout

### Breakpoints (Tailwind)

| Breakpoint | Largeur | Layout |
|---|---|---|
| `sm` | < 640px | Mobile portrait — canvas full width, réponse en bas |
| `md` | 640-1024px | Tablette portrait — marges légères, canvas agrandi |
| `lg` | 1024-1280px | Tablette landscape — canvas 60%, réponse à droite |
| `xl` | > 1280px | Desktop — canvas centré, layout équilibré |

### Canvas dimensions

- Mobile : `min(90vw, 90vh * 0.55)`
- Tablette portrait : `min(80vw, 60vh)`
- Tablette paysage : `min(55vw, 80vh)`
- Desktop : `min(600px, 60vh)`

---

## 9. Sécurité

| Règle | Implémentation |
|---|---|
| Pas de clé en clair | Chiffrement AES-GCM avant tout stockage |
| Pas de log sensible | Aucun console.log sur apiKey, CryptoKey, encrypted |
| Pas de clé dans le DOM | Champ `type="password"`, jamais affiché après sauvegarde |
| Déchiffrement échoué | Purge automatique + retour à l'écran de saisie |
| Pas de clé dans les erreurs | Messages d'erreur génériques côté UI |

---

## 10. Dépendances npm prévues

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@anthropic-ai/sdk": "^0.27.0",
    "idb": "^8.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
```

### Pourquoi `idb` ?

La bibliothèque `idb` (3.4kb) est un wrapper Promise minimal sur IndexedDB. Elle permet de stocker des `CryptoKey` natives (non sérialisables) directement dans IndexedDB, ce que `localStorage` ne peut pas faire.
