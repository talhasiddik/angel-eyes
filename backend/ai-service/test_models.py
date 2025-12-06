"""
Test script to verify all updated models load correctly
Run this before starting the AI service
"""

import sys
import os

print("="*70)
print("TESTING AI SERVICE - UPDATED MODELS")
print("="*70)
print()

# Test imports
print("1. Testing imports...")
try:
    import cv2
    import numpy as np
    import mediapipe as mp
    from tensorflow import keras
    import joblib
    print("   ✅ All libraries imported successfully")
except Exception as e:
    print(f"   ❌ Import error: {e}")
    sys.exit(1)

print()

# Test model loading
print("2. Testing model loading...")

# Test awake/sleep detector
print("   [1/3] Awake/Sleep Detector (eye_detector_best.h5)...")
try:
    from processors.awake_sleep_detector import AwakeSleepDetector
    detector = AwakeSleepDetector()
    if detector.is_loaded():
        print("       ✅ Loaded successfully")
    else:
        print("       ❌ Failed to load")
except Exception as e:
    print(f"       ❌ Error: {e}")

# Test sleep position detector  
print("   [2/3] Sleep Position Detector (baby_sleep_model.pkl)...")
try:
    from processors.sleep_position_detector import SleepPositionDetector
    detector = SleepPositionDetector()
    if detector.is_loaded():
        print("       ✅ Loaded successfully")
    else:
        print("       ❌ Failed to load")
except Exception as e:
    print(f"       ❌ Error: {e}")

# Test cry detector
print("   [3/3] Cry Detector (stage1_cry_detection_model1.h5)...")
try:
    from processors.cry_detector import CryDetector
    detector = CryDetector()
    if detector.is_loaded():
        print("       ✅ Loaded successfully")
    else:
        print("       ❌ Failed to load")
except Exception as e:
    print(f"       ❌ Error: {e}")

print()

# Test with dummy frame
print("3. Testing with dummy frame...")
try:
    # Create a test frame (black image)
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    from processors.awake_sleep_detector import AwakeSleepDetector
    from processors.sleep_position_detector import SleepPositionDetector
    
    awake_detector = AwakeSleepDetector()
    position_detector = SleepPositionDetector()
    
    # These will fail detection (no baby) but should not crash
    awake_result = awake_detector.detect(test_frame)
    position_result = position_detector.detect(test_frame)
    
    print("   ✅ Detectors can process frames without crashing")
    print(f"      Awake/Sleep: {awake_result.get('error', 'No error')}")
    print(f"      Position: {position_result.get('error', 'No error')}")
except Exception as e:
    print(f"   ❌ Error processing frame: {e}")

print()
print("="*70)
print("TEST COMPLETE!")
print("="*70)
print()
print("If all tests passed, the AI service is ready to run.")
print("Start it with: python app.py")
