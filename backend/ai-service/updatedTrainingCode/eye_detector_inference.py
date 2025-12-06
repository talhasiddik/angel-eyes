"""
Eye Detector Inference on Baby Video
Tests the trained eye detector (eye_detector_best.h5) on baby.mp4
"""

import os
import cv2
import numpy as np
import tensorflow as tf
from tensorflow import keras
import mediapipe as mp
import pickle

print("Eye Detector Inference")
print("="*70)

# Configuration
VIDEO_PATH = r"D:\datasets\final datasets\baby4.mp4"
MODEL_PATH = r"d:\datasets\final datasets\all models\eye_detector_best.h5"
CONFIG_PATH = r"d:\datasets\final datasets\all models\eye_config.pkl"
IMG_SIZE = 64

# Initialize MediaPipe Face Mesh for eye detection
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Load model
print(f"\nLoading model from: {MODEL_PATH}")
model = keras.models.load_model(MODEL_PATH)
print("✓ Model loaded successfully")

# Eye landmarks indices (MediaPipe Face Mesh)
LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]

def extract_eye_region(frame, landmarks, eye_indices, padding=20):
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

def predict_eye_state(eye_img):
    """Predict if eye is open or closed"""
    if eye_img is None:
        return None, 0.0
    
    # Preprocess
    eye_img = cv2.resize(eye_img, (IMG_SIZE, IMG_SIZE))
    eye_img = cv2.cvtColor(eye_img, cv2.COLOR_BGR2RGB)
    eye_img = eye_img / 255.0
    eye_img = np.expand_dims(eye_img, axis=0)
    
    # Predict
    prediction = model.predict(eye_img, verbose=0)[0]
    
    # Class 0 = closed, Class 1 = open
    is_open = prediction[1] > prediction[0]
    confidence = prediction[1] if is_open else prediction[0]
    
    return is_open, confidence

def process_video():
    """Process video and detect eye states"""
    
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        print(f"✗ Error: Cannot open video {VIDEO_PATH}")
        return
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"\nVideo: {VIDEO_PATH}")
    print(f"FPS: {fps} | Total Frames: {total_frames}")
    print("\nProcessing...\n")
    
    frame_count = 0
    eyes_open_count = 0
    eyes_closed_count = 0
    no_face_count = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        
        # Convert to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = face_mesh.process(rgb_frame)
        
        if results.multi_face_landmarks:
            landmarks = results.multi_face_landmarks[0].landmark
            
            # Extract and predict for both eyes
            left_eye_result = extract_eye_region(frame, landmarks, LEFT_EYE_INDICES)
            right_eye_result = extract_eye_region(frame, landmarks, RIGHT_EYE_INDICES)
            
            predictions = []
            
            # Left eye
            if left_eye_result:
                left_eye_img, left_bbox = left_eye_result
                left_open, left_conf = predict_eye_state(left_eye_img)
                if left_open is not None:
                    predictions.append((left_open, left_conf))
                    # Draw bbox
                    color = (0, 255, 0) if left_open else (0, 0, 255)
                    cv2.rectangle(frame, (left_bbox[0], left_bbox[1]), 
                                (left_bbox[2], left_bbox[3]), color, 2)
            
            # Right eye
            if right_eye_result:
                right_eye_img, right_bbox = right_eye_result
                right_open, right_conf = predict_eye_state(right_eye_img)
                if right_open is not None:
                    predictions.append((right_open, right_conf))
                    # Draw bbox
                    color = (0, 255, 0) if right_open else (0, 0, 255)
                    cv2.rectangle(frame, (right_bbox[0], right_bbox[1]), 
                                (right_bbox[2], right_bbox[3]), color, 2)
            
            # Final decision: both eyes must be open for "eyes open"
            if predictions:
                eyes_open = all(p[0] for p in predictions)
                avg_conf = sum(p[1] for p in predictions) / len(predictions)
                
                if eyes_open:
                    eyes_open_count += 1
                    status = "EYES OPEN"
                    color = (0, 255, 0)
                else:
                    eyes_closed_count += 1
                    status = "EYES CLOSED"
                    color = (0, 0, 255)
                
                # Display on frame
                cv2.putText(frame, status, (10, 30), 
                          cv2.FONT_HERSHEY_SIMPLEX, 1, color, 2)
                cv2.putText(frame, f"Conf: {avg_conf:.2f}", (10, 60), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        else:
            no_face_count += 1
            cv2.putText(frame, "NO FACE DETECTED", (10, 30), 
                      cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
        
        # Show frame
        cv2.imshow('Eye Detector', frame)
        
        # Progress
        if frame_count % 30 == 0:
            print(f"Frame {frame_count}/{total_frames} | "
                  f"Open: {eyes_open_count} | Closed: {eyes_closed_count} | "
                  f"No Face: {no_face_count}")
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    
    # Final statistics
    print("\n" + "="*70)
    print("FINAL RESULTS")
    print("="*70)
    print(f"Total Frames: {frame_count}")
    print(f"Eyes Open: {eyes_open_count} ({eyes_open_count/frame_count*100:.1f}%)")
    print(f"Eyes Closed: {eyes_closed_count} ({eyes_closed_count/frame_count*100:.1f}%)")
    print(f"No Face: {no_face_count} ({no_face_count/frame_count*100:.1f}%)")
    
    # Conclusion
    if eyes_closed_count > eyes_open_count * 1.5:
        print("\n🌙 Baby is likely ASLEEP (eyes mostly closed)")
    elif eyes_open_count > eyes_closed_count * 1.5:
        print("\n👁️ Baby is likely AWAKE (eyes mostly open)")
    else:
        print("\n😴 Baby state is UNCERTAIN (mixed signals)")

if __name__ == "__main__":
    process_video()
