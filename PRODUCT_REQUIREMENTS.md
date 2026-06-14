# PRODUCT_REQUIREMENTS.md — AskInkAI

## 1. Vision produit

AskInkAI est une interface conversationnelle alternative permettant de poser des questions à Claude **sans parler et sans clavier**, en dessinant les lettres une par une sur un écran tactile.

L'utilisateur dessine chaque lettre au centre d'un grand canvas. Chaque lettre reconnue est ajoutée à la question. L'utilisateur envoie ensuite la question et lit (ou écoute) la réponse de Claude.

---

## 2. Utilisateurs cibles

- Utilisateurs en situation de mobilité (transport, réunion silencieuse)
- Personnes souhaitant une interaction IA sans voix
- Explorateurs d'interfaces alternatives et gestuelles
- Usage personnel / prototype

---

## 3. Plateformes cibles

| Plateforme | Orientation | Priorité |
|---|---|---|
| Téléphone | Portrait | P0 |
| Tablette | Portrait | P0 |
| Tablette | Paysage | P0 |
| Desktop | — | P1 |

L'interface est **mobile-first** et **tactile-first**.

---

## 4. Design général

### Principes

- Très simple, épuré, moderne, premium
- Beaucoup d'espace vide (whitespace généreux)
- Pas de surcharge visuelle
- Palette sombre ou claire — à décider (dark mode recommandé pour usage tactile)
- Typographie propre, lisible, moderne (ex: Inter, Geist)
- Animations subtiles et fluides

### Couleurs recommandées (dark theme)

| Élément | Couleur |
|---|---|
| Background | `#0a0a0a` |
| Surface | `#111111` |
| Border | `#222222` |
| Primary (accent) | `#6366f1` (indigo) ou encre bleue |
| Text primary | `#f5f5f5` |
| Text secondary | `#888888` |
| Canvas | `#0f0f0f` |

---

## 5. Logo

Logo SVG inline, moderne et minimaliste. Options retenues :

**Option choisie : Lettre "A" en tracé manuscrit stylisé**
- Représente la première lettre de l'alphabet (base de l'écriture)
- Référence directe au dessin de lettres
- Peut ressembler à un tracé de plume ou pinceau
- Simple, mémorable, original

Le logo est placé dans la **barre supérieure**, à gauche, avec le nom "AskInkAI" à sa droite.

---

## 6. Structure de l'interface

### Layout principal

```
┌─────────────────────────────────────────────┐
│  TOPBAR : Logo | [  Question...  ] [ 🎤 ] [⏏]│
├─────────────────────────────────────────────┤
│[▲ Voice]                      [▲ Length]    │
│                                             │
│              CANVAS CENTRAL                 │
│         (dessin lettre unique)              │
│                                             │
│[▲ Clear]                      [▲ Send]      │
├─────────────────────────────────────────────┤
│              RÉPONSE CLAUDE                 │
│            (zone scrollable)                │
└─────────────────────────────────────────────┘
```

---

## 7. Barre supérieure (TopBar)

| Élément | Détail |
|---|---|
| Logo + nom | À gauche — SVG + "AskInkAI" |
| Champ question | Input texte éditable, centré, largeur maximale |
| Bouton micro | À droite du champ — active la dictée vocale |
| Bouton déconnexion | Icône discrète à l'extrême droite |

### Comportement du champ question

- Affiche la question construite lettre par lettre
- Éditable au clavier natif du navigateur au clic
- Synchronisé bidirectionnellement avec l'état global
- Placeholder : *"Dessine ta question..."*

---

## 8. Canvas central

| Attribut | Valeur |
|---|---|
| Taille | Maximale dans la zone disponible |
| Fond | Légèrement distinct du background |
| Trait | Blanc ou accent, lisse, épaisseur ~3-4px |
| Comportement | Dessine une lettre, reconnaît, efface, attend la suivante |
| Feedback visuel | Animation légère lors de la reconnaissance |

### Cycle de dessin

```
Utilisateur dessine → stroke capturé → analyse geste/lettre
  → si geste : action (espace / suppression)
  → si lettre : reconnaissance → ajout à la question
  → feedback vocal
  → canvas effacé après délai court (~600ms)
```

### Reconnaissance manuscrite

Pour le MVP, une **simulation** est utilisée :
- Analyse de la complexité du stroke (nb de points, forme)
- Retourne une lettre pseudo-aléatoire parmi un ensemble vraisemblable
- Interface propre `HandwritingRecognizer` permettant de brancher une vraie reconnaissance ultérieure (ex: TensorFlow.js, API tierce)

---

## 9. Gestes spéciaux

| Geste | Détection | Action | Feedback vocal |
|---|---|---|---|
| Trait horizontal gauche→droite | Direction X dominante, déplacement > 60% largeur canvas, Y faible | Ajouter espace | "espace" |
| Trait horizontal droite→gauche | Direction X inverse, même conditions | Supprimer dernier caractère | "supprimé" |

---

## 10. Feedback vocal

Technologie : **Web Speech API — SpeechSynthesis**

| Événement | Texte énoncé |
|---|---|
| Lettre reconnue | La lettre (ex: "A", "B", "K") |
| Geste espace | "espace" |
| Geste suppression | "supprimé" |
| Erreur API | "Erreur" (optionnel) |

- Voix : système, de préférence française
- Pitch et rate normaux
- Pas de blocage si pas de voix disponible

---

## 11. Boutons triangulaires

Quatre boutons dans les coins du canvas, orientés vers le centre.

| Coin | Action | Icône | État |
|---|---|---|---|
| Bas droite | Envoyer la question à Claude | → Send | Normal / Loading |
| Bas gauche | Effacer toute la question | ✕ Clear | Normal |
| Haut gauche | Lire/Pauser la réponse vocalement | ▶ / ❚❚ Voice | Play / Pause |
| Haut droite | Changer longueur de réponse | ↕ Length | 3 états cycliques |

### Niveaux de longueur de réponse

| État | Label | Instruction système |
|---|---|---|
| 1 | Très courte | "Réponds en 1 à 2 phrases maximum, de façon très concise." |
| 2 | Moyenne | "Réponds de façon équilibrée, en quelques phrases claires." |
| 3 | Complète | "Réponds de façon détaillée et complète." |

---

## 12. Zone réponse

- Affichée sous le canvas
- Typographie lisible, interligne confortable
- Hauteur fixe avec scroll interne sur mobile
- Sur desktop : peut s'étendre davantage
- État : vide / chargement / réponse affichée / erreur
- Animation d'apparition douce (fade-in)

---

## 13. Dictée vocale (micro)

Technologie : **Web Speech API — SpeechRecognition**

| Comportement | Détail |
|---|---|
| Activation | Clic sur bouton micro |
| Indication état actif | Bouton pulsant / coloré |
| Résultat | Remplit ou complète le champ question |
| Désactivation | Clic ailleurs dans l'app |
| Navigateur non compatible | Message d'erreur propre et discret |

---

## 14. Gestion de la clé API

### Premier lancement

- Modal ou écran dédié
- Champ password masqué
- Bouton sauvegarder
- Validation : teste la clé avant de la stocker

### Stockage

- Chiffrement AES-GCM via Web Crypto API
- CryptoKey stockée dans IndexedDB
- IV + clé chiffrée stockés séparément
- Jamais en clair dans localStorage, console, ou DOM

### Déconnexion

- Supprime CryptoKey, IV, et clé chiffrée
- Vide tout cache lié
- Redirige vers écran de saisie de clé

---

## 15. Comportements non fonctionnels

| Exigence | Détail |
|---|---|
| Performance | Canvas fluide à 60fps sur mobile |
| Responsive | Mobile-first, breakpoints sm/md/lg/xl |
| Accessibilité | Contraste suffisant, rôles ARIA basiques |
| Sécurité | Aucune clé en clair, aucun log sensible |
| Offline | Interface fonctionne sans réseau (sauf appel API) |
| Erreurs | Messages d'erreur visibles propres, pas de stack trace |
