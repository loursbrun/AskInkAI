#!/usr/bin/env python3
"""
Train a compact CNN on EMNIST Letters (A-Z uppercase) and export to TF.js.

Output: ../public/model/model.json + weights shards
Usage : python3 scripts/train_emnist.py

Requirements:
    pip install tensorflow tensorflowjs emnist
"""

import os
import sys
import numpy as np

# ─── paths ───────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, '..', 'public', 'model')
KERAS_PATH = os.path.join(SCRIPT_DIR, 'emnist_letters.keras')

os.makedirs(OUT_DIR, exist_ok=True)

# ─── 1. Load data ─────────────────────────────────────────────────────────────
print("Loading EMNIST Letters dataset…")
try:
    from emnist import extract_training_samples, extract_test_samples
    x_train, y_train = extract_training_samples('letters')
    x_test, y_test = extract_test_samples('letters')
except ImportError:
    sys.exit("Missing dependency — run:  pip install emnist")

# Labels in EMNIST Letters are 1-indexed (1=A … 26=Z) → make 0-indexed
y_train = y_train - 1
y_test  = y_test  - 1

# Reshape + normalise (NCHW → NHWC float32 [0,1])
x_train = x_train.reshape(-1, 28, 28, 1).astype('float32') / 255.0
x_test  = x_test.reshape(-1, 28, 28, 1).astype('float32') / 255.0

# EMNIST letters are written on a white background – invert to match our
# preprocessor convention (black background, white strokes).
x_train = 1.0 - x_train
x_test  = 1.0 - x_test

print(f"  train: {x_train.shape}  test: {x_test.shape}")
print(f"  label range: {y_train.min()}–{y_train.max()}  (0=A, 25=Z)")

# ─── 2. Model ─────────────────────────────────────────────────────────────────
import tensorflow as tf

model = tf.keras.Sequential([
    tf.keras.layers.Input(shape=(28, 28, 1)),

    tf.keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D((2, 2)),
    tf.keras.layers.Dropout(0.25),

    tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.MaxPooling2D((2, 2)),
    tf.keras.layers.Dropout(0.25),

    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(256, activation='relu'),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dropout(0.4),

    tf.keras.layers.Dense(26, activation='softmax'),
], name='emnist_letters_cnn')

model.summary()

model.compile(
    optimizer=tf.keras.optimizers.Adam(learning_rate=3e-4),
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy'],
)

# ─── 3. Train ─────────────────────────────────────────────────────────────────
callbacks = [
    tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True, monitor='val_accuracy'),
    tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=2, min_lr=1e-5, monitor='val_accuracy'),
]

model.fit(
    x_train, y_train,
    validation_data=(x_test, y_test),
    epochs=40,
    batch_size=128,
    callbacks=callbacks,
)

val_loss, val_acc = model.evaluate(x_test, y_test, verbose=0)
print(f"\n✓ Final accuracy on test set: {val_acc * 100:.1f}%")

# ─── 4. Export to TF.js ──────────────────────────────────────────────────────
model.save(KERAS_PATH)
print(f"Keras model saved to {KERAS_PATH}")

try:
    import tensorflowjs as tfjs
except ImportError:
    sys.exit("Missing dependency — run:  pip install tensorflowjs")

tfjs.converters.save_keras_model(
    tf.keras.models.load_model(KERAS_PATH),
    OUT_DIR,
)
print(f"\n✓ TF.js model exported to:  {OUT_DIR}/")
print("   Files: model.json + group1-shard*.bin")
print("\nYou can now start the dev server — the EMNIST engine will be active.")
