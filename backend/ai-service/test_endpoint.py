"""
Quick test to verify Flask /analyze-frame endpoint
"""
import requests
import base64
import numpy as np
import cv2

# Create a simple test image (480x640 black image)
test_image = np.zeros((480, 640, 3), dtype=np.uint8)

# Encode to JPEG
_, buffer = cv2.imencode('.jpg', test_image)

# Convert to base64
image_base64 = base64.b64encode(buffer).decode('utf-8')

print(f"✅ Test image created, base64 length: {len(image_base64)}")

# Send to Flask service
url = "http://192.168.18.142:5001/analyze-frame"
data = {
    "frame": image_base64,
    "sessionId": "test-session",
    "timestamp": "2025-10-16T18:30:00Z"
}

print(f"\n📤 Sending POST request to {url}...")

try:
    response = requests.post(url, json=data)
    
    print(f"\n📥 Response Status: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print(f"✅ SUCCESS! AI Result:")
        print(f"   - Is Safe: {result.get('is_safe')}")
        print(f"   - Confidence: {result.get('confidence', 0):.2%}")
        print(f"   - Alert Level: {result.get('alert_level')}")
        print(f"   - Position: {result.get('position_classification')}")
        print(f"\n🎉 Flask endpoint is working correctly!")
    else:
        print(f"❌ Error: {response.text}")
        
except Exception as e:
    print(f"❌ Request failed: {e}")
