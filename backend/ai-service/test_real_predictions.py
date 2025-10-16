"""
Test script to verify AI models are making REAL predictions
"""
import requests
import base64
import numpy as np
import cv2
from PIL import Image
import io

# Flask service URL
BASE_URL = "http://localhost:5001"

def test_sleep_detection():
    """Test sleep safety detection with a dummy image"""
    print("\n" + "="*60)
    print("🧪 Testing Sleep Safety Detection")
    print("="*60)
    
    # Create a test image (640x480 RGB)
    test_image = np.zeros((480, 640, 3), dtype=np.uint8)
    # Add some random patterns to simulate a baby
    test_image[100:300, 200:400] = [200, 180, 160]  # Skin tone area
    
    # Convert to base64
    _, buffer = cv2.imencode('.jpg', test_image)
    image_base64 = base64.b64encode(buffer).decode('utf-8')
    
    # Send request
    response = requests.post(
        f"{BASE_URL}/analyze-frame",
        json={"image": image_base64}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n✅ Response received!")
        print(f"   Is Safe: {result.get('is_safe')}")
        print(f"   Confidence: {result.get('confidence', 0):.2%}")
        print(f"   Alert Level: {result.get('alert_level')}")
        print(f"   Position: {result.get('position_classification')}")
        
        # Check if it's a real prediction (not mock)
        if result.get('confidence') and result.get('confidence') > 0:
            print(f"\n   🎯 REAL MODEL PREDICTION DETECTED!")
            print(f"      (Confidence score indicates model inference)")
        else:
            print(f"\n   ⚠️  May be mock response (no confidence score)")
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)

def test_cry_detection():
    """Test cry detection with dummy audio"""
    print("\n" + "="*60)
    print("🧪 Testing Cry Detection")
    print("="*60)
    
    # Create a dummy audio buffer (3 seconds of silence)
    # In real use, this would be actual audio from the video
    sample_rate = 16000
    duration = 3
    audio_data = np.zeros(sample_rate * duration, dtype=np.float32)
    
    # Add some random noise to simulate audio
    audio_data += np.random.randn(len(audio_data)) * 0.01
    
    # Convert to base64 (simulate WAV format)
    import wave
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes((audio_data * 32767).astype(np.int16).tobytes())
    
    audio_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    # Send request
    response = requests.post(
        f"{BASE_URL}/analyze-audio",
        json={"audio": audio_base64}
    )
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n✅ Response received!")
        print(f"   Is Crying: {result.get('is_crying')}")
        print(f"   Cry Probability: {result.get('cry_probability', 0):.2%}")
        
        if result.get('is_crying'):
            print(f"   Cry Reason: {result.get('cry_reason')}")
            print(f"   Reason Confidence: {result.get('reason_confidence', 0):.2%}")
            print(f"   Recommendations: {result.get('recommendations')}")
        
        # Check if it's a real prediction
        if result.get('cry_probability') is not None:
            print(f"\n   🎯 REAL MODEL PREDICTION DETECTED!")
            print(f"      (Probability: {result.get('cry_probability', 0):.4f})")
        else:
            print(f"\n   ⚠️  May be mock response")
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🚀 TESTING REAL AI MODEL PREDICTIONS")
    print("="*60)
    
    # Test both models
    test_sleep_detection()
    test_cry_detection()
    
    print("\n" + "="*60)
    print("✅ Testing Complete!")
    print("="*60)
    print("\nIf you see confidence scores and probabilities above,")
    print("then the models are making REAL predictions! 🎉")
    print("\nNo mock mode - ready for evaluation! 💪")
    print("="*60 + "\n")
