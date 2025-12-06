"""
Baby Sleep Position Safety Detection System - Complete Kaggle Version
======================================================================

This single file includes:
1. Data augmentation and train/val/test splitting
2. MediaPipe Pose landmark extraction
3. Feature engineering (142 features)
4. RandomForest training with learning curve graphs
5. Model evaluation and saving
6. Single image testing capability

Usage on Kaggle:
1. Upload your dataset (processed_Asleep/ and processed_Unsafe/ folders)
2. Run all cells
3. Model will be saved as baby_sleep_model.pkl

Author: GitHub Copilot (Enhanced by GPT-5)
Date: October 2025
"""

# ============================================================================
# INSTALLS & IMPORTS
# ============================================================================

try:
    import mediapipe as mp
except ImportError:
    print("MediaPipe not found. Installing...")
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "mediapipe"])
    import mediapipe as mp
    print("✓ MediaPipe installed successfully!")

import os
import cv2
import joblib
import numpy as np
import random
import shutil
import warnings
from pathlib import Path
from tqdm.notebook import tqdm
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

warnings.filterwarnings('ignore')

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
            M = cv2.getRotationMatrix2D((w/2, h/2), random.uniform(10, 15), 1.0)
            return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        elif augmentation_type == 'rotate_right':
            M = cv2.getRotationMatrix2D((w/2, h/2), random.uniform(-15, -10), 1.0)
            return cv2.warpAffine(image, M, (w, h), borderMode=cv2.BORDER_REFLECT)
        elif augmentation_type == 'brightness_up':
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 2] = np.clip(hsv[:, :, 2] * random.uniform(1.1, 1.3), 0, 255)
            return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        elif augmentation_type == 'brightness_down':
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV).astype(np.float32)
            hsv[:, :, 2] *= random.uniform(0.7, 0.9)
            return cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
        elif augmentation_type == 'noise':
            noise = np.random.normal(0, 15, image.shape).astype(np.float32)
            noisy = np.clip(image.astype(np.float32) + noise, 0, 255).astype(np.uint8)
            return noisy
        elif augmentation_type == 'zoom_in':
            crop_ratio = random.uniform(0.85, 0.95)
            crop_h, crop_w = int(h * crop_ratio), int(w * crop_ratio)
            start_y, start_x = (h - crop_h)//2, (w - crop_w)//2
            cropped = image[start_y:start_y+crop_h, start_x:start_x+crop_w]
            return cv2.resize(cropped, (w, h))
        elif augmentation_type == 'contrast':
            alpha = random.uniform(1.1, 1.4)
            return cv2.convertScaleAbs(image, alpha=alpha, beta=0)
        return image
    
    def augment_dataset(self, source_dir, output_dir, target_count):
        """Augment images to reach target count."""
        src, out = Path(source_dir), Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        imgs = list(src.glob(".jpg")) + list(src.glob(".png")) + list(src.glob("*.jpeg"))
        orig_count = len(imgs)
        print(f"  Original images: {orig_count}")
        if orig_count == 0: return []
        for img_path in imgs:
            shutil.copy2(img_path, out / img_path.name)
        needed = max(0, target_count - orig_count)
        print(f"  Augmenting: {needed} images")
        aug_types = ['flip','rotate_left','rotate_right','brightness_up',
                     'brightness_down','noise','zoom_in','contrast']
        for i in tqdm(range(needed), desc="  Augmenting"):
            img_path = random.choice(imgs)
            img = cv2.imread(str(img_path))
            if img is None: continue
            aug_type = random.choice(aug_types)
            aug = self.augment_image(img, aug_type)
            new_name = f"{img_path.stem}aug{i:04d}_{aug_type}{img_path.suffix}"
            cv2.imwrite(str(out / new_name), aug)
        return out


def prepare_dataset(safe_dir, unsafe_dir, output_dir="dataset_split", target_unsafe=3000, train_ratio=0.7, val_ratio=0.15):
    """Prepare dataset with augmentation & splitting."""
    print("\n" + "="*70)
    print("STEP 1: DATA AUGMENTATION & PREPARATION")
    print("="*70)
    print(f"\nOriginal dataset:")
    safe_count = len(list(Path(safe_dir).glob(".jpg"))) + len(list(Path(safe_dir).glob(".png")))
    unsafe_count = len(list(Path(unsafe_dir).glob(".jpg"))) + len(list(Path(unsafe_dir).glob(".png")))
    print(f"  Safe: {safe_count}, Unsafe: {unsafe_count}")
    print(f"  Ratio: {safe_count/unsafe_count:.2f}:1")
    
    augmentor = DataAugmentor(seed=42)
    print("\nAugmenting UNSAFE class...")
    aug_unsafe = Path("augmented_data/unsafe")
    augmentor.augment_dataset(unsafe_dir, aug_unsafe, target_unsafe)
    
    print("\nCopying SAFE class...")
    aug_safe = Path("augmented_data/safe")
    aug_safe.mkdir(parents=True, exist_ok=True)
    for p in Path(safe_dir).glob("."):
        if p.suffix.lower() in ['.jpg','.png']:
            shutil.copy2(p, aug_safe / p.name)
    
    print("\nSplitting into train/val/test...")
    base = Path(output_dir)
    test_ratio = 1.0 - train_ratio - val_ratio
    random.seed(42)
    
    for cls, src in [('safe', aug_safe), ('unsafe', aug_unsafe)]:
        imgs = list(src.glob(".jpg")) + list(src.glob(".png"))
        random.shuffle(imgs)
        total = len(imgs)
        tr_end, val_end = int(total*train_ratio), int(total*(train_ratio+val_ratio))
        parts = {'train': imgs[:tr_end], 'val': imgs[tr_end:val_end], 'test': imgs[val_end:]}
        for split, lst in parts.items():
            d = base/split/cls
            d.mkdir(parents=True, exist_ok=True)
            for i in lst:
                shutil.copy2(i, d/i.name)
        print(f"  {cls}: train={len(parts['train'])}, val={len(parts['val'])}, test={len(parts['test'])}")
    print("\n✓ Dataset preparation complete!")
    return base


# ============================================================================
# SECTION 2: MEDIAPIPE POSE & MODEL
# ============================================================================

class BabySleepPoseDetector:
    def _init_(self):
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(static_image_mode=True, model_complexity=1, min_detection_confidence=0.5)
        self.model, self.scaler = None, None
    
    def extract_landmarks(self, img_path):
        img = cv2.imread(str(img_path))
        if img is None: return None
        res = self.pose.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        if not res.pose_landmarks: return None
        lm = []
        for l in res.pose_landmarks.landmark:
            lm.extend([l.x, l.y, l.z, l.visibility])
        return np.array(lm)
    
    def extract_engineered_features(self, lm):
        lm = lm.reshape(33,4)
        feats = list(lm.flatten())
        nose, ls, rs, lh, rh = 0,11,12,23,24
        feats += [
            (lm[ls,2]+lm[rs,2])/2, (lm[lh,2]+lm[rh,2])/2,
            ((lm[ls,2]+lm[rs,2])/2)-((lm[lh,2]+lm[rh,2])/2),
            np.arctan2((lm[nose,1]-((lm[lh,1]+lm[rh,1])/2)), (lm[nose,0]-((lm[lh,0]+lm[rh,0])/2))),
            abs(lm[ls,0]-lm[rs,0]), abs(lm[lh,0]-lm[rh,0]),
            abs(np.mean([lm[ls,3],lm[lh,3]]) - np.mean([lm[rs,3],lm[rh,3]])),
            np.mean(lm[:,3]), lm[nose,1],
            np.linalg.norm(lm[nose,:3]-((lm[lh,:3]+lm[rh,:3])/2))
        ]
        return np.array(feats)
    
    def build_dataset(self, safe, unsafe):
        X, y = [], []
        for img in tqdm(list(Path(safe).glob(".")), desc="Safe"):
            lm = self.extract_landmarks(img)
            if lm is not None: X.append(self.extract_engineered_features(lm)); y.append(0)
        for img in tqdm(list(Path(unsafe).glob(".")), desc="Unsafe"):
            lm = self.extract_landmarks(img)
            if lm is not None: X.append(self.extract_engineered_features(lm)); y.append(1)
        return np.array(X), np.array(y)
    
    def train_model(self, X_train, y_train, X_val, y_val, X_test, y_test):
        print("\n" + "="*70)
        print("STEP 2: TRAINING MODEL")
        print("="*70)
        
        self.scaler = StandardScaler()
        X_train = self.scaler.fit_transform(X_train)
        X_val = self.scaler.transform(X_val)
        X_test = self.scaler.transform(X_test)
        
        cw = {0:1.0, 1:np.sum(y_train==0)/np.sum(y_train==1)}
        self.model = RandomForestClassifier(n_estimators=200, max_depth=15,
                                            min_samples_split=5, min_samples_leaf=2,
                                            class_weight=cw, random_state=42, n_jobs=-1)
        
        # --- Learning curve ---
        sizes = np.linspace(0.1,1.0,8)
        tr_acc, val_acc = [], []
        for f in sizes:
            n = int(len(X_train)*f)
            self.model.fit(X_train[:n], y_train[:n])
            tr_acc.append(accuracy_score(y_train[:n], self.model.predict(X_train[:n])))
            val_acc.append(accuracy_score(y_val, self.model.predict(X_val)))
        
        plt.figure(figsize=(7,5))
        plt.plot(sizes*100, tr_acc, 'o-', label='Train Accuracy')
        plt.plot(sizes*100, val_acc, 'o-', label='Validation Accuracy')
        plt.plot(sizes*100, 1-np.array(tr_acc), 'o--', label='Train Loss (1-acc)')
        plt.plot(sizes*100, 1-np.array(val_acc), 'o--', label='Val Loss (1-acc)')
        plt.xlabel('Training Data Used (%)')
        plt.ylabel('Metric Value')
        plt.title('Learning Curve (Accuracy & Loss)')
        plt.legend()
        plt.grid(True, linestyle='--', alpha=0.6)
        plt.tight_layout()
        plt.savefig('learning_curve.png', dpi=150)
        plt.show()
        
        # --- Final Training ---
        self.model.fit(X_train, y_train)
        yv, yt = self.model.predict(X_val), self.model.predict(X_test)
        cmv, cmt = confusion_matrix(y_val, yv), confusion_matrix(y_test, yt)
        
        print("\nValidation Accuracy:", accuracy_score(y_val, yv))
        print(classification_report(y_val, yv))
        print("\nTest Accuracy:", accuracy_score(y_test, yt))
        print(classification_report(y_test, yt))
        
        plt.figure(figsize=(10,4))
        plt.subplot(1,2,1)
        sns.heatmap(cmv, annot=True, fmt='d', cmap='Blues')
        plt.title("Validation Confusion Matrix")
        plt.subplot(1,2,2)
        sns.heatmap(cmt, annot=True, fmt='d', cmap='Blues')
        plt.title("Test Confusion Matrix")
        plt.tight_layout()
        plt.savefig("confusion_matrices.png", dpi=150)
        plt.show()
        
        return {
            "val_acc": accuracy_score(y_val, yv),
            "test_acc": accuracy_score(y_test, yt)
        }
    
    def save_model(self, path='baby_sleep_model.pkl'):
        joblib.dump({'model':self.model,'scaler':self.scaler}, path)
        print(f"\n✓ Model saved at {path}")
    
    def predict_image(self, path):
        lm = self.extract_landmarks(path)
        if lm is None: return None
        f = self.extract_engineered_features(lm)
        f = self.scaler.transform(f.reshape(1,-1))
        pred = self.model.predict(f)[0]
        prob = self.model.predict_proba(f)[0]
        return pred, prob


# ============================================================================
# SECTION 3: MAIN EXECUTION
# ============================================================================

def main():
    print("\n" + "="*70)
    print("STARTING COMPLETE PIPELINE")
    print("="*70)
    
    KAGGLE_INPUT = "/kaggle/input/unsafe-dd"  # change to your Kaggle dataset
    if Path(KAGGLE_INPUT).exists():
        SAFE = f"{KAGGLE_INPUT}/processed_Asleep"
        UNSAFE = f"{KAGGLE_INPUT}/processed_Unsafe"
    else:
        SAFE, UNSAFE = "processed_Asleep", "processed_Unsafe"
    
    if not Path(SAFE).exists() or not Path(UNSAFE).exists():
        print("\n⚠ ERROR: Dataset folders missing.")
        return
    
    data_dir = prepare_dataset(SAFE, UNSAFE, "dataset_split", target_unsafe=3000)
    det = BabySleepPoseDetector()
    
    print("\nExtracting features...")
    Xtr, ytr = det.build_dataset(data_dir/'train'/'safe', data_dir/'train'/'unsafe')
    Xv, yv = det.build_dataset(data_dir/'val'/'safe', data_dir/'val'/'unsafe')
    Xt, yt = det.build_dataset(data_dir/'test'/'safe', data_dir/'test'/'unsafe')
    
    results = det.train_model(Xtr, ytr, Xv, yv, Xt, yt)
    det.save_model()
    print("\nFinal Results:", results)
    return det, results


if _name_ == "_main_":
    detector, results = main()