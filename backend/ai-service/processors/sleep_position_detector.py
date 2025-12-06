"""
Sleep Position Safety Detector
Detects if baby's sleeping position is safe or unsafe using pose landmarks
"""

import cv2
import numpy as np
import mediapipe as mp
import joblib
from pathlib import Path

class SleepPositionDetector:
    """Detects safe/unsafe sleeping position using MediaPipe pose and trained model"""
    
    def __init__(self):
        """Initialize detector with MediaPipe and trained model"""
        self.model = None
        self.scaler = None
        self.mp_pose = None
        self.pose = None
        
        self._load_model()
    
    def _load_model(self):
        """Load sleep position model"""
        try:
            model_path = Path(__file__).parent.parent / 'updatedModels' / 'baby_sleep_model.pkl'
            
            if not model_path.exists():
                print(f"⚠️  Sleep position model not found at {model_path}")
                return False
            
            # Load model and scaler
            model_data = joblib.load(str(model_path))
            self.model = model_data['model']
            self.scaler = model_data['scaler']
            
            # Initialize MediaPipe Pose
            self.mp_pose = mp.solutions.pose
            self.pose = self.mp_pose.Pose(
                static_image_mode=False,
                model_complexity=1,
                enable_segmentation=False,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            print("✅ Sleep position detector loaded")
            return True
            
        except Exception as e:
            print(f"❌ Error loading sleep position detector: {e}")
            return False
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None and self.scaler is not None and self.pose is not None
    
    def extract_landmarks(self, frame):
        """Extract pose landmarks from frame"""
        try:
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.pose.process(image_rgb)
            
            if results.pose_landmarks:
                landmarks = []
                for landmark in results.pose_landmarks.landmark:
                    landmarks.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
                return np.array(landmarks), results.pose_landmarks
            return None, None
        except Exception as e:
            print(f"Error extracting landmarks: {e}")
            return None, None
    
    def extract_engineered_features(self, landmarks):
        """Extract 142 features (132 raw + 10 engineered)"""
        try:
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
        except Exception as e:
            print(f"Error extracting features: {e}")
            return None
    
    def detect(self, frame):
        """
        Detect sleep position safety from video frame
        
        Args:
            frame: BGR image from webcam
            
        Returns:
            dict with detection results
        """
        if not self.is_loaded():
            return {
                'success': False,
                'position': 'unknown',
                'is_safe': False,
                'confidence': 0.0,
                'error': 'Model not loaded'
            }
        
        try:
            # Extract landmarks
            landmarks, pose_landmarks = self.extract_landmarks(frame)
            
            if landmarks is None:
                return {
                    'success': False,
                    'position': 'unknown',
                    'is_safe': False,
                    'confidence': 0.0,
                    'error': 'No pose detected'
                }
            
            # Extract features
            features = self.extract_engineered_features(landmarks)
            if features is None:
                return {
                    'success': False,
                    'position': 'unknown',
                    'is_safe': False,
                    'confidence': 0.0,
                    'error': 'Feature extraction failed'
                }
            
            # Scale features
            features_scaled = self.scaler.transform(features.reshape(1, -1))
            
            # Predict
            prediction = self.model.predict(features_scaled)[0]
            probability = self.model.predict_proba(features_scaled)[0]
            
            # prediction: 0 = SAFE, 1 = UNSAFE
            is_safe = (prediction == 0)
            confidence = probability[prediction]
            
            # Determine position description
            if is_safe:
                position = 'back'  # Safe position is typically back sleeping
            else:
                position = 'stomach'  # Unsafe is typically stomach sleeping
            
            return {
                'success': True,
                'position': position,
                'is_safe': bool(is_safe),
                'confidence': float(confidence),
                'probabilities': {
                    'safe': float(probability[0]),
                    'unsafe': float(probability[1])
                }
            }
            
        except Exception as e:
            return {
                'success': False,
                'position': 'unknown',
                'is_safe': False,
                'confidence': 0.0,
                'error': str(e)
            }
