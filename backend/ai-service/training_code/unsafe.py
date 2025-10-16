"""
Baby Sleep Position Safety Detection System - Complete Kaggle Version
======================================================================

This single file includes:
1. Data augmentation and train/val/test splitting
2. MediaPipe Pose landmark extraction
3. Feature engineering (142 features)
4. RandomForest training with proper validation
5. Model evaluation and saving
6. Single image testing capability

Usage on Kaggle:
1. Upload your dataset (processed_Asleep/ and processed_Unsafe/ folders)
2. Run all cells
3. Model will be saved as baby_sleep_model.pkl

Author: GitHub Copilot
Date: October 2025
"""

# Install MediaPipe if not available (required for Kaggle)
try:
    import mediapipe as mp
except ImportError:
    print("MediaPipe not found. Installing...")
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "mediapipe"])
    import mediapipe as mp
    print("✓ MediaPipe installed successfully!")

import cv2
import numpy as np
import os
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from sklearn.preprocessing import StandardScaler
import shutil
import random
from tqdm.notebook import tqdm  # Use notebook version for Kaggle
import json
import warnings
warnings.filterwarnings('ignore')

# For visualization
import matplotlib.pyplot as plt
import seaborn as sns

print("="*70)
print("BABY SLEEP POSITION DETECTOR - COMPLETE SYSTEM")
print("="*70)
print("\n✓ All libraries imported successfully")


# ============================================================================
# SECTION 1: DATA AUGMENTATION
# ============================================================================

class DataAugmentor:
    """Augment images to balance dataset."""
    
    def _init_(self, seed=42):
        self.seed = seed
        random.seed(seed)
        np.random.seed(seed)
    
    def augment_image(self, image, augmentation_type):
        """Apply augmentation to an image."""
        h, w = image.shape[:2]
        
        if augmentation_type == 'flip':
            return cv2.flip(image, 1)
        
        elif augmentation_type == 'rotate_left':
            angle = random.uniform(10, 15)
            M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
            return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        
        elif augmentation_type == 'rotate_right':
            angle = random.uniform(-15, -10)
            M = cv2.getRotationMatrix2D((w/2, h/2), angle, 1.0)
            return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        
        elif augmentation_type == 'brightness_up':
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 2] = np.clip(hsv[:, :, 2] * random.uniform(1.1, 1.3), 0, 255)
            return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        
        elif augmentation_type == 'brightness_down':
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 2] = hsv[:, :, 2] * random.uniform(0.7, 0.9)
            return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        
        elif augmentation_type == 'noise':
            noise = np.random.normal(0, 15, image.shape).astype(np.float32)
            noisy = np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
            return noisy
        
        elif augmentation_type == 'zoom_in':
            crop_ratio = random.uniform(0.85, 0.95)
            crop_h, crop_w = int(h * crop_ratio), int(w * crop_ratio)
            start_y, start_x = (h - crop_h) // 2, (w - crop_w) // 2
            cropped = image[start_y:start_y+crop_h, start_x:start_x+crop_w]
            return cv2.resize(cropped, (w, h))
        
        elif augmentation_type == 'contrast':
            alpha = random.uniform(1.1, 1.4)
            return cv2.convertScaleAbs(image, alpha=alpha, beta=0)
        
        return image
    
    def augment_dataset(self, source_dir, output_dir, target_count):
        """Augment images to reach target count."""
        source_path = Path(source_dir)
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Get original images
        original_images = list(source_path.glob("*.jpg")) + \
                         list(source_path.glob("*.png")) + \
                         list(source_path.glob("*.jpeg"))
        
        original_count = len(original_images)
        print(f"  Original images: {original_count}")
        
        if original_count == 0:
            return []
        
        # Copy originals
        for img_path in original_images:
            shutil.copy2(img_path, output_path / img_path.name)
        
        augmented_needed = max(0, target_count - original_count)
        if augmented_needed == 0:
            return []
        
        print(f"  Augmenting: {augmented_needed} images")
        
        aug_types = ['flip', 'rotate_left', 'rotate_right', 'brightness_up', 
                    'brightness_down', 'noise', 'zoom_in', 'contrast']
        
        for i in tqdm(range(augmented_needed), desc="  Augmenting"):
            img_path = random.choice(original_images)
            aug_type = random.choice(aug_types)
            
            image = cv2.imread(str(img_path))
            if image is None:
                continue
            
            augmented = self.augment_image(image, aug_type)
            
            stem = img_path.stem
            ext = img_path.suffix
            new_name = f"{stem}aug{i:04d}_{aug_type}{ext}"
            cv2.imwrite(str(output_path / new_name), augmented)
        
        return output_path


def prepare_dataset(safe_dir, unsafe_dir, output_dir="dataset_split", 
                   target_unsafe=3000, train_ratio=0.70, val_ratio=0.15):
    """Complete dataset preparation pipeline."""
    
    print("\n" + "="*70)
    print("STEP 1: DATA AUGMENTATION & PREPARATION")
    print("="*70)
    
    # Count original images
    safe_count = len(list(Path(safe_dir).glob("*.jpg"))) + \
                 len(list(Path(safe_dir).glob("*.png")))
    unsafe_count = len(list(Path(unsafe_dir).glob("*.jpg"))) + \
                   len(list(Path(unsafe_dir).glob("*.png")))
    
    print(f"\nOriginal dataset:")
    print(f"  Safe: {safe_count}")
    print(f"  Unsafe: {unsafe_count}")
    print(f"  Ratio: {safe_count/unsafe_count:.2f}:1")
    
    print(f"\nTarget: Augment unsafe to {target_unsafe}")
    print(f"  New ratio: {safe_count/target_unsafe:.2f}:1")
    
    # Augment
    augmentor = DataAugmentor(seed=42)
    
    print("\nAugmenting UNSAFE class...")
    augmented_unsafe_dir = Path("augmented_data/unsafe")
    augmentor.augment_dataset(unsafe_dir, augmented_unsafe_dir, target_unsafe)
    
    print("\nCopying SAFE class...")
    augmented_safe_dir = Path("augmented_data/safe")
    augmented_safe_dir.mkdir(parents=True, exist_ok=True)
    for img_path in Path(safe_dir).glob("*.jpg"):
        shutil.copy2(img_path, augmented_safe_dir / img_path.name)
    for img_path in Path(safe_dir).glob("*.png"):
        shutil.copy2(img_path, augmented_safe_dir / img_path.name)
    
    # Split into train/val/test
    print("\nSplitting into train/val/test...")
    
    test_ratio = 1.0 - train_ratio - val_ratio
    random.seed(42)
    
    output_base = Path(output_dir)
    
    for class_name, source in [('safe', augmented_safe_dir), ('unsafe', augmented_unsafe_dir)]:
        images = list(source.glob(".jpg")) + list(source.glob(".png"))
        total = len(images)
        random.shuffle(images)
        
        train_end = int(total * train_ratio)
        val_end = train_end + int(total * val_ratio)
        
        train_images = images[:train_end]
        val_images = images[train_end:val_end]
        test_images = images[val_end:]
        
        for split, img_list in [('train', train_images), ('val', val_images), ('test', test_images)]:
            split_dir = output_base / split / class_name
            split_dir.mkdir(parents=True, exist_ok=True)
            for img in img_list:
                shutil.copy2(img, split_dir / img.name)
        
        print(f"  {class_name}: train={len(train_images)}, val={len(val_images)}, test={len(test_images)}")
    
    print("\n✓ Dataset preparation complete!")
    return output_base


# ============================================================================
# SECTION 2: MEDIAPIPE POSE & FEATURE EXTRACTION
# ============================================================================

class BabySleepPoseDetector:
    """Main detector class using MediaPipe Pose."""
    
    def _init_(self):
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5
        )
        
        self.scaler = None
        self.model = None
    
    def extract_landmarks(self, image_path):
        """Extract pose landmarks from image."""
        try:
            image = cv2.imread(str(image_path))
            if image is None:
                return None
            
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.pose.process(image_rgb)
            
            if results.pose_landmarks:
                landmarks = []
                for landmark in results.pose_landmarks.landmark:
                    landmarks.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
                return np.array(landmarks)
            return None
        except Exception as e:
            print(f"Error processing {image_path}: {e}")
            return None
    
    def extract_engineered_features(self, landmarks):
        """Extract 142 features (132 raw + 10 engineered)."""
        lm = landmarks.reshape(33, 4)
        features = list(landmarks)
        
        # Key landmark indices
        nose, left_shoulder, right_shoulder = 0, 11, 12
        left_hip, right_hip, left_knee, right_knee = 23, 24, 25, 26
        
        # Engineered features
        shoulder_z = (lm[left_shoulder, 2] + lm[right_shoulder, 2]) / 2
        features.append(shoulder_z)
        
        hip_z = (lm[left_hip, 2] + lm[right_hip, 2]) / 2
        features.append(hip_z)
        
        z_diff_shoulder_hip = shoulder_z - hip_z
        features.append(z_diff_shoulder_hip)
        
        torso_vector = lm[nose, :2] - (lm[left_hip, :2] + lm[right_hip, :2]) / 2
        torso_angle = np.arctan2(torso_vector[1], torso_vector[0])
        features.append(torso_angle)
        
        shoulder_width = abs(lm[left_shoulder, 0] - lm[right_shoulder, 0])
        features.append(shoulder_width)
        
        hip_width = abs(lm[left_hip, 0] - lm[right_hip, 0])
        features.append(hip_width)
        
        left_vis = np.mean([lm[left_shoulder, 3], lm[left_hip, 3], lm[left_knee, 3]])
        right_vis = np.mean([lm[right_shoulder, 3], lm[right_shoulder, 3], lm[right_knee, 3]])
        symmetry = abs(left_vis - right_vis)
        features.append(symmetry)
        
        avg_visibility = np.mean(lm[:, 3])
        features.append(avg_visibility)
        
        features.append(lm[nose, 1])
        
        avg_hip_pos = (lm[left_hip, :3] + lm[right_hip, :3]) / 2
        nose_hip_dist = np.linalg.norm(lm[nose, :3] - avg_hip_pos)
        features.append(nose_hip_dist)
        
        return np.array(features)
    
    def build_dataset(self, safe_dir, unsafe_dir):
        """Build feature dataset from directories."""
        X, y = [], []
        
        print(f"\nProcessing SAFE images from {safe_dir}...")
        safe_images = list(Path(safe_dir).glob(".jpg")) + list(Path(safe_dir).glob(".png"))
        for img_path in tqdm(safe_images, desc="Safe"):
            landmarks = self.extract_landmarks(img_path)
            if landmarks is not None:
                features = self.extract_engineered_features(landmarks)
                X.append(features)
                y.append(0)
        
        print(f"\nProcessing UNSAFE images from {unsafe_dir}...")
        unsafe_images = list(Path(unsafe_dir).glob(".jpg")) + list(Path(unsafe_dir).glob(".png"))
        for img_path in tqdm(unsafe_images, desc="Unsafe"):
            landmarks = self.extract_landmarks(img_path)
            if landmarks is not None:
                features = self.extract_engineered_features(landmarks)
                X.append(features)
                y.append(1)
        
        return np.array(X), np.array(y)
    
    def train_model(self, X_train, y_train, X_val, y_val, X_test, y_test):
        """Train RandomForest classifier."""
        print("\n" + "="*70)
        print("STEP 2: TRAINING MODEL")
        print("="*70)
        
        print(f"\nDataset sizes:")
        print(f"  Train: {len(X_train)} (Safe={np.sum(y_train==0)}, Unsafe={np.sum(y_train==1)})")
        print(f"  Val:   {len(X_val)} (Safe={np.sum(y_val==0)}, Unsafe={np.sum(y_val==1)})")
        print(f"  Test:  {len(X_test)} (Safe={np.sum(y_test==0)}, Unsafe={np.sum(y_test==1)})")
        
        # Standardize
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Calculate class weight
        class_weight = {0: 1.0, 1: np.sum(y_train==0) / np.sum(y_train==1)}
        print(f"\nClass weights: {class_weight}")
        
        # Train
        print("\nTraining RandomForest...")
        self.model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight=class_weight,
            random_state=42,
            n_jobs=-1
        )
        
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        print("\n" + "="*70)
        print("VALIDATION RESULTS")
        print("="*70)
        
        y_val_pred = self.model.predict(X_val_scaled)
        print(f"\nValidation Accuracy: {accuracy_score(y_val, y_val_pred):.4f}")
        print("\n" + classification_report(y_val, y_val_pred, target_names=['Safe', 'Unsafe']))
        
        cm_val = confusion_matrix(y_val, y_val_pred)
        val_unsafe_recall = cm_val[1,1] / (cm_val[1,1] + cm_val[1,0]) if (cm_val[1,1] + cm_val[1,0]) > 0 else 0
        print(f"⚠  Validation Unsafe Recall: {val_unsafe_recall:.4f}")
        
        print("\n" + "="*70)
        print("TEST RESULTS")
        print("="*70)
        
        y_test_pred = self.model.predict(X_test_scaled)
        print(f"\nTest Accuracy: {accuracy_score(y_test, y_test_pred):.4f}")
        print("\n" + classification_report(y_test, y_test_pred, target_names=['Safe', 'Unsafe']))
        
        cm_test = confusion_matrix(y_test, y_test_pred)
        print("\nConfusion Matrix:")
        print(cm_test)
        test_unsafe_recall = cm_test[1,1] / (cm_test[1,1] + cm_test[1,0]) if (cm_test[1,1] + cm_test[1,0]) > 0 else 0
        print(f"\n⚠  Test Unsafe Recall: {test_unsafe_recall:.4f}")
        
        # Visualize confusion matrix
        plt.figure(figsize=(10, 4))
        
        plt.subplot(1, 2, 1)
        sns.heatmap(cm_val, annot=True, fmt='d', cmap='Blues',
                   xticklabels=['Safe', 'Unsafe'], yticklabels=['Safe', 'Unsafe'])
        plt.title('Validation Confusion Matrix')
        plt.ylabel('True')
        plt.xlabel('Predicted')
        
        plt.subplot(1, 2, 2)
        sns.heatmap(cm_test, annot=True, fmt='d', cmap='Blues',
                   xticklabels=['Safe', 'Unsafe'], yticklabels=['Safe', 'Unsafe'])
        plt.title('Test Confusion Matrix')
        plt.ylabel('True')
        plt.xlabel('Predicted')
        
        plt.tight_layout()
        plt.savefig('confusion_matrices.png', dpi=150, bbox_inches='tight')
        plt.show()
        
        return {
            'val_accuracy': accuracy_score(y_val, y_val_pred),
            'val_unsafe_recall': val_unsafe_recall,
            'test_accuracy': accuracy_score(y_test, y_test_pred),
            'test_unsafe_recall': test_unsafe_recall
        }
    
    def save_model(self, path='baby_sleep_model.pkl'):
        """Save trained model."""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'version': '1.0',
            'date': '2025-10-16'
        }
        joblib.dump(model_data, path)
        print(f"\n✓ Model saved: {path}")
    
    def predict_image(self, image_path):
        """Predict on a single image."""
        landmarks = self.extract_landmarks(image_path)
        if landmarks is None:
            return None, None
        
        features = self.extract_engineered_features(landmarks)
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        
        prediction = self.model.predict(features_scaled)[0]
        probability = self.model.predict_proba(features_scaled)[0]
        
        return prediction, probability
    
    def close(self):
        """Clean up."""
        if self.pose:
            self.pose.close()


# ============================================================================
# SECTION 3: MAIN EXECUTION
# ============================================================================

def main():
    """Main execution pipeline."""
    
    print("\n" + "="*70)
    print("STARTING COMPLETE PIPELINE")
    print("="*70)
    
    # Configuration - CHANGE THIS TO YOUR KAGGLE DATASET PATH
    # After uploading dataset to Kaggle, the path will be:
    # /kaggle/input/your-dataset-name/
    
    # Option 1: For Kaggle (RECOMMENDED)
    KAGGLE_INPUT = "/kaggle/input/unsafe-dd"  # ← CHANGE THIS to your dataset name
    
    if Path(KAGGLE_INPUT).exists():
        print(f"✓ Using Kaggle input directory: {KAGGLE_INPUT}")
        SAFE_DIR = f"{KAGGLE_INPUT}/processed_Asleep"
        UNSAFE_DIR = f"{KAGGLE_INPUT}/processed_Unsafe"
    else:
        # Option 2: For local testing
        print("✓ Kaggle input not found, using local directories")
        SAFE_DIR = "processed_Asleep"
        UNSAFE_DIR = "processed_Unsafe"
    
    DATASET_DIR = "dataset_split"  # Output will be in /kaggle/working/
    
    # Check if source directories exist
    if not Path(SAFE_DIR).exists() or not Path(UNSAFE_DIR).exists():
        print(f"\n⚠  ERROR: Source directories not found!")
        print(f"  Expected: {SAFE_DIR}/ and {UNSAFE_DIR}/")
        print(f"\n📝 Instructions for Kaggle:")
        print(f"  1. Upload your dataset to Kaggle Datasets")
        print(f"  2. Add the dataset to your notebook")
        print(f"  3. Update KAGGLE_INPUT variable to: /kaggle/input/your-dataset-name")
        print(f"  4. Your dataset should contain:")
        print(f"     - processed_Asleep/ folder (safe images)")
        print(f"     - processed_Unsafe/ folder (unsafe images)")
        return
    
    # Step 1: Prepare dataset
    dataset_base = prepare_dataset(SAFE_DIR, UNSAFE_DIR, DATASET_DIR, target_unsafe=3000)
    
    # Step 2: Initialize detector
    detector = BabySleepPoseDetector()
    
    # Step 3: Build feature datasets
    print("\n" + "="*70)
    print("EXTRACTING FEATURES WITH MEDIAPIPE")
    print("="*70)
    
    X_train, y_train = detector.build_dataset(
        dataset_base / 'train' / 'safe',
        dataset_base / 'train' / 'unsafe'
    )
    
    X_val, y_val = detector.build_dataset(
        dataset_base / 'val' / 'safe',
        dataset_base / 'val' / 'unsafe'
    )
    
    X_test, y_test = detector.build_dataset(
        dataset_base / 'test' / 'safe',
        dataset_base / 'test' / 'unsafe'
    )
    
    print(f"\n✓ Feature extraction complete!")
    print(f"  Feature dimension: {X_train.shape[1]} (132 raw + 10 engineered)")
    
    # Step 4: Train model
    results = detector.train_model(X_train, y_train, X_val, y_val, X_test, y_test)
    
    # Step 5: Save model
    detector.save_model('baby_sleep_model.pkl')
    
    # Summary
    print("\n" + "="*70)
    print("TRAINING COMPLETE! 🎉")
    print("="*70)
    print(f"\nFinal Results:")
    print(f"  Validation Accuracy:      {results['val_accuracy']:.4f}")
    print(f"  Validation Unsafe Recall: {results['val_unsafe_recall']:.4f}")
    print(f"  Test Accuracy:            {results['test_accuracy']:.4f}")
    print(f"  Test Unsafe Recall:       {results['test_unsafe_recall']:.4f} ⭐")
    
    print(f"\nModel saved: baby_sleep_model.pkl")
    print(f"Download this file to use for inference!")
    
    detector.close()
    
    return detector, results


# ============================================================================
# RUN THE PIPELINE
# ============================================================================

if _name_ == "_main_":
    detector, results = main()