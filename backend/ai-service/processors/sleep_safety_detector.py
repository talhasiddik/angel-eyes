"""
Sleep Safety Detection Processor
Based on baby_sleep_model.pkl trained with MediaPipe Pose + RandomForest
Detects: Safe vs Unsafe sleeping positions
"""

import pickle
import numpy as np
import cv2
import os
import joblib

try:
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    print("⚠️  MediaPipe not available - install with: pip install mediapipe")

class SleepSafetyDetector:
    def __init__(self):
        self.model_path = os.path.join('models', 'baby_sleep_model.pkl')
        self.model = None
        self.scaler = None
        
        # Initialize MediaPipe Pose
        if MEDIAPIPE_AVAILABLE:
            self.mp_pose = mp.solutions.pose
            self.pose = self.mp_pose.Pose(
                static_image_mode=True,
                model_complexity=1,
                enable_segmentation=False,
                min_detection_confidence=0.5
            )
        else:
            self.mp_pose = None
            self.pose = None
        
        self.load_model()
    
    def load_model(self):
        """Load the .pkl model (RandomForest + Scaler)"""
        try:
            if os.path.exists(self.model_path):
                model_data = joblib.load(self.model_path)
                
                # Handle different model formats
                if isinstance(model_data, dict):
                    self.model = model_data.get('model')
                    self.scaler = model_data.get('scaler')
                else:
                    # Old format - just the model
                    self.model = model_data
                    self.scaler = None
                
                print(f"✅ Sleep safety model loaded from {self.model_path}")
                
                if not MEDIAPIPE_AVAILABLE:
                    print("⚠️  MediaPipe not available - model loaded but cannot extract features")
            else:
                print(f"⚠️  Sleep safety model not found at {self.model_path}")
                print(f"   Place your baby_sleep_model.pkl in the models/ folder")
                self.model = None
        except Exception as e:
            print(f"❌ Error loading sleep safety model: {e}")
            self.model = None
    
    def is_loaded(self):
        """Check if model and MediaPipe are ready"""
        return self.model is not None and MEDIAPIPE_AVAILABLE
    
    def extract_landmarks(self, frame):
        """Extract MediaPipe Pose landmarks from frame (33 landmarks × 4 = 132 values)"""
        if not MEDIAPIPE_AVAILABLE or self.pose is None:
            return None
        
        try:
            # Convert BGR to RGB for MediaPipe
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.pose.process(image_rgb)
            
            if results.pose_landmarks:
                landmarks = []
                for landmark in results.pose_landmarks.landmark:
                    landmarks.extend([
                        landmark.x,
                        landmark.y,
                        landmark.z,
                        landmark.visibility
                    ])
                return np.array(landmarks)
            
            return None
        except Exception as e:
            print(f"❌ Landmark extraction error: {e}")
            return None
    
    def extract_engineered_features(self, landmarks):
        """
        Extract 142 features (132 raw + 10 engineered)
        Based on training code from unsafe.py
        """
        # Reshape to (33 landmarks, 4 values each)
        lm = landmarks.reshape(33, 4)
        
        # Start with raw landmarks
        features = list(landmarks)
        
        # Key landmark indices (MediaPipe Pose topology)
        nose = 0
        left_shoulder, right_shoulder = 11, 12
        left_hip, right_hip = 23, 24
        left_knee, right_knee = 25, 26
        
        # === 10 Engineered Features (from training code) ===
        
        # 1. Average shoulder Z (depth)
        shoulder_z = (lm[left_shoulder, 2] + lm[right_shoulder, 2]) / 2
        features.append(shoulder_z)
        
        # 2. Average hip Z (depth)
        hip_z = (lm[left_hip, 2] + lm[right_hip, 2]) / 2
        features.append(hip_z)
        
        # 3. Z difference between shoulders and hips
        z_diff_shoulder_hip = shoulder_z - hip_z
        features.append(z_diff_shoulder_hip)
        
        # 4. Torso angle (orientation)
        torso_vector = lm[nose, :2] - (lm[left_hip, :2] + lm[right_hip, :2]) / 2
        torso_angle = np.arctan2(torso_vector[1], torso_vector[0])
        features.append(torso_angle)
        
        # 5. Shoulder width
        shoulder_width = abs(lm[left_shoulder, 0] - lm[right_shoulder, 0])
        features.append(shoulder_width)
        
        # 6. Hip width
        hip_width = abs(lm[left_hip, 0] - lm[right_hip, 0])
        features.append(hip_width)
        
        # 7. Left-right visibility symmetry
        left_vis = np.mean([lm[left_shoulder, 3], lm[left_hip, 3], lm[left_knee, 3]])
        right_vis = np.mean([lm[right_shoulder, 3], lm[right_hip, 3], lm[right_knee, 3]])
        symmetry = abs(left_vis - right_vis)
        features.append(symmetry)
        
        # 8. Average visibility across all landmarks
        avg_visibility = np.mean(lm[:, 3])
        features.append(avg_visibility)
        
        # 9. Nose Y position (vertical position)
        features.append(lm[nose, 1])
        
        # 10. Nose to hip distance (body compactness)
        avg_hip_pos = (lm[left_hip, :3] + lm[right_hip, :3]) / 2
        nose_hip_dist = np.linalg.norm(lm[nose, :3] - avg_hip_pos)
        features.append(nose_hip_dist)
        
        return np.array(features)
    
    def detect(self, frame):
        """
        Detect sleep safety from a video frame
        Returns: dict with detection results
        """
        # Mock mode if model not loaded
        if not self.is_loaded():
            return {
                'is_safe': True,
                'confidence': 0.85,
                'status': 'mock',
                'message': 'MediaPipe or model not loaded - using mock detection',
                'alert_level': 'info',
                'position': 'unknown'
            }
        
        try:
            # Step 1: Extract MediaPipe landmarks
            landmarks = self.extract_landmarks(frame)
            
            if landmarks is None:
                return {
                    'is_safe': True,
                    'confidence': 0.0,
                    'status': 'no_detection',
                    'message': 'No baby detected in frame',
                    'alert_level': 'warning',
                    'position': 'not_visible'
                }
            
            # Step 2: Extract engineered features (142 total)
            features = self.extract_engineered_features(landmarks)
            
            # Step 3: Scale features if scaler available
            if self.scaler is not None:
                features_scaled = self.scaler.transform(features.reshape(1, -1))
            else:
                features_scaled = features.reshape(1, -1)
            
            # Step 4: Predict with RandomForest
            prediction = self.model.predict(features_scaled)[0]
            probabilities = self.model.predict_proba(features_scaled)[0]
            
            # prediction: 0 = Safe, 1 = Unsafe
            is_safe = (prediction == 0)
            confidence = float(probabilities[prediction])
            unsafe_probability = float(probabilities[1])
            
            # Determine alert level based on unsafe probability
            if unsafe_probability > 0.8:
                alert_level = 'critical'
            elif unsafe_probability > 0.6:
                alert_level = 'warning'
            else:
                alert_level = 'normal'
            
            # Position classification (simple heuristic based on features)
            position = self._classify_position(features_scaled[0])
            
            return {
                'is_safe': is_safe,
                'confidence': confidence,
                'unsafe_probability': unsafe_probability,
                'status': 'detected',
                'alert_level': alert_level,
                'position': position,
                'message': 'Unsafe sleeping position detected!' if not is_safe else 'Safe position'
            }
            
        except Exception as e:
            print(f"❌ Sleep safety detection error: {e}")
            return {
                'is_safe': True,
                'confidence': 0.0,
                'status': 'error',
                'error': str(e),
                'alert_level': 'error',
                'position': 'unknown'
            }
    
    def _classify_position(self, features):
        """
        Classify sleep position based on features
        Simple heuristic - can be improved
        """
        try:
            # Z-difference between shoulders and hips (feature index 134)
            z_diff = features[134] if len(features) > 134 else 0
            
            # Torso angle (feature index 135)
            torso_angle = features[135] if len(features) > 135 else 0
            
            # Simple classification
            if abs(z_diff) < 0.05:
                return 'back_sleeping'
            elif z_diff > 0.1:
                return 'side_sleeping'
            elif abs(torso_angle) > 1.2:
                return 'prone_face_down'
            else:
                return 'normal'
        except:
            return 'unknown'
    
    def __del__(self):
        """Cleanup MediaPipe resources"""
        if self.pose:
            self.pose.close()
