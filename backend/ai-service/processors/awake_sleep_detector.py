"""
Awake/Sleep Detector using Eye State Detection
Detects if baby is awake or asleep by analyzing eye state from video frames

NOTE: Eye detector model (eye_detector_best.h5) was trained with Keras 2.x
and is incompatible with Keras 3.x due to 'batch_shape' parameter deprecation.

TEMPORARY SOLUTION: Model needs to be retrained with TensorFlow 2.15+ / Keras 3.x
ALTERNATIVE: Use temporal_movement_detector.py approach (movement-based detection)

For now, this detector will return a placeholder response.
"""

import cv2
import numpy as np
import mediapipe as mp
from tensorflow import keras
import os
from pathlib import Path

class AwakeSleepDetector:
    """Detects awake/sleep state using eye detection"""
    
    def __init__(self):
        """Initialize detector with MediaPipe and eye detection model"""
        self.model = None
        self.face_mesh = None
        self.IMG_SIZE = 64
        
        # Eye landmarks indices (MediaPipe Face Mesh)
        self.LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
        self.RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
        
        self._load_model()
    
    def _load_model(self):
        """Load eye detector model (Keras 3.x compatible)"""
        try:
            # Try new Keras 3.x model first (.keras format)
            model_path_keras = Path(__file__).parent.parent / 'updatedModels' / 'v2' / 'eye_detector.keras'
            model_path_h5 = Path(__file__).parent.parent / 'updatedModels' / 'v2' / 'eye_detector (1).h5'
            
            model_path = None
            if model_path_keras.exists():
                model_path = model_path_keras
                print(f"🔄 Loading eye detector model (Keras 3.x format) from {model_path}...")
            elif model_path_h5.exists():
                model_path = model_path_h5
                print(f"🔄 Loading eye detector model (H5 format) from {model_path}...")
            else:
                print(f"⚠️  Eye detector model not found")
                return False
            
            # Load model
            self.model = keras.models.load_model(str(model_path), compile=False)
            
            # Compile with current Keras
            self.model.compile(
                optimizer='adam',
                loss='categorical_crossentropy',
                metrics=['accuracy']
            )
            
            # Initialize MediaPipe Face Mesh
            mp_face_mesh = mp.solutions.face_mesh
            self.face_mesh = mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            print("✅ Eye detector (awake/sleep) loaded successfully")
            return True
            
        except Exception as e:
            print(f"❌ Error loading eye detector: {e}")
            print("   Awake/sleep detection will be unavailable")
            import traceback
            traceback.print_exc()
            return False
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None and self.face_mesh is not None
    
    def extract_eye_region(self, frame, landmarks, eye_indices, padding=20):
        """Extract eye region from frame using landmarks"""
        h, w = frame.shape[:2]
        
        # Get eye coordinates
        eye_points = []
        for idx in eye_indices:
            landmark = landmarks[idx]
            x = int(landmark.x * w)
            y = int(landmark.y * h)
            eye_points.append((x, y))
        
        if not eye_points:
            return None
        
        # Get bounding box
        eye_points = np.array(eye_points)
        x_min, y_min = eye_points.min(axis=0)
        x_max, y_max = eye_points.max(axis=0)
        
        # Add padding
        x_min = max(0, x_min - padding)
        y_min = max(0, y_min - padding)
        x_max = min(w, x_max + padding)
        y_max = min(h, y_max + padding)
        
        # Extract region
        eye_region = frame[y_min:y_max, x_min:x_max]
        
        if eye_region.size == 0:
            return None
        
        return eye_region, (x_min, y_min, x_max, y_max)
    
    def predict_eye_state(self, eye_img):
        """Predict if eye is open or closed"""
        if eye_img is None or self.model is None:
            return None, 0.0
        
        try:
            # Preprocess
            eye_img = cv2.resize(eye_img, (self.IMG_SIZE, self.IMG_SIZE))
            eye_img = cv2.cvtColor(eye_img, cv2.COLOR_BGR2RGB)
            eye_img = eye_img / 255.0
            eye_img = np.expand_dims(eye_img, axis=0)
            
            # Predict
            prediction = self.model.predict(eye_img, verbose=0)[0]
            
            # Class 0 = closed, Class 1 = open
            is_open = prediction[1] > prediction[0]
            confidence = prediction[1] if is_open else prediction[0]
            
            return is_open, confidence
        except Exception as e:
            print(f"Error predicting eye state: {e}")
            return None, 0.0
    
    def detect(self, frame):
        """
        Detect awake/sleep state from video frame
        
        Args:
            frame: BGR image from webcam
            
        Returns:
            dict with detection results
        """
        if not self.is_loaded():
            return {
                'success': False,
                'state': 'unknown',
                'confidence': 0.0,
                'error': 'Model not loaded'
            }
        
        try:
            # Convert to RGB for MediaPipe
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_frame)
            
            if not results.multi_face_landmarks:
                return {
                    'success': False,
                    'state': 'unknown',
                    'confidence': 0.0,
                    'error': 'No face detected'
                }
            
            landmarks = results.multi_face_landmarks[0].landmark
            
            # Extract and predict for both eyes
            predictions = []
            
            # Left eye
            left_eye_result = self.extract_eye_region(frame, landmarks, self.LEFT_EYE_INDICES)
            if left_eye_result:
                left_eye_img, _ = left_eye_result
                left_open, left_conf = self.predict_eye_state(left_eye_img)
                if left_open is not None:
                    predictions.append((left_open, left_conf))
            
            # Right eye
            right_eye_result = self.extract_eye_region(frame, landmarks, self.RIGHT_EYE_INDICES)
            if right_eye_result:
                right_eye_img, _ = right_eye_result
                right_open, right_conf = self.predict_eye_state(right_eye_img)
                if right_open is not None:
                    predictions.append((right_open, right_conf))
            
            if not predictions:
                return {
                    'success': False,
                    'state': 'unknown',
                    'confidence': 0.0,
                    'error': 'Could not detect eyes'
                }
            
            # Final decision: both eyes must be open for "awake"
            eyes_open = all(p[0] for p in predictions)
            avg_confidence = sum(p[1] for p in predictions) / len(predictions)
            
            state = 'awake' if eyes_open else 'asleep'
            
            return {
                'success': True,
                'state': state,
                'confidence': float(avg_confidence),
                'eyes_detected': len(predictions),
                'left_eye_open': predictions[0][0] if len(predictions) > 0 else None,
                'right_eye_open': predictions[1][0] if len(predictions) > 1 else None
            }
            
        except Exception as e:
            return {
                'success': False,
                'state': 'unknown',
                'confidence': 0.0,
                'error': str(e)
            }
