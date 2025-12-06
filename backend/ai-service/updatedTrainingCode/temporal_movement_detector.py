"""
Simple Rule-Based Movement Detection
=====================================

Detects baby movement using simple distance thresholds:
- Small movements (jitter/breathing) → ASLEEP
- Large movements (arm raises, leg kicks) → AWAKE
"""

import cv2
import numpy as np
import mediapipe as mp
from collections import deque
import time

print("="*70)
print("RULE-BASED MOVEMENT DETECTION")
print("="*70)

# ==================== CONFIGURATION ====================

class Config:
    # Video settings
    VIDEO_PATH = r"d:\datasets\final datasets\baby1.mp4"
    OUTPUT_PATH = r"d:\datasets\final datasets\movement_output.mp4"
    SAVE_OUTPUT = True
    
   
    ARM_MOVEMENT_THRESHOLD = 0.25   
    LEG_MOVEMENT_THRESHOLD = 0.20   
    HEAD_MOVEMENT_THRESHOLD = 0.18
    
    # Time window for movement tracking
    WINDOW_SIZE = 30  # Track last 30 frames (~1 second)
    
    # Smoothing
    SMOOTHING_FRAMES = 10  # Smooth decisions over 10 frames
    
    # Display
    SHOW_SKELETON = True

config = Config()

# ==================== MOVEMENT DETECTOR ====================

class SimpleMovementDetector:
    """Detect movement based on position changes"""
    
    def __init__(self, window_size=30):
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # History of positions
        self.left_wrist_history = deque(maxlen=window_size)
        self.right_wrist_history = deque(maxlen=window_size)
        self.left_ankle_history = deque(maxlen=window_size)
        self.right_ankle_history = deque(maxlen=window_size)
        self.nose_history = deque(maxlen=window_size)
        
        # Decision smoothing
        self.decision_history = deque(maxlen=config.SMOOTHING_FRAMES)
        
    def extract_positions(self, image):
        """Extract key body part positions"""
        try:
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            results = self.pose.process(rgb)
            
            if not results.pose_landmarks:
                return None, None
            
            lm = results.pose_landmarks.landmark
            
            positions = {
                'left_wrist': np.array([lm[15].x, lm[15].y]),
                'right_wrist': np.array([lm[16].x, lm[16].y]),
                'left_ankle': np.array([lm[27].x, lm[27].y]),
                'right_ankle': np.array([lm[28].x, lm[28].y]),
                'nose': np.array([lm[0].x, lm[0].y]),
            }
            
            return positions, results.pose_landmarks
            
        except Exception as e:
            return None, None
    
    def calculate_max_movement(self, history):
        """Calculate maximum distance moved in history window"""
        if len(history) < 2:
            return 0.0
        
        positions = np.array(history)
        
        # Calculate max distance from any point to any other point
        max_dist = 0.0
        for i in range(len(positions)):
            for j in range(i + 1, len(positions)):
                dist = np.linalg.norm(positions[i] - positions[j])
                if dist > max_dist:
                    max_dist = dist
        
        return max_dist
    
    def detect_movement(self, frame):
        """
        Main detection function
        
        Returns:
        - state: 0 (asleep) or 1 (awake)
        - movements: dict of movement values
        - landmarks: for visualization
        """
        positions, landmarks = self.extract_positions(frame)
        
        if positions is None:
            return None, None, None
        
        # Add to history
        self.left_wrist_history.append(positions['left_wrist'])
        self.right_wrist_history.append(positions['right_wrist'])
        self.left_ankle_history.append(positions['left_ankle'])
        self.right_ankle_history.append(positions['right_ankle'])
        self.nose_history.append(positions['nose'])
        
        # Need enough frames
        if len(self.left_wrist_history) < 5:
            return 0, None, landmarks
        
        # Calculate maximum movements
        left_arm_movement = self.calculate_max_movement(self.left_wrist_history)
        right_arm_movement = self.calculate_max_movement(self.right_wrist_history)
        left_leg_movement = self.calculate_max_movement(self.left_ankle_history)
        right_leg_movement = self.calculate_max_movement(self.right_ankle_history)
        head_movement = self.calculate_max_movement(self.nose_history)
        
        movements = {
            'left_arm': left_arm_movement,
            'right_arm': right_arm_movement,
            'left_leg': left_leg_movement,
            'right_leg': right_leg_movement,
            'head': head_movement,
        }
        
        # Decision logic: If ANY body part moves significantly → AWAKE
        is_awake = (
            left_arm_movement > config.ARM_MOVEMENT_THRESHOLD or
            right_arm_movement > config.ARM_MOVEMENT_THRESHOLD or
            left_leg_movement > config.LEG_MOVEMENT_THRESHOLD or
            right_leg_movement > config.LEG_MOVEMENT_THRESHOLD or
            head_movement > config.HEAD_MOVEMENT_THRESHOLD
        )
        
        state = 1 if is_awake else 0
        
        # Smooth decision
        self.decision_history.append(state)
        
        if len(self.decision_history) >= 3:
            # Majority vote
            awake_count = sum(self.decision_history)
            smoothed_state = 1 if awake_count > len(self.decision_history) / 2 else 0
        else:
            smoothed_state = state
        
        return smoothed_state, movements, landmarks
    
    def draw_skeleton(self, image, landmarks):
        """Draw pose skeleton"""
        if landmarks and config.SHOW_SKELETON:
            self.mp_drawing.draw_landmarks(
                image,
                landmarks,
                self.mp_pose.POSE_CONNECTIONS,
                self.mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                self.mp_drawing.DrawingSpec(color=(0, 255, 255), thickness=2)
            )
    
    def close(self):
        if self.pose:
            self.pose.close()

# ==================== VIDEO PROCESSING ====================

def process_video():
    """Main video processing"""
    
    print(f"\nOpening video: {config.VIDEO_PATH}")
    
    cap = cv2.VideoCapture(config.VIDEO_PATH)
    if not cap.isOpened():
        print("ERROR: Could not open video")
        return
    
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    print(f"* Video: {width}x{height} @ {fps} FPS ({total_frames} frames)")
    print(f"* Thresholds: Arms={config.ARM_MOVEMENT_THRESHOLD:.2f}, Legs={config.LEG_MOVEMENT_THRESHOLD:.2f}")
    
    writer = None
    if config.SAVE_OUTPUT:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(config.OUTPUT_PATH, fourcc, fps, (width, height))
        print(f"* Output: {config.OUTPUT_PATH}")
    
    detector = SimpleMovementDetector(window_size=config.WINDOW_SIZE)
    
    print("\n" + "="*70)
    print("PROCESSING - Press 'Q' to quit")
    print("="*70)
    
    frame_count = 0
    start_time = time.time()
    asleep_frames = 0
    awake_frames = 0
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        frame_count += 1
        
        state, movements, landmarks = detector.detect_movement(frame)
        
        if state is not None:
            if state == 0:
                asleep_frames += 1
            else:
                awake_frames += 1
            
            detector.draw_skeleton(frame, landmarks)
            
            if state == 1:
                label = "AWAKE (Moving)"
                color = (0, 0, 255)  # Red
            else:
                label = "ASLEEP (Still)"
                color = (0, 255, 0)  # Green
            
            # Draw info box
            cv2.rectangle(frame, (10, 10), (width-10, 200), (0, 0, 0), -1)
            cv2.rectangle(frame, (10, 10), (width-10, 200), color, 3)
            
            cv2.putText(frame, f"Status: {label}", (20, 45),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.9, color, 2)
            
            # Show movement values if available
            if movements:
                y_offset = 80
                cv2.putText(frame, "Movement Values:", (20, y_offset),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                y_offset += 30
                
                for part, value in movements.items():
                    # Color code based on threshold
                    if 'arm' in part:
                        threshold = config.ARM_MOVEMENT_THRESHOLD
                    elif 'leg' in part:
                        threshold = config.LEG_MOVEMENT_THRESHOLD
                    else:
                        threshold = config.HEAD_MOVEMENT_THRESHOLD
                    
                    text_color = (0, 0, 255) if value > threshold else (255, 255, 255)
                    
                    cv2.putText(frame, f"{part}: {value:.3f}", (30, y_offset),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, text_color, 1)
                    y_offset += 20
            
            # Progress and stats
            progress = (frame_count / total_frames) * 100
            cv2.putText(frame, f"Progress: {progress:.1f}%", (20, height - 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            cv2.putText(frame, f"Asleep: {asleep_frames} ({asleep_frames/frame_count*100:.0f}%) | Awake: {awake_frames} ({awake_frames/frame_count*100:.0f}%)", 
                       (20, height - 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        cv2.imshow('Movement Detection', frame)
        
        if writer:
            writer.write(frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("\nInterrupted by user")
            break
    
    elapsed = time.time() - start_time
    print(f"\n" + "="*70)
    print("PROCESSING COMPLETE")
    print("="*70)
    print(f"* Processed {frame_count} frames in {elapsed:.1f}s")
    print(f"* Average FPS: {frame_count/elapsed:.2f}")
    print(f"\nResults:")
    print(f"  - Asleep (Still): {asleep_frames} frames ({asleep_frames/frame_count*100:.1f}%)")
    print(f"  - Awake (Moving): {awake_frames} frames ({awake_frames/frame_count*100:.1f}%)")
    
    cap.release()
    if writer:
        writer.release()
        print(f"\n* Output saved: {config.OUTPUT_PATH}")
    
    cv2.destroyAllWindows()
    detector.close()
    print("="*70)

# ==================== MAIN ====================

def main():
    """Main execution"""
    
    print("\nSimple Rule-Based Movement Detection")
    print("="*70)
    print("Logic:")
    print("  - Small jitter/breathing -> ASLEEP")
    print("  - Full arm raises/leg kicks -> AWAKE")
    print("  - No training required!")
    print("="*70)
    
    try:
        process_video()
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
