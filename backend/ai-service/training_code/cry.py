"""
Two-Stage Infant Cry Detection and Classification System

Stage 1: Binary classification (cry vs non-cry)
Stage 2: Multi-class classification (6 cry reasons)

Upload your dataset to Kaggle and adjust DATA_PATH accordingly.
"""

import os
import numpy as np
import pandas as pd
import librosa
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from sklearn.utils.class_weight import compute_class_weight
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models, callbacks
from tensorflow.keras.utils import to_categorical
import warnings
warnings.filterwarnings('ignore')

# Set random seeds for reproducibility
np.random.seed(42)
tf.random.set_seed(42)

# ========================= CONFIGURATION =========================
DATA_PATH = '/kaggle/input/cry-audiov2'  # Adjust this path
SAMPLE_RATE = 16000
DURATION = 3  # seconds
N_MELS = 128
N_FFT = 2048
HOP_LENGTH = 512
MAX_LENGTH = int(DURATION * SAMPLE_RATE)

# Training parameters
BATCH_SIZE = 16  # Smaller batch size for imbalanced data - better gradient updates
EPOCHS_STAGE1 = 5
EPOCHS_STAGE2 = 150  # More epochs with early stopping to ensure convergence
LEARNING_RATE = 0.0005  # Lower LR for more stable training with focal loss

# Class names - MUST MATCH ACTUAL FOLDER NAMES!
CRY_CLASSES = ['belly pain', 'burping', 'cold_hot', 'discomfort', 'hungry', 'tired']
STAGE1_CLASSES = ['non_cry', 'cry']
NON_CRY_FOLDER = 'not_cry'  # Name of your non-cry folder

# ========================= DATA LOADING =========================

def load_audio_file(file_path, sr=SAMPLE_RATE, duration=DURATION):
    """Load and preprocess audio file."""
    try:
        # Load audio
        audio, _ = librosa.load(file_path, sr=sr, duration=duration)
        
        # Pad or truncate to fixed length
        if len(audio) < MAX_LENGTH:
            audio = np.pad(audio, (0, MAX_LENGTH - len(audio)), mode='constant')
        else:
            audio = audio[:MAX_LENGTH]
        
        return audio
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        return None

def extract_mel_spectrogram(audio, sr=SAMPLE_RATE):
    """Extract Mel spectrogram features."""
    mel_spec = librosa.feature.melspectrogram(
        y=audio, 
        sr=sr, 
        n_mels=N_MELS, 
        n_fft=N_FFT, 
        hop_length=HOP_LENGTH
    )
    # Convert to log scale (dB)
    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
    return mel_spec_db

def augment_audio(audio, sr=SAMPLE_RATE):
    """Apply ALWAYS-ON diverse augmentation to audio."""
    augmentations = []
    
    # 1. Original (always include)
    augmentations.append(audio)
    
    # 2. Time stretching (ALWAYS - don't make it conditional)
    rate = np.random.uniform(0.85, 1.15)
    stretched = librosa.effects.time_stretch(audio, rate=rate)
    if len(stretched) < MAX_LENGTH:
        stretched = np.pad(stretched, (0, MAX_LENGTH - len(stretched)), mode='constant')
    else:
        stretched = stretched[:MAX_LENGTH]
    augmentations.append(stretched)
    
    # 3. Pitch shifting (ALWAYS)
    n_steps = np.random.randint(-2, 3)
    shifted = librosa.effects.pitch_shift(audio, sr=sr, n_steps=n_steps)
    augmentations.append(shifted)
    
    # 4. Add noise (ALWAYS)
    noise_level = np.random.uniform(0.002, 0.008)
    noise = np.random.randn(len(audio)) * noise_level
    noisy = audio + noise
    noisy = np.clip(noisy, -1.0, 1.0)
    augmentations.append(noisy)
    
    # 5. Volume scaling (ALWAYS)
    volume_factor = np.random.uniform(0.8, 1.2)
    scaled = audio * volume_factor
    scaled = np.clip(scaled, -1.0, 1.0)
    augmentations.append(scaled)
    
    # 6. Time shift / circular roll (ALWAYS)
    shift_amount = np.random.randint(-sr//2, sr//2)  # Up to 0.5 second shift
    time_shifted = np.roll(audio, shift_amount)
    augmentations.append(time_shifted)
    
    # 7. Combined transformation (ALWAYS)
    combined = audio.copy()
    # Time stretch
    combined = librosa.effects.time_stretch(combined, rate=np.random.uniform(0.9, 1.1))
    if len(combined) < MAX_LENGTH:
        combined = np.pad(combined, (0, MAX_LENGTH - len(combined)), mode='constant')
    else:
        combined = combined[:MAX_LENGTH]
    # Pitch shift
    combined = librosa.effects.pitch_shift(combined, sr=sr, n_steps=np.random.randint(-1, 2))
    # Noise
    combined = combined + np.random.randn(len(combined)) * 0.004
    combined = np.clip(combined, -1.0, 1.0)
    augmentations.append(combined)
    
    return augmentations

def load_cry_dataset(data_path, augment=True):
    """Load all cry audio files and their labels with intelligent balancing."""
    X = []
    y = []
    
    data_dir = Path(data_path)
    
    # First pass: count samples per class
    class_counts = {}
    for class_idx, class_name in enumerate(CRY_CLASSES):
        class_folder = data_dir / class_name
        if class_folder.exists():
            class_counts[class_name] = len(list(class_folder.glob('*.wav')))
        else:
            class_counts[class_name] = 0
    
    # Calculate augmentation strategy - BE REASONABLE!
    # Don't try to perfectly balance - that creates garbage data
    # Instead: moderate augmentation + strong class weights
    
    print(f"\nClass counts: {class_counts}")
    
    # UPDATED: Actual file counts from dataset:
    # belly pain: 133, burping: 124, cold_hot: 130, discomfort: 172, hungry: 427, tired: 142
    # Strategy: Provide sufficient diversity for ALL classes
    # Hungry is collapsing because insufficient augmentation diversity
    augmentation_map = {
        'belly pain': 3,    # 133 × 3 = 399 samples
        'burping': 4,       # 124 × 4 = 496 samples (boost low performance)
        'cold_hot': 4,      # 130 × 4 = 520 samples
        'discomfort': 4,    # 172 × 4 = 688 samples (boost underperforming)
        'hungry': 3,        # 427 × 3 = 1281 samples (MORE diversity needed!)
        'tired': 4          # 142 × 4 = 568 samples (boost very low performance)
    }
    
    print(f"Augmentation strategy (MINIMAL - files already balanced):")
    for class_name, aug_count in augmentation_map.items():
        original_count = class_counts.get(class_name, 0)
        final_count = original_count * aug_count
        print(f"  {class_name}: {original_count} files × {aug_count} aug = ~{final_count} samples")
    
    for class_idx, class_name in enumerate(CRY_CLASSES):
        class_folder = data_dir / class_name
        
        if not class_folder.exists():
            print(f"Warning: Folder {class_folder} not found!")
            continue
        
        files = list(class_folder.glob('*.wav'))
        print(f"Loading {len(files)} files from {class_name} (will create ~{len(files) * augmentation_map[class_name]} samples)...")
        
        for file_path in files:
            audio = load_audio_file(str(file_path))
            
            if audio is not None:
                # Original sample
                mel_spec = extract_mel_spectrogram(audio)
                X.append(mel_spec)
                y.append(class_idx)
                
                # Augmentation with class-specific strategy
                if augment and augmentation_map[class_name] > 1:
                    n_augmentations = augmentation_map[class_name] - 1  # -1 because we already added original

                    # Generate fresh augmented samples each time for maximum diversity
                    for _ in range(n_augmentations):
                        augmented_versions = augment_audio(audio)[1:]  # drop the unmodified audio
                        if not augmented_versions:
                            continue
                        aug_audio = augmented_versions[np.random.randint(len(augmented_versions))]
                        mel_spec = extract_mel_spectrogram(aug_audio)
                        X.append(mel_spec)
                        y.append(class_idx)
    
    X = np.array(X)
    y = np.array(y)
    
    # Add channel dimension for CNN
    X = X[..., np.newaxis]
    
    print(f"\nDataset shape: {X.shape}")
    print(f"Labels shape: {y.shape}")
    print(f"Class distribution: {np.bincount(y)}")
    
    return X, y

def generate_non_cry_samples(n_samples=500, duration=DURATION):
    """Generate synthetic non-cry (silence/background noise) samples."""
    X = []
    
    print(f"Generating {n_samples} non-cry samples...")
    
    for i in range(n_samples):
        # Generate different types of non-cry audio
        sample_type = np.random.choice(['silence', 'white_noise', 'pink_noise'])
        
        if sample_type == 'silence':
            audio = np.random.randn(MAX_LENGTH) * 0.001  # Very low amplitude
        elif sample_type == 'white_noise':
            audio = np.random.randn(MAX_LENGTH) * 0.1
        else:  # pink_noise
            audio = np.random.randn(MAX_LENGTH)
            # Simple pink noise approximation
            audio = np.cumsum(audio) * 0.01
        
        mel_spec = extract_mel_spectrogram(audio)
        X.append(mel_spec)
    
    X = np.array(X)
    X = X[..., np.newaxis]
    
    return X

def load_non_cry_dataset(data_path, augment=False):
    """Load all non-cry audio files."""
    X = []
    
    data_dir = Path(data_path)
    non_cry_folder = data_dir / NON_CRY_FOLDER
    
    if not non_cry_folder.exists():
        print(f"Warning: Folder {non_cry_folder} not found!")
        print("Generating synthetic non-cry samples instead...")
        return generate_non_cry_samples(n_samples=500)
    
    files = list(non_cry_folder.glob('*.wav'))
    print(f"Loading {len(files)} non-cry files...")
    
    for file_path in files:
        audio = load_audio_file(str(file_path))
        
        if audio is not None:
            # Original sample
            mel_spec = extract_mel_spectrogram(audio)
            X.append(mel_spec)
            
            # Optional: light augmentation for non-cry samples
            if augment:
                augmented = augment_audio(audio)
                for aug_audio in augmented[:2]:  # Add 2 augmentations per sample
                    mel_spec = extract_mel_spectrogram(aug_audio)
                    X.append(mel_spec)
    
    X = np.array(X)
    
    # Add channel dimension for CNN
    X = X[..., np.newaxis]
    
    print(f"Non-cry dataset shape: {X.shape}")
    
    return X

# ========================= MODEL ARCHITECTURES =========================

def build_cnn_model(input_shape, num_classes, model_name="CNN"):
    """Build CNN model for audio classification."""
    
    model = models.Sequential(name=model_name)
    
    # Conv Block 1
    model.add(layers.Conv2D(32, (3, 3), activation='relu', padding='same', input_shape=input_shape))
    model.add(layers.BatchNormalization())
    model.add(layers.Conv2D(32, (3, 3), activation='relu', padding='same'))
    model.add(layers.BatchNormalization())
    model.add(layers.MaxPooling2D((2, 2)))
    model.add(layers.Dropout(0.25))
    
    # Conv Block 2
    model.add(layers.Conv2D(64, (3, 3), activation='relu', padding='same'))
    model.add(layers.BatchNormalization())
    model.add(layers.Conv2D(64, (3, 3), activation='relu', padding='same'))
    model.add(layers.BatchNormalization())
    model.add(layers.MaxPooling2D((2, 2)))
    model.add(layers.Dropout(0.25))
    
    # Conv Block 3
    model.add(layers.Conv2D(128, (3, 3), activation='relu', padding='same'))
    model.add(layers.BatchNormalization())
    model.add(layers.Conv2D(128, (3, 3), activation='relu', padding='same'))
    model.add(layers.BatchNormalization())
    model.add(layers.MaxPooling2D((2, 2)))
    model.add(layers.Dropout(0.25))
    
    # Conv Block 4
    model.add(layers.Conv2D(256, (3, 3), activation='relu', padding='same'))
    model.add(layers.BatchNormalization())
    model.add(layers.MaxPooling2D((2, 2)))
    model.add(layers.Dropout(0.25))
    
    # Dense layers
    model.add(layers.GlobalAveragePooling2D())
    model.add(layers.Dense(256, activation='relu'))
    model.add(layers.BatchNormalization())
    model.add(layers.Dropout(0.5))
    model.add(layers.Dense(128, activation='relu'))
    model.add(layers.Dropout(0.5))
    
    # Output layer
    if num_classes == 2:
        model.add(layers.Dense(1, activation='sigmoid'))
    else:
        model.add(layers.Dense(num_classes, activation='softmax'))
    
    return model

def build_crnn_model(input_shape, num_classes, model_name="CRNN"):
    """Build CRNN (CNN + LSTM) model for audio classification."""
    
    inputs = layers.Input(shape=input_shape)
    
    # CNN layers
    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same')(inputs)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Dropout(0.25)(x)
    
    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Dropout(0.25)(x)
    
    x = layers.Conv2D(128, (3, 3), activation='relu', padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Dropout(0.25)(x)
    
    # Reshape for LSTM
    x = layers.Reshape((x.shape[1], x.shape[2] * x.shape[3]))(x)
    
    # LSTM layers
    x = layers.Bidirectional(layers.LSTM(128, return_sequences=True))(x)
    x = layers.Dropout(0.25)(x)
    x = layers.Bidirectional(layers.LSTM(64))(x)
    x = layers.Dropout(0.25)(x)
    
    # Dense layers
    x = layers.Dense(128, activation='relu')(x)
    x = layers.Dropout(0.5)(x)
    
    # Output layer
    if num_classes == 2:
        outputs = layers.Dense(1, activation='sigmoid')(x)
    else:
        outputs = layers.Dense(num_classes, activation='softmax')(x)
    
    model = models.Model(inputs=inputs, outputs=outputs, name=model_name)
    return model

# ========================= TRAINING FUNCTIONS =========================

def focal_loss(gamma=2.0, alpha=0.25):
    """
    Focal loss for multi-class classification.
    Focuses training on hard examples and rare classes.
    """
    def focal_loss_fixed(y_true, y_pred):
        # Clip predictions to prevent log(0)
        y_pred = tf.clip_by_value(y_pred, tf.keras.backend.epsilon(), 1 - tf.keras.backend.epsilon())
        
        # Calculate cross entropy
        cross_entropy = -y_true * tf.math.log(y_pred)
        
        # Calculate focal loss
        loss = alpha * tf.pow(1 - y_pred, gamma) * cross_entropy
        
        return tf.reduce_mean(tf.reduce_sum(loss, axis=1))
    
    return focal_loss_fixed

def plot_training_history(history, stage_name):
    """Plot training history."""
    fig, axes = plt.subplots(1, 2, figsize=(15, 5))
    
    # Accuracy
    axes[0].plot(history.history['accuracy'], label='Train Accuracy')
    axes[0].plot(history.history['val_accuracy'], label='Val Accuracy')
    axes[0].set_title(f'{stage_name} - Accuracy')
    axes[0].set_xlabel('Epoch')
    axes[0].set_ylabel('Accuracy')
    axes[0].legend()
    axes[0].grid(True)
    
    # Loss
    axes[1].plot(history.history['loss'], label='Train Loss')
    axes[1].plot(history.history['val_loss'], label='Val Loss')
    axes[1].set_title(f'{stage_name} - Loss')
    axes[1].set_xlabel('Epoch')
    axes[1].set_ylabel('Loss')
    axes[1].legend()
    axes[1].grid(True)
    
    plt.tight_layout()
    plt.savefig(f'{stage_name.lower().replace(" ", "_")}_history.png', dpi=150)
    plt.show()

def plot_confusion_matrix(y_true, y_pred, class_names, stage_name):
    """Plot confusion matrix."""
    cm = confusion_matrix(y_true, y_pred)
    
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=class_names, yticklabels=class_names)
    plt.title(f'{stage_name} - Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    plt.savefig(f'{stage_name.lower().replace(" ", "_")}_confusion_matrix.png', dpi=150)
    plt.show()

def train_stage1_cry_detection(X_cry, data_path):
    """
    Stage 1: Train binary cry detection model.
    """
    print("\n" + "="*70)
    print("STAGE 1: CRY DETECTION (Binary Classification)")
    print("="*70)
    
    # Load non-cry samples from real data
    X_non_cry = load_non_cry_dataset(data_path, augment=True)
    
    # Combine datasets
    X = np.concatenate([X_non_cry, X_cry], axis=0)
    y = np.concatenate([
        np.zeros(len(X_non_cry)),  # 0 = non_cry
        np.ones(len(X_cry))         # 1 = cry
    ])
    
    # Shuffle
    indices = np.random.permutation(len(X))
    X = X[indices]
    y = y[indices]
    
    print(f"\nStage 1 Dataset:")
    print(f"Total samples: {len(X)}")
    print(f"Non-cry samples: {np.sum(y == 0)}")
    print(f"Cry samples: {np.sum(y == 1)}")
    
    # Split data
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    
    print(f"\nTrain samples: {len(X_train)}")
    print(f"Val samples: {len(X_val)}")
    print(f"Test samples: {len(X_test)}")
    
    # Build model
    input_shape = X_train.shape[1:]
    model = build_cnn_model(input_shape, num_classes=2, model_name="Stage1_CryDetection")
    
    # Compile
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.Precision(), keras.metrics.Recall()]
    )
    
    print("\nModel Summary:")
    model.summary()
    
    # Callbacks
    early_stop = callbacks.EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
    reduce_lr = callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-7)
    
    # Train
    print("\nTraining Stage 1 Model...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS_STAGE1,
        batch_size=BATCH_SIZE,
        callbacks=[early_stop, reduce_lr],
        verbose=1
    )
    
    # Evaluate
    print("\n" + "="*50)
    print("Stage 1 Evaluation")
    print("="*50)
    
    test_loss, test_acc, test_precision, test_recall = model.evaluate(X_test, y_test, verbose=0)
    f1 = 2 * (test_precision * test_recall) / (test_precision + test_recall + 1e-7)
    
    print(f"\nTest Accuracy: {test_acc:.4f}")
    print(f"Test Precision: {test_precision:.4f}")
    print(f"Test Recall: {test_recall:.4f}")
    print(f"Test F1-Score: {f1:.4f}")
    
    # Predictions
    y_pred_prob = model.predict(X_test)
    y_pred = (y_pred_prob > 0.5).astype(int).flatten()
    
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=STAGE1_CLASSES))
    
    # Plot results
    plot_training_history(history, "Stage 1 - Cry Detection")
    plot_confusion_matrix(y_test, y_pred, STAGE1_CLASSES, "Stage 1 - Cry Detection")
    
    # Save model
    model.save('stage1_cry_detection_model.h5')
    print("\nStage 1 model saved as 'stage1_cry_detection_model.h5'")
    
    return model, history

def train_stage2_cry_classification(X, y):
    """
    Stage 2: Train multi-class cry reason classification model.
    """
    print("\n" + "="*70)
    print("STAGE 2: CRY REASON CLASSIFICATION (Multi-Class)")
    print("="*70)
    
    print(f"\nStage 2 Dataset:")
    print(f"Total samples: {len(X)}")
    print(f"Number of classes: {len(CRY_CLASSES)}")
    print(f"\nClass distribution in full dataset:")
    for idx, class_name in enumerate(CRY_CLASSES):
        count = np.sum(y == idx)
        percentage = (count / len(y)) * 100
        print(f"  {class_name}: {count} samples ({percentage:.1f}%)")
    
    # Split data with stratification
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )
    
    print(f"\nTrain samples: {len(X_train)}")
    print(f"Val samples: {len(X_val)}")
    print(f"Test samples: {len(X_test)}")
    
    # Check class distribution in each split
    print("\nClass distribution in training set:")
    for i, class_name in enumerate(CRY_CLASSES):
        count = np.sum(y_train == i)
        percentage = (count / len(y_train)) * 100
        print(f"  {class_name}: {count} samples ({percentage:.1f}%)")
    
    print("\nClass distribution in validation set:")
    for i, class_name in enumerate(CRY_CLASSES):
        count = np.sum(y_val == i)
        print(f"  {class_name}: {count} samples")
    
    print("\nClass distribution in test set:")
    for i, class_name in enumerate(CRY_CLASSES):
        count = np.sum(y_test == i)
        print(f"  {class_name}: {count} samples")
    
    # Convert to categorical
    y_train_cat = to_categorical(y_train, num_classes=len(CRY_CLASSES))
    y_val_cat = to_categorical(y_val, num_classes=len(CRY_CLASSES))
    y_test_cat = to_categorical(y_test, num_classes=len(CRY_CLASSES))
    
    # Apply label smoothing to training data to prevent overconfidence
    smoothing = 0.1
    y_train_cat = y_train_cat * (1 - smoothing) + smoothing / len(CRY_CLASSES)
    
    # Compute class weights based on ACTUAL training set distribution
    # This ensures weights match the data the model sees during training
    train_class_counts = np.bincount(y_train, minlength=len(CRY_CLASSES))
    
    # Use balanced strategy but with moderate scaling to avoid over-penalizing hungry
    total_samples = len(y_train)
    n_classes = len(CRY_CLASSES)
    
    class_weight_dict = {}
    for i in range(n_classes):
        if train_class_counts[i] > 0:
            # Standard balanced formula: total / (n_classes * count)
            weight = total_samples / (n_classes * train_class_counts[i])
            # Apply sqrt to moderate the effect
            weight = np.sqrt(weight)
            # Clip to reasonable range
            weight = float(np.clip(weight, 0.5, 2.0))
        else:
            weight = 1.0
        class_weight_dict[i] = weight
    
    print(f"\nClass weights (based on training set after augmentation):")
    for i, class_name in enumerate(CRY_CLASSES):
        count = train_class_counts[i] if i < len(train_class_counts) else 0
        print(f"  {class_name}: {class_weight_dict[i]:.2f} (training samples: {count})")
    print(f"\nSamples per class in training (after augmentation): {[np.sum(y_train == i) for i in range(len(CRY_CLASSES))]}")
    
    # Build model
    input_shape = X_train.shape[1:]
    model = build_cnn_model(input_shape, num_classes=len(CRY_CLASSES), model_name="Stage2_CryClassification")
    
    # Compile with focal loss (reduced gamma for more balanced learning)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss=focal_loss(gamma=1.5, alpha=0.25),  # Reduced gamma to prevent over-focus on hard examples
        metrics=['accuracy']
    )
    
    print("\nModel Summary:")
    model.summary()
    
    # Custom callback to monitor per-class accuracy
    class PerClassAccuracyCallback(callbacks.Callback):
        def init(self, validation_data):
            super().init()
            self.X_val, self.y_val = validation_data
        
        def on_epoch_end(self, epoch, logs=None):
            if (epoch + 1) % 10 == 0:  # Every 10 epochs
                y_pred = np.argmax(self.model.predict(self.X_val, verbose=0), axis=1)
                y_true = np.argmax(self.y_val, axis=1)
                
                print(f"\n--- Per-Class Accuracy at Epoch {epoch + 1} ---")
                for i, class_name in enumerate(CRY_CLASSES):
                    class_mask = y_true == i
                    if np.sum(class_mask) > 0:
                        acc = np.mean(y_pred[class_mask] == i)
                        count = np.sum(class_mask)
                        print(f"  {class_name}: {acc:.3f} ({count} samples)")
                print("-" * 50)
    
    per_class_callback = PerClassAccuracyCallback((X_val, y_val_cat))
    
    # Callbacks
    early_stop = callbacks.EarlyStopping(monitor='val_loss', patience=15, restore_best_weights=True)
    reduce_lr = callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=7, min_lr=1e-7)
    
    # Train
    print("\nTraining Stage 2 Model...")
    history = model.fit(
        X_train, y_train_cat,
        validation_data=(X_val, y_val_cat),
        epochs=EPOCHS_STAGE2,
        batch_size=BATCH_SIZE,
        class_weight=class_weight_dict,
        callbacks=[early_stop, reduce_lr, per_class_callback],
        verbose=1
    )
    
    # Evaluate
    print("\n" + "="*50)
    print("Stage 2 Evaluation")
    print("="*50)
    
    test_loss, test_acc = model.evaluate(X_test, y_test_cat, verbose=0)
    
    print(f"\nTest Accuracy: {test_acc:.4f}")
    print(f"Test Loss: {test_loss:.4f}")
    
    # Predictions
    y_pred_prob = model.predict(X_test)
    y_pred = np.argmax(y_pred_prob, axis=1)
    
    # Calculate weighted F1
    f1_weighted = f1_score(y_test, y_pred, average='weighted')
    print(f"Weighted F1-Score: {f1_weighted:.4f}")
    
    print("\nClassification Report:")
    # Get unique labels present in test set
    unique_labels = np.unique(np.concatenate([y_test, y_pred]))
    target_names_filtered = [CRY_CLASSES[i] for i in unique_labels]
    print(classification_report(y_test, y_pred, labels=unique_labels, target_names=target_names_filtered, zero_division=0))
    
    # Per-class accuracy
    print("\nPer-class Accuracy:")
    for idx, class_name in enumerate(CRY_CLASSES):
        class_mask = y_test == idx
        if np.sum(class_mask) > 0:
            class_acc = np.mean(y_pred[class_mask] == idx)
            print(f"  {class_name}: {class_acc:.4f}")
    
    # Plot results
    plot_training_history(history, "Stage 2 - Cry Classification")
    plot_confusion_matrix(y_test, y_pred, CRY_CLASSES, "Stage 2 - Cry Classification")
    
    # Save model
    model.save('stage2_cry_classification_model.h5')
    print("\nStage 2 model saved as 'stage2_cry_classification_model.h5'")
    
    return model, history

# ========================= INFERENCE PIPELINE =========================

def predict_cry_reason(audio_file_path, stage1_model, stage2_model):
    """
    Complete inference pipeline: detect cry and classify reason.
    """
    # Load and preprocess audio
    audio = load_audio_file(audio_file_path)
    if audio is None:
        return None, None
    
    # Extract features
    mel_spec = extract_mel_spectrogram(audio)
    mel_spec = mel_spec[np.newaxis, ..., np.newaxis]  # Add batch and channel dims
    
    # Stage 1: Detect if crying
    cry_prob = stage1_model.predict(mel_spec, verbose=0)[0][0]
    is_crying = cry_prob > 0.5
    
    if not is_crying:
        return {
            'is_crying': False,
            'cry_probability': float(cry_prob),
            'cry_reason': None,
            'reason_confidence': None
        }
    
    # Stage 2: Classify cry reason
    reason_probs = stage2_model.predict(mel_spec, verbose=0)[0]
    reason_idx = np.argmax(reason_probs)
    reason_name = CRY_CLASSES[reason_idx]
    reason_confidence = float(reason_probs[reason_idx])
    
    return {
        'is_crying': True,
        'cry_probability': float(cry_prob),
        'cry_reason': reason_name,
        'reason_confidence': reason_confidence,
        'all_reason_probs': {CRY_CLASSES[i]: float(reason_probs[i]) for i in range(len(CRY_CLASSES))}
    }

# ========================= MAIN EXECUTION =========================

def main():
    """Main training pipeline."""
    
    print("="*70)
    print("INFANT CRY DETECTION AND CLASSIFICATION")
    print("="*70)
    
    # Check if dataset path exists
    if not os.path.exists(DATA_PATH):
        print(f"\n⚠  ERROR: Dataset path not found: {DATA_PATH}")
        print("\nPlease update DATA_PATH in the configuration section.")
        print("On Kaggle, it should be something like:")
        print("  DATA_PATH = '/kaggle/input/your-dataset-name/final datasets'")
        return
    
    # Load dataset
    print("\nLoading cry dataset...")
    X_cry, y_cry = load_cry_dataset(DATA_PATH, augment=True)
    
    # Stage 1: Cry Detection
    stage1_model, stage1_history = train_stage1_cry_detection(X_cry, DATA_PATH)
    
    # Stage 2: Cry Classification
    stage2_model, stage2_history = train_stage2_cry_classification(X_cry, y_cry)
    
    print("\n" + "="*70)
    print("TRAINING COMPLETE!")
    print("="*70)
    print("\nModels saved:")
    print("  - stage1_cry_detection_model.h5")
    print("  - stage2_cry_classification_model.h5")
    
    print("\n" + "="*70)
    print("EXAMPLE INFERENCE")
    print("="*70)
    
    # Example: Test on a sample from the test set
    print("\nTo use the models for prediction, use:")
    print("""
    # Load models
    stage1_model = keras.models.load_model('stage1_cry_detection_model.h5')
    stage2_model = keras.models.load_model('stage2_cry_classification_model.h5')
    
    # Predict on new audio
    result = predict_cry_reason('path/to/audio.wav', stage1_model, stage2_model)
    print(result)
    """)

if name == "main":
    main()