"""
Flask AI Service for Baby Monitoring - Live Stream Processing
Processes video frames and audio from React Native mobile camera
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import numpy as np
import cv2
import os
from dotenv import load_dotenv
import io

# Import processors
from processors.sleep_safety_detector import SleepSafetyDetector
from processors.cry_detector import CryDetector

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React Native

# Initialize AI processors
print("🤖 Loading AI models...")
sleep_detector = SleepSafetyDetector()
cry_detector = CryDetector()
print("✅ All AI models loaded successfully!")

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    """Check if AI service is running and models are loaded"""
    return jsonify({
        'status': 'healthy',
        'service': 'Baby Monitoring AI Service',
        'models_loaded': {
            'sleep_safety': sleep_detector.is_loaded(),
            'cry_detection': cry_detector.is_loaded()
        }
    })

# Live frame analysis endpoint
@app.route('/analyze-frame', methods=['POST'])
def analyze_frame():
    """
    Analyze a video frame from live camera stream for sleep safety
    Expects JSON: { "frame": "base64_encoded_image", "sessionId": "session_id" }
    """
    try:
        data = request.json
        
        if not data or 'frame' not in data:
            return jsonify({'error': 'Missing frame data'}), 400
        
        # Decode base64 image
        image_base64 = data['frame']
        session_id = data.get('sessionId', 'unknown')
        
        # Remove data URL prefix if present (data:image/jpeg;base64,...)
        if ',' in image_base64:
            image_base64 = image_base64.split(',')[1]
        
        # Decode to numpy array
        img_data = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image data'}), 400
        
        # Run sleep safety detection
        result = sleep_detector.detect(frame)
        
        # Add session info
        result['sessionId'] = session_id
        result['timestamp'] = data.get('timestamp', None)
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Error analyzing frame: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Audio analysis endpoint for cry detection
@app.route('/analyze-audio', methods=['POST'])
def analyze_audio():
    """
    Analyze audio from live stream for cry detection
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
        
        # Run cry detection (two-stage)
        result = cry_detector.detect_from_bytes(audio_data)
        
        # Add session info
        result['sessionId'] = session_id
        result['timestamp'] = data.get('timestamp', None)
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Error analyzing audio: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Combined analysis endpoint (optional - for efficiency)
@app.route('/analyze-stream', methods=['POST'])
def analyze_stream():
    """
    Analyze both video frame and audio chunk together
    Expects JSON: { "frame": "base64", "audio": "base64", "sessionId": "id" }
    """
    try:
        data = request.json
        results = {}
        
        # Analyze frame if present
        if 'frame' in data and data['frame']:
            image_base64 = data['frame']
            if ',' in image_base64:
                image_base64 = image_base64.split(',')[1]
            
            img_data = base64.b64decode(image_base64)
            nparr = np.frombuffer(img_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is not None:
                results['sleep_safety'] = sleep_detector.detect(frame)
        
        # Analyze audio if present
        if 'audio' in data and data['audio']:
            audio_base64 = data['audio']
            if ',' in audio_base64:
                audio_base64 = audio_base64.split(',')[1]
            
            audio_data = base64.b64decode(audio_base64)
            results['cry_detection'] = cry_detector.detect_from_bytes(audio_data)
        
        # Add metadata
        results['sessionId'] = data.get('sessionId', 'unknown')
        results['timestamp'] = data.get('timestamp', None)
        
        return jsonify(results), 200
        
    except Exception as e:
        print(f"❌ Error analyzing stream: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Test endpoint
@app.route('/test', methods=['GET'])
def test():
    """Simple test endpoint"""
    return jsonify({
        'message': 'AI Service is running!',
        'version': '1.0.0',
        'endpoints': [
            'GET  /health          - Service health check',
            'POST /analyze-frame   - Analyze video frame (sleep safety)',
            'POST /analyze-audio   - Analyze audio (cry detection)',
            'POST /analyze-stream  - Analyze both frame and audio',
            'GET  /test            - This endpoint'
        ]
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    debug = os.getenv('DEBUG', 'True').lower() == 'true'
    
    print(f"\n{'='*70}")
    print(f"🚀 Baby Monitoring AI Service")
    print(f"{'='*70}")
    print(f"📡 Running on: http://0.0.0.0:{port}")
    print(f"🔧 Debug mode: {debug}")
    print(f"{'='*70}\n")
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )
