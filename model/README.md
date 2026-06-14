# Modèle TF.js EMNIST

Ce dossier doit contenir les fichiers d'un modèle TensorFlow.js entraîné sur EMNIST Letters.

## Fichiers attendus

```
public/model/
├── model.json        ← architecture + metadata
└── group1-shard1of1.bin  ← poids du modèle
```

## Comment obtenir un modèle

### Option 1 — Utiliser le script de conversion inclus

```bash
cd spike
pip install tensorflow numpy
python scripts/convert_emnist.py
```

### Option 2 — Modèle pré-entraîné depuis TF Hub (converti manuellement)

1. Télécharger un modèle EMNIST Letters en format SavedModel ou H5
2. Convertir avec tensorflowjs_converter :

```bash
pip install tensorflowjs
tensorflowjs_converter --input_format=keras model.h5 public/model/
```

## Format d'entrée attendu

- Shape: `[batch, 28, 28, 1]`
- Type: `float32`
- Valeurs: `[0, 1]` normalisées
- Fond: noir (0), lettre: blanc (1)

## Format de sortie attendu

- Shape: `[batch, 26]`
- Probabilités softmax pour A (index 0) à Z (index 25)

## Sans modèle

Sans fichier `model.json`, le spike fonctionne en mode **Analyse Géométrique** :
- Extraction de features (ratio, fermeture, changements de direction, centroïde)
- Classification heuristique basée sur ces features
- Précision limitée (~15-25%) mais pipeline complet fonctionnel
- Clairement labelisé "Analyse géom." dans l'interface
