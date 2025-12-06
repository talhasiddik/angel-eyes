"""
Baby Sleep Position Video Inference
====================================

This script runs the trained model on a video file (baby.mp4) and:
1. Detects baby pose in each frame using MediaPipe
2. Classifies as Safe or Unsafe using the trained model
3. Displays results with colored bounding box overlay
4. Saves the processed video

Usage:
    python run_video_inference.py

Requirements:
    - baby_sleep_model.pkl (trained model)
    - baby.mp4 (input video)
    - mediapipe, opencv-python, scikit-learn, joblib

Author: GitHub Copilot
Date: October 2025
"""

import cv2
import mediapipe as mp
import numpy as np
import joblib
from pathlib import Path
import time

class VideoInference:
    """Run inference on video file."""
    
    def __init__(self, model_path='baby_sleep_model.pkl'):
        """Load trained model and initialize MediaPipe."""
        print("="*70)
        print("BABY SLEEP POSITION VIDEO DETECTOR")
        print("="*70)
        
        # Load model
        print(f"\nLoading model from {model_path}...")
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        model_data = joblib.load(model_path)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        print(f"✓ Model loaded (version {model_data.get('version', 'unknown')})")
        
        # Initialize MediaPipe
        print("✓ Initializing MediaPipe Pose...")
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,  # Video mode
            model_complexity=1,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Stats
        self.frame_count = 0
        self.safe_count = 0
        self.unsafe_count = 0
        self.no_detection_count = 0
        
    def extract_landmarks(self, image):
        """Extract pose landmarks from frame."""
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        results = self.pose.process(image_rgb)
        
        if results.pose_landmarks:
            landmarks = []
            for landmark in results.pose_landmarks.landmark:
                landmarks.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
            return np.array(landmarks), results.pose_landmarks
        return None, None
    
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
    
    def predict_frame(self, frame):
        """Predict on a single frame."""
        landmarks, pose_landmarks = self.extract_landmarks(frame)
        
        if landmarks is None:
            return None, None, None
        
        features = self.extract_engineered_features(landmarks)
        features_scaled = self.scaler.transform(features.reshape(1, -1))
        
        prediction = self.model.predict(features_scaled)[0]
        probability = self.model.predict_proba(features_scaled)[0]
        
        return prediction, probability, pose_landmarks
    
    def draw_results(self, frame, prediction, probability, pose_landmarks):
        """Draw prediction results on frame."""
        h, w = frame.shape[:2]
        
        # Draw pose landmarks
        if pose_landmarks:
            self.mp_drawing.draw_landmarks(
                frame,
                pose_landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=self.mp_drawing_styles.get_default_pose_landmarks_style()
            )
        
        if prediction is None:
            # No detection
            label = "NO DETECTION"
            color = (128, 128, 128)  # Gray
            conf = 0.0
        else:
            # Classification result
            label = "UNSAFE ⚠️" if prediction == 1 else "SAFE ✓"
            color = (0, 0, 255) if prediction == 1 else (0, 255, 0)  # Red or Green
            conf = probability[prediction]
        
        # Draw semi-transparent overlay at top
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 80), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
        
        # Draw label
        cv2.putText(frame, label, (20, 50), 
                   cv2.FONT_HERSHEY_DUPLEX, 1.5, color, 3)
        
        # Draw confidence
        if prediction is not None:
            conf_text = f"Confidence: {conf*100:.1f}%"
            cv2.putText(frame, conf_text, (w-300, 50),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        # Draw frame info
        info_text = f"Frame: {self.frame_count}"
        cv2.putText(frame, info_text, (20, h-20),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        return frame
    
    def process_video(self, input_video='baby.mp4', output_video='baby_output.mp4', 
                     display=True, save=True):
        """Process entire video."""
        print(f"\n{'='*70}")
        print("PROCESSING VIDEO")
        print(f"{'='*70}")
        
        # Open video
        if not Path(input_video).exists():
            raise FileNotFoundError(f"Video not found: {input_video}")
        
        cap = cv2.VideoCapture(input_video)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {input_video}")
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"\nVideo Info:")
        print(f"  Resolution: {width}x{height}")
        print(f"  FPS: {fps}")
        print(f"  Total Frames: {total_frames}")
        print(f"  Duration: {total_frames/fps:.1f} seconds")
        
        # Setup video writer
        writer = None
        if save:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(output_video, fourcc, fps, (width, height))
            print(f"  Output: {output_video}")
        
        print(f"\nProcessing... (Press 'q' to quit)")
        print("-" * 70)
        
        start_time = time.time()
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            self.frame_count += 1
            
            # Predict
            prediction, probability, pose_landmarks = self.predict_frame(frame)
            
            # Update stats
            if prediction is None:
                self.no_detection_count += 1
            elif prediction == 1:
                self.unsafe_count += 1
            else:
                self.safe_count += 1
            
            # Draw results
            output_frame = self.draw_results(frame, prediction, probability, pose_landmarks)
            
            # Save frame
            if writer:
                writer.write(output_frame)
            
            # Display
            if display:
                cv2.imshow('Baby Sleep Position Detection', output_frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("\n⚠️  Processing stopped by user")
                    break
            
            # Progress update
            if self.frame_count % 30 == 0:
                progress = (self.frame_count / total_frames) * 100
                elapsed = time.time() - start_time
                fps_actual = self.frame_count / elapsed
                print(f"  Progress: {progress:.1f}% | Frame: {self.frame_count}/{total_frames} | "
                      f"FPS: {fps_actual:.1f} | Safe: {self.safe_count} | Unsafe: {self.unsafe_count}")
        
        # Cleanup
        cap.release()
        if writer:
            writer.release()
        if display:
            cv2.destroyAllWindows()
        
        # Final stats
        elapsed = time.time() - start_time
        print(f"\n{'='*70}")
        print("PROCESSING COMPLETE!")
        print(f"{'='*70}")
        print(f"\nStatistics:")
        print(f"  Total Frames: {self.frame_count}")
        print(f"  Safe Frames: {self.safe_count} ({self.safe_count/self.frame_count*100:.1f}%)")
        print(f"  Unsafe Frames: {self.unsafe_count} ({self.unsafe_count/self.frame_count*100:.1f}%)")
        print(f"  No Detection: {self.no_detection_count} ({self.no_detection_count/self.frame_count*100:.1f}%)")
        print(f"\nProcessing Time: {elapsed:.1f} seconds")
        print(f"Average FPS: {self.frame_count/elapsed:.1f}")
        
        if save:
            print(f"\n✓ Output saved: {output_video}")
        
        # Risk assessment
        if self.frame_count > 0:
            unsafe_percentage = (self.unsafe_count / self.frame_count) * 100
            print(f"\n{'='*70}")
            if unsafe_percentage > 50:
                print("⚠️  HIGH RISK: Baby is in unsafe position for majority of video!")
            elif unsafe_percentage > 20:
                print("⚠️  MODERATE RISK: Baby shows unsafe positions in some frames")
            elif unsafe_percentage > 5:
                print("✓ LOW RISK: Few unsafe positions detected")
            else:
                print("✓ SAFE: Baby appears to be in safe sleeping position")
            print(f"{'='*70}")
    
    def close(self):
        """Cleanup resources."""
        if self.pose:
            self.pose.close()


def main():
    """Main execution."""
    import sys
    
    # Configuration
    MODEL_PATH = 'baby_sleep_model.pkl'
    INPUT_VIDEO = 'baby1.mp4'
    OUTPUT_VIDEO = 'baby_output.mp4'
    
    # Check files exist
    if not Path(MODEL_PATH).exists():
        print(f"❌ Error: Model file not found: {MODEL_PATH}")
        print(f"\nPlease ensure you have trained the model first:")
        print(f"  1. Run: python kaggle_complete.py")
        print(f"  2. This will generate: baby_sleep_model.pkl")
        sys.exit(1)
    
    if not Path(INPUT_VIDEO).exists():
        print(f"❌ Error: Video file not found: {INPUT_VIDEO}")
        print(f"\nPlease place your video file as 'baby.mp4' in this directory")
        print(f"Or update INPUT_VIDEO variable in the script")
        sys.exit(1)
    
    try:
        # Initialize inference
        detector = VideoInference(MODEL_PATH)
        
        # Process video
        detector.process_video(
            input_video=INPUT_VIDEO,
            output_video=OUTPUT_VIDEO,
            display=True,  # Set to False if running without display
            save=True      # Set to False to skip saving output
        )
        
        # Cleanup
        detector.close()
        
        print(f"\n✓ Done! Check {OUTPUT_VIDEO} for results.")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
