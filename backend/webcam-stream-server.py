"""
Webcam Streaming Server for Logitech C270
Streams webcam video over HTTP with MJPEG format
Captures audio from built-in microphone for cry detection
Mobile app can connect to this stream
"""

from flask import Flask, Response, jsonify
from flask_cors import CORS
import cv2
import threading
import time
import pyaudio
import wave
import io
import base64
import numpy as np

app = Flask(__name__)
CORS(app)

# Global variables for video
camera = None
output_frame = None
lock = threading.Lock()
is_streaming = False

# Global variables for audio
audio_buffer = None
audio_lock = threading.Lock()
audio_stream = None
is_recording = False

# Audio settings for cry detection (16kHz, 3 seconds)
AUDIO_FORMAT = pyaudio.paInt16
AUDIO_CHANNELS = 1  # Mono
AUDIO_RATE = 16000  # 16kHz sample rate (required by cry detector)
AUDIO_CHUNK = 1024
AUDIO_RECORD_SECONDS = 3  # 3-second clips for cry detection

class WebcamStream:
    def __init__(self, camera_index=0):
        """Initialize webcam stream"""
        self.camera_index = camera_index
        self.camera = None
        self.is_running = False
    
    def _find_logitech_camera(self):
        """Find Logitech C270 camera (prefer external USB webcam over laptop camera)"""
        print("🔍 Searching for Logitech C270 webcam...")
        
        # Try indices 1-4 first (external cameras), then 0 (usually laptop camera)
        for index in [1, 2, 3, 4, 0]:
            print(f"   Trying camera index {index}...")
            test_cam = cv2.VideoCapture(index, cv2.CAP_DSHOW)
            if test_cam.isOpened():
                # Test if we can actually read a frame
                ret, frame = test_cam.read()
                if ret:
                    # Get camera resolution to identify C270 (supports 1280x720)
                    width = test_cam.get(cv2.CAP_PROP_FRAME_WIDTH)
                    height = test_cam.get(cv2.CAP_PROP_FRAME_HEIGHT)
                    test_cam.release()
                    
                    # Prefer index 1 (usually external USB camera) or higher resolutions
                    if index > 0:  # Skip laptop camera (index 0) unless it's the only one
                        print(f"✅ Found external camera at index {index} ({int(width)}x{int(height)})")
                        return index
                    elif index == 0:
                        print(f"⚠️  Only laptop camera found at index {index} ({int(width)}x{int(height)})")
                        return index
                test_cam.release()
        
        print("❌ No camera found")
        return None
        
    def start(self):
        """Start the webcam stream"""
        global camera, is_streaming
        
        if self.is_running:
            print("⚠️  Stream already running")
            return True
        
        # Auto-detect camera if current index fails
        self.camera = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        
        if not self.camera.isOpened():
            print(f"⚠️  Camera index {self.camera_index} not available, searching...")
            found_index = self._find_logitech_camera()
            if found_index is None:
                print("❌ Failed to find any webcam")
                return False
            self.camera_index = found_index
            self.camera = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
            
        if not self.camera.isOpened():
            print("❌ Failed to open webcam")
            return False
        
        # Set camera properties for Logitech C270
        self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.camera.set(cv2.CAP_PROP_FPS, 30)
        
        camera = self.camera
        is_streaming = True
        self.is_running = True
        
        # Start frame capture thread
        thread = threading.Thread(target=self._update_frame, daemon=True)
        thread.start()
        
        print("✅ Webcam stream started")
        print(f"   Resolution: {int(self.camera.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(self.camera.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
        print(f"   FPS: {int(self.camera.get(cv2.CAP_PROP_FPS))}")
        
        return True
    
    def _update_frame(self):
        """Continuously read frames from webcam"""
        global output_frame, lock
        
        while self.is_running:
            if camera is None:
                break
                
            success, frame = camera.read()
            
            if success:
                with lock:
                    output_frame = frame.copy()
            else:
                print("⚠️  Failed to read frame")
                time.sleep(0.1)
    
    def stop(self):
        """Stop the webcam stream"""
        global camera, is_streaming
        
        self.is_running = False
        is_streaming = False
        
        if self.camera is not None:
            self.camera.release()
            camera = None
        
        print("⏹️  Webcam stream stopped")

# Global stream instance (start with index 1 for external USB camera)
webcam_stream = WebcamStream(camera_index=1)

class AudioCapture:
    def __init__(self):
        """Initialize audio capture from Logitech C270 microphone"""
        self.pyaudio = pyaudio.PyAudio()
        self.stream = None
        self.is_running = False
        self.recording_thread = None
        
    def start(self):
        """Start audio recording"""
        global is_recording
        
        if self.is_running:
            print("⚠️  Audio recording already running")
            return True
        
        try:
            # Open audio stream from default microphone
            self.stream = self.pyaudio.open(
                format=AUDIO_FORMAT,
                channels=AUDIO_CHANNELS,
                rate=AUDIO_RATE,
                input=True,
                frames_per_buffer=AUDIO_CHUNK
            )
            
            is_recording = True
            self.is_running = True
            
            # Start continuous recording thread
            self.recording_thread = threading.Thread(target=self._record_audio, daemon=True)
            self.recording_thread.start()
            
            print("✅ Audio recording started")
            print(f"   Sample Rate: {AUDIO_RATE} Hz")
            print(f"   Channels: {AUDIO_CHANNELS} (Mono)")
            print(f"   Clip Duration: {AUDIO_RECORD_SECONDS} seconds")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to start audio recording: {e}")
            return False
    
    def _record_audio(self):
        """Continuously record 3-second audio clips"""
        global audio_buffer, audio_lock
        
        while self.is_running:
            try:
                frames = []
                
                # Record for AUDIO_RECORD_SECONDS
                for _ in range(0, int(AUDIO_RATE / AUDIO_CHUNK * AUDIO_RECORD_SECONDS)):
                    if not self.is_running:
                        break
                    data = self.stream.read(AUDIO_CHUNK, exception_on_overflow=False)
                    frames.append(data)
                
                # Convert to WAV format in memory
                wav_buffer = io.BytesIO()
                with wave.open(wav_buffer, 'wb') as wf:
                    wf.setnchannels(AUDIO_CHANNELS)
                    wf.setsampwidth(self.pyaudio.get_sample_size(AUDIO_FORMAT))
                    wf.setframerate(AUDIO_RATE)
                    wf.writeframes(b''.join(frames))
                
                # Store latest audio clip
                with audio_lock:
                    audio_buffer = wav_buffer.getvalue()
                
            except Exception as e:
                print(f"⚠️  Audio recording error: {e}")
                time.sleep(0.1)
    
    def stop(self):
        """Stop audio recording"""
        global is_recording
        
        self.is_running = False
        is_recording = False
        
        if self.stream is not None:
            self.stream.stop_stream()
            self.stream.close()
        
        print("⏹️  Audio recording stopped")
    
    def __del__(self):
        """Cleanup"""
        if hasattr(self, 'pyaudio'):
            self.pyaudio.terminate()

# Global audio capture instance
audio_capture = AudioCapture()

def generate_frames():
    """Generator function to stream frames as MJPEG"""
    global output_frame, lock
    
    while True:
        if output_frame is None:
            time.sleep(0.1)
            continue
        
        with lock:
            if output_frame is None:
                continue
            
            # Encode frame as JPEG
            success, buffer = cv2.imencode('.jpg', output_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            if not success:
                continue
            
            frame_bytes = buffer.tobytes()
        
        # Yield frame in MJPEG format
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/health')
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'video_streaming': is_streaming,
        'audio_recording': is_recording,
        'camera_index': webcam_stream.camera_index,
        'audio_settings': {
            'sample_rate': AUDIO_RATE,
            'channels': AUDIO_CHANNELS,
            'duration': AUDIO_RECORD_SECONDS
        }
    })

@app.route('/start')
def start_stream():
    """Start webcam streaming and audio recording"""
    video_success = webcam_stream.start()
    audio_success = audio_capture.start()
    
    return jsonify({
        'success': video_success and audio_success,
        'video': video_success,
        'audio': audio_success,
        'message': 'Stream started' if (video_success and audio_success) else 'Partial failure'
    })

@app.route('/stop')
def stop_stream():
    """Stop webcam streaming and audio recording"""
    webcam_stream.stop()
    audio_capture.stop()
    
    return jsonify({
        'success': True,
        'message': 'Stream and audio stopped'
    })

@app.route('/video_feed')
def video_feed():
    """Video streaming route - returns MJPEG stream"""
    if not is_streaming:
        return jsonify({'error': 'Stream not started. Call /start first'}), 400
    
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/snapshot')
def snapshot():
    """Get single frame as JPEG"""
    global output_frame, lock
    
    if output_frame is None:
        return jsonify({'error': 'No frame available'}), 400
    
    with lock:
        success, buffer = cv2.imencode('.jpg', output_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        
        if not success:
            return jsonify({'error': 'Failed to encode frame'}), 500
        
        frame_bytes = buffer.tobytes()
    
    return Response(frame_bytes, mimetype='image/jpeg')

@app.route('/audio_snapshot')
def audio_snapshot():
    """Get latest 3-second audio clip as base64-encoded WAV"""
    global audio_buffer, audio_lock
    
    if not is_recording:
        return jsonify({'error': 'Audio recording not started'}), 400
    
    if audio_buffer is None:
        return jsonify({
            'error': 'Audio initializing',
            'message': 'Please wait a few seconds for first audio clip',
            'recording': True
        }), 202  # 202 Accepted - processing
    
    with audio_lock:
        # Encode audio as base64
        audio_base64 = base64.b64encode(audio_buffer).decode('utf-8')
    
    return jsonify({
        'success': True,
        'audio': audio_base64,
        'format': 'wav',
        'sample_rate': AUDIO_RATE,
        'channels': AUDIO_CHANNELS,
        'duration': AUDIO_RECORD_SECONDS
    })

if __name__ == '__main__':
    print("="*70)
    print("WEBCAM STREAMING SERVER WITH AUDIO CAPTURE")
    print("="*70)
    print("\nLogitech C270 Webcam + Microphone for Angel Eyes Mobile App")
    print("\nEndpoints:")
    print("  GET  /health            - Check server status")
    print("  GET  /start             - Start webcam stream + audio recording")
    print("  GET  /stop              - Stop webcam stream + audio recording")
    print("  GET  /video_feed        - MJPEG video stream")
    print("  GET  /snapshot          - Single frame JPEG")
    print("  GET  /audio_snapshot    - Latest 3-second audio clip (base64 WAV)")
    print("\nStarting server on http://0.0.0.0:5002")
    print("="*70)
    
    # Auto-start webcam and audio
    print("\n🎥 Auto-starting webcam...")
    webcam_stream.start()
    
    print("\n🎤 Auto-starting audio recording...")
    audio_capture.start()
    
    # Run Flask server
    app.run(host='0.0.0.0', port=5002, threaded=True, debug=False)
