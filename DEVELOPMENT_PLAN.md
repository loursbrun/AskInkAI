# DEVELOPMENT_PLAN.md — AskInkAI

## Vue d'ensemble

Le MVP est découpé en **13 étapes séquentielles**, chacune livrant un incrément fonctionnel testable. L'ordre respecte les dépendances : infrastructure → layout → interactions → services → sécurité → intégration.

---

## Étape 1 — Initialisation du projet

**Objectif** : Projet fonctionnel vide avec build qui tourne.

Fichiers créés :
- `package.json`
- `vite.config.ts`
- `tsconfig.json` + `tsconfig.node.json`
- `tailwind.config.js` + `postcss.config.js`
- `index.html`
- `src/main.tsx`
- `src/App.tsx` (placeholder)
- `src/index.css` (Tailwind directives + CSS variables)

Vérification : `npm run dev` → page blanche sans erreurs.

---

## Étape 2 — Layout global responsive

**Objectif** : Structure visuelle de l'app sur tous les breakpoints.

Fichiers créés :
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/TopBar.tsx` (placeholder)

Comportement :
- Zone TopBar fixe en haut
- Zone canvas centrale, qui prend l'espace disponible
- Zone réponse en bas (hauteur fixe sur mobile, flexible sur desktop)
- Sur tablette landscape : canvas à gauche, réponse à droite

Vérification : Redimensionner la fenêtre → layout s'adapte correctement.

---

## Étape 3 — Logo et TopBar

**Objectif** : Barre supérieure complète avec logo SVG.

Fichiers créés :
- `src/components/ui/Logo.tsx` — SVG "A" manuscrit stylisé
- `src/components/ui/MicButton.tsx` — bouton micro (placeholder)
- `src/types/index.ts` — types partagés initiaux

Comportement :
- Logo + "AskInkAI" à gauche
- Champ input éditable au centre (placeholder)
- Bouton micro à droite
- Bouton déconnexion discret à l'extrême droite

Vérification : TopBar visible et responsive sur mobile/tablette/desktop.

---

## Étape 4 — Canvas de dessin

**Objectif** : Canvas tactile fonctionnel, dessin fluide, effacement.

Fichiers créés :
- `src/components/canvas/DrawingCanvas.tsx`
- `src/hooks/useCanvas.ts`

Comportement :
- Dessin fluide au toucher et à la souris
- Trait lisse, anti-aliasé, épaisseur ~3px
- Capture des points du stroke avec timestamps
- Méthode `clear()` exposée
- Canvas redimensionné proprement au resize de la fenêtre

Vérification : Dessiner sur mobile et desktop → trait fluide, canvas occupe l'espace.

---

## Étape 5 — Détection de gestes et reconnaissance

**Objectif** : Analyser le stroke terminé → geste ou lettre simulée.

Fichiers créés :
- `src/utils/gestureAnalyzer.ts` — algorithme géométrique
- `src/utils/constants.ts` — seuils de détection
- `src/services/handwritingRecognizer.ts` — interface + SimulatedRecognizer
- `src/hooks/useGestureDetector.ts`

Algorithme de détection des gestes :
- Trait horizontal G→D : delta X > 40% largeur canvas, |delta Y| < 20% hauteur
- Trait horizontal D→G : même critères, direction inversée
- Sinon : reconnaître comme lettre (simulation)

Simulation de lettre :
- Analyse bounding box du stroke
- Hash des caractéristiques → index dans l'alphabet
- Retourne une lettre cohérente avec le tracé

Vérification : Console log des lettres et gestes reconnus lors du dessin.

---

## Étape 6 — État de la question

**Objectif** : Question construite lettre par lettre, synchronisée avec l'input.

Fichiers créés :
- `src/hooks/useQuestion.ts`
- `src/context/AppContext.tsx`

Fonctions :
- `addLetter(letter)` — ajoute une lettre
- `addSpace()` — ajoute un espace
- `backspace()` — supprime le dernier caractère
- `reset()` — efface toute la question
- `setQuestion(text)` — mise à jour depuis l'input clavier

Champ input dans TopBar :
- Éditable, synchronisé avec l'état
- Modification clavier reflétée dans l'état global

Vérification : Dessiner → lettres apparaissent dans le champ. Taper au clavier → mis à jour.

---

## Étape 7 — Feedback vocal

**Objectif** : L'app énonce chaque lettre reconnue, espace, suppression.

Fichiers créés :
- `src/services/speechSynthesis.ts`
- `src/hooks/useSpeechSynthesis.ts`

Comportement :
- Après reconnaissance d'une lettre : parle la lettre
- Après geste espace : dit "espace"
- Après geste suppression : dit "supprimé"
- Gestion du cas navigateur sans SpeechSynthesis (silencieux, pas d'erreur)
- Voix française si disponible

Vérification : Dessiner → entendre les lettres énoncées.

---

## Étape 8 — Boutons triangulaires

**Objectif** : Les 4 boutons de coin, visuels et fonctionnels.

Fichiers créés :
- `src/components/buttons/TriangleButton.tsx` — composant réutilisable
- `src/components/buttons/SendButton.tsx`
- `src/components/buttons/ClearButton.tsx`
- `src/components/buttons/VoicePlayButton.tsx`
- `src/components/buttons/ResponseLengthButton.tsx`

Design Triangle :
- CSS clip-path pour forme triangulaire
- Orienté vers le centre (rotation selon le coin)
- Hover/active states tactiles
- Grande zone de touch (minimum 64x64px de zone cliquable)
- Icône + label court

Comportements :
- **Clear** : appelle `useQuestion.reset()`
- **Send** : placeholder pour étape 11
- **Voice Play** : placeholder pour étape 10
- **Length** : cycle entre 3 états, état affiché visuellement

Vérification : Boutons visibles dans les 4 coins sur tous les formats. Clear fonctionne.

---

## Étape 9 — Dictée vocale (micro)

**Objectif** : Saisie vocale via le bouton micro dans la TopBar.

Fichiers créés :
- `src/services/speechRecognition.ts`
- `src/hooks/useSpeechRecognition.ts`

Comportement :
- Clic sur micro → démarre SpeechRecognition (continu)
- Bouton indique état actif (pulsation, couleur)
- Texte reconnu → `useQuestion.setQuestion(text)`
- Clic ailleurs → arrête la dictée
- Si SpeechRecognition non supporté → message discret dans la TopBar

Vérification : Parler → texte apparaît dans le champ. Cliquer ailleurs → s'arrête.

---

## Étape 10 — Lecture vocale de la réponse

**Objectif** : Lire la réponse de Claude à voix haute, play/pause.

Fichiers mis à jour :
- `src/components/buttons/VoicePlayButton.tsx`
- `src/hooks/useSpeechSynthesis.ts`

Comportement :
- VoicePlayButton affiche Play si pas de lecture
- Clic → commence la lecture de la réponse actuelle
- Clic pendant lecture → Pause
- Clic en pause → Reprend
- Fin de lecture automatique → retour à état Play
- Si aucune réponse : bouton désactivé

Vérification : Avoir une réponse simulée → play/pause fonctionnel.

---

## Étape 11 — Stockage sécurisé de la clé API

**Objectif** : Chiffrement AES-GCM, clé jamais en clair.

Fichiers créés :
- `src/services/secureApiKeyStorage.ts`
- `src/hooks/useApiKey.ts`
- `src/components/modals/ApiKeyModal.tsx`

Implémentation `secureApiKeyStorage.ts` :

```
1. openDB("askink-db") avec stores "crypto" et "secrets"
2. saveApiKey(key):
   - generateKey(AES-GCM, 256, extractable:false)
   - stocker CryptoKey dans store "crypto"
   - générer IV aléatoire (12 bytes)
   - chiffrer key en TextEncoder → ArrayBuffer
   - stocker {encryptedKey, iv} dans store "secrets"
3. getApiKey():
   - lire CryptoKey depuis "crypto"
   - lire {encryptedKey, iv} depuis "secrets"
   - decrypt → TextDecoder → string
   - si erreur → deleteApiKey() + return null
4. deleteApiKey():
   - vider les deux stores
5. hasApiKey():
   - vérifier présence dans "secrets"
```

Modal :
- S'affiche si `hasApiKey()` → false
- Champ password masqué
- Bouton sauvegarder
- Validation basique (commence par "sk-ant-")

Vérification : Saisir clé → rechargement → clé rechargée sans re-saisie. Clé absente de localStorage.

---

## Étape 12 — Intégration Claude API

**Objectif** : Envoi réel de la question à Claude, affichage de la réponse.

Fichiers créés :
- `src/services/claudeClient.ts`
- `src/hooks/useClaudeResponse.ts`
- `src/components/response/ResponseArea.tsx`

Comportement :
- SendButton → récupère apiKey + question + responseLength
- Appel `claudeClient.askClaude()`
- Modèle : `claude-sonnet-4-6` (ou `claude-haiku-4-5` pour rapidité MVP)
- Gestion états : idle / loading / success / error
- ResponseArea affiche la réponse avec animation fade-in
- Spinner discret pendant le chargement

Sécurité :
- apiKey jamais loggée
- Erreurs API : message générique affiché, pas de détail technique

Vérification : Dessiner une question, envoyer → réponse de Claude affichée.

---

## Étape 13 — Déconnexion et polish final

**Objectif** : Déconnexion propre + polish UX + vérifications finales.

Comportements déconnexion :
- Bouton dans TopBar → `clearApiSession()` → retour modal

Polish UX :
- Animations canvas (flash discret à la reconnaissance)
- Transitions douces entre états
- Empty states propres (réponse vide, question vide)
- Gestion erreur réseau
- Message si Web Speech non supporté
- Favicon SVG

Vérifications finales :
- Test sur iPhone (Safari)
- Test sur Android Chrome
- Test sur tablette
- Test sur desktop Firefox et Chrome
- Aucune clé en clair dans DevTools → Application → Storage
- Aucun log sensible dans la console

---

## Récapitulatif des fichiers

### Configuration (7 fichiers)
- `package.json`
- `vite.config.ts`
- `tsconfig.json`
- `tsconfig.node.json`
- `tailwind.config.js`
- `postcss.config.js`
- `index.html`

### Source (29 fichiers)
- `src/main.tsx`
- `src/App.tsx`
- `src/index.css`
- `src/types/index.ts`
- `src/utils/gestureAnalyzer.ts`
- `src/utils/constants.ts`
- `src/context/AppContext.tsx`
- `src/hooks/useCanvas.ts`
- `src/hooks/useGestureDetector.ts`
- `src/hooks/useQuestion.ts`
- `src/hooks/useSpeechSynthesis.ts`
- `src/hooks/useSpeechRecognition.ts`
- `src/hooks/useApiKey.ts`
- `src/hooks/useClaudeResponse.ts`
- `src/services/secureApiKeyStorage.ts`
- `src/services/claudeClient.ts`
- `src/services/handwritingRecognizer.ts`
- `src/services/speechSynthesis.ts`
- `src/services/speechRecognition.ts`
- `src/components/layout/AppLayout.tsx`
- `src/components/layout/TopBar.tsx`
- `src/components/ui/Logo.tsx`
- `src/components/ui/MicButton.tsx`
- `src/components/canvas/DrawingCanvas.tsx`
- `src/components/buttons/TriangleButton.tsx`
- `src/components/buttons/SendButton.tsx`
- `src/components/buttons/ClearButton.tsx`
- `src/components/buttons/VoicePlayButton.tsx`
- `src/components/buttons/ResponseLengthButton.tsx`
- `src/components/response/ResponseArea.tsx`
- `src/components/modals/ApiKeyModal.tsx`

### Documentation (4 fichiers)
- `README.md`
- `PRODUCT_REQUIREMENTS.md`
- `ARCHITECTURE.md`
- `DEVELOPMENT_PLAN.md`

**Total : ~40 fichiers**

---

## Estimation de durée

| Étape | Complexité | Estimation |
|---|---|---|
| 1 — Init projet | Faible | 15 min |
| 2 — Layout responsive | Moyenne | 30 min |
| 3 — Logo + TopBar | Faible | 20 min |
| 4 — Canvas | Moyenne | 45 min |
| 5 — Gestes + reconnaissance | Haute | 60 min |
| 6 — État question | Faible | 20 min |
| 7 — Feedback vocal | Faible | 20 min |
| 8 — Boutons triangulaires | Moyenne | 45 min |
| 9 — Dictée vocale | Moyenne | 30 min |
| 10 — Lecture vocale | Faible | 20 min |
| 11 — Stockage sécurisé | Haute | 60 min |
| 12 — Intégration Claude | Moyenne | 45 min |
| 13 — Déconnexion + polish | Moyenne | 45 min |
| **Total** | | **~7h** |
