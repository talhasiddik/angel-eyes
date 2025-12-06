"""
Flask AI Service for Baby Monitoring - Video Stream Processing
Processes video frames from Logitech C270 webcam for comprehensive baby monitoring
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import numpy as np
import cv2
import os
from dotenv import load_dotenv

# Import updated processors
from processors.awake_sleep_detector import AwakeSleepDetector
from processors.sleep_position_detector import SleepPositionDetector
from processors.cry_detector import CryDetector

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# Initialize AI processors with updated models
print("="*70)
print("BABY MONITORING AI SERVICE - VIDEO STREAM PROCESSING")
print("="*70)
print("\n🤖 Loading AI models...")
awake_sleep_detector = AwakeSleepDetector()
sleep_position_detector = SleepPositionDetector()
cry_detector = CryDetector()
print("\n" + "="*70)
print("✅ ALL AI MODELS LOADED SUCCESSFULLY!")
print("="*70 + "\n")

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Check if AI service is running and models are loaded"""
    return jsonify({
        'status': 'healthy',
        'service': 'Baby Monitoring AI Service (Video Stream)',
        'models_loaded': {
            'awake_sleep': awake_sleep_detector.is_loaded(),
            'sleep_position': sleep_position_detector.is_loaded(),
            'cry_detection': cry_detector.is_loaded()
        }
    })

# Main video frame analysis endpoint
@app.route('/analyze-frame', methods=['POST'])
def analyze_frame():
    """
    Analyze a video frame from webcam stream for comprehensive monitoring
    Expects JSON: { "frame": "base64_encoded_image", "sessionId": "session_id" }
    
    Returns:
        - Awake/Sleep state (eye detection)
        - Sleep position safety (pose detection)
        - Combined safety assessment
    """
    try:
        data = request.json
        
        if not data or 'frame' not in data:
            return jsonify({'error': 'Missing frame data'}), 400
        
        # Decode base64 image
        image_base64 = data['frame']
        session_id = data.get('sessionId', 'unknown')
        
        # Remove data URL prefix if present
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # Decode to numpy array
        img_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        # Run all detectors
        awake_sleep_result = awake_sleep_detector.detect(frame)
        sleep_position_result = sleep_position_detector.detect(frame)
        
        # Determine overall safety
        overall_safety = determine_overall_safety(awake_sleep_result, sleep_position_result)
        
        # Combine results
        result = {
            'sessionId': session_id,
            'timestamp': data.get('timestamp', None),
            'success': True,
            
            # Awake/Sleep Detection
            'awake_sleep': {
                'state': awake_sleep_result.get('state', 'unknown'),
                'confidence': awake_sleep_result.get('confidence', 0.0),
                'success': awake_sleep_result.get('success', False)
            },
            
            # Sleep Position Detection
            'sleep_position': {
                'position': sleep_position_result.get('position', 'unknown'),
                'is_safe': sleep_position_result.get('is_safe', False),
                'confidence': sleep_position_result.get('confidence', 0.0),
                'success': sleep_position_result.get('success', False)
            },
            
            # Overall Safety Assessment
            'safety': overall_safety
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Error analyzing frame: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# Audio analysis endpoint for cry detection
@app.route('/analyze-audio', methods=['POST'])
def analyze_audio():
    """
    Analyze audio from microphone for cry detection
    Expects JSON: { "audio": "base64_encoded_audio", "sessionId": "session_id" }
    """
    try:
        data = request.json
        
        if not data or 'audio' not in data:
            return jsonify({'error': 'Missing audio data'}), 400
        
        # Decode base64 audio
        audio_base64 = data['audio']
        session_id = data.get('sessionId', 'unknown')
        
        # Remove data URL prefix if present
        if ',' in audio_base64:
            audio_base64 = audio_base64.split(',')[1]
        
        # Decode audio
        audio_data = base64.b64decode(audio_base64)
        
        # Run cry detection
        result = cry_detector.detect(audio_data)
        
        # Add session info
        result['sessionId'] = session_id
        result['timestamp'] = data.get('timestamp', None)
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Error analyzing audio: {str(e)}")
        return jsonify({'error': str(e)}), 500

def determine_overall_safety(awake_sleep_result, sleep_position_result):
    """
    Determine overall safety based on multiple factors
    
    Rules:
    1. If baby is AWAKE → Generally SAFE (active monitoring)
    2. If baby is ASLEEP:
       - SAFE position (back) → SAFE
       - UNSAFE position (stomach/side) → UNSAFE (CRITICAL ALERT)
    3. If awake/sleep detection unavailable → Use position only
    4. If all detection fails → UNKNOWN
    """
    
    # Check if we have valid results
    awake_sleep_success = awake_sleep_result.get('success', False)
    position_success = sleep_position_result.get('success', False)
    
    if not awake_sleep_success and not position_success:
        return {
            'level': 'unknown',
            'message': 'Unable to detect baby state',
            'alert': False,
            'confidence': 0.0
        }
    
    # Get states
    is_awake = awake_sleep_result.get('state') == 'awake'
    is_safe_position = sleep_position_result.get('is_safe', False)
    
    # Calculate combined confidence
    confidences = []
    if awake_sleep_success:
        confidences.append(awake_sleep_result.get('confidence', 0.0))
    if position_success:
        confidences.append(sleep_position_result.get('confidence', 0.0))
    
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
    
    # If awake/sleep detection unavailable, use position only
    if not awake_sleep_success:
        if position_success:
            if is_safe_position:
                return {
                    'level': 'safe',
                    'message': 'Baby in safe sleeping position (back)',
                    'alert': False,
                    'confidence': float(avg_confidence)
                }
            else:
                return {
                    'level': 'critical',
                    'message': 'UNSAFE: Baby on stomach - SIDS risk!',
                    'alert': True,
                    'alert_type': 'position',
                    'confidence': float(avg_confidence)
                }
    
    # Safety logic with awake/sleep detection
    if is_awake:
        # Baby is awake - generally safe
        return {
            'level': 'safe',
            'message': 'Baby is awake and active',
            'alert': False,
            'confidence': float(avg_confidence)
        }
    else:
        # Baby is asleep - check position
        if position_success:
            if is_safe_position:
                return {
                    'level': 'safe',
                    'message': 'Baby sleeping in safe position (back)',
                    'alert': False,
                    'confidence': float(avg_confidence)
                }
            else:
                return {
                    'level': 'critical',
                    'message': 'UNSAFE: Baby sleeping on stomach - SIDS risk!',
                    'alert': True,
                    'alert_type': 'position',
                    'confidence': float(avg_confidence)
                }
        else:
            # Position detection failed but baby is asleep
            return {
                'level': 'warning',
                'message': 'Baby asleep but position unclear',
                'alert': True,
                'alert_type': 'unclear_position',
                'confidence': float(avg_confidence)
            }

# Run the Flask app
if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    print(f"\n🚀 Starting AI Service on port {port}...")
    print(f"📡 Listening for video frames from webcam stream server...")
    print(f"Press CTRL+C to stop\n")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False,
        threaded=True
    )
