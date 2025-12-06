"""
Webcam Streaming Server for Logitech C270
Streams webcam video over HTTP with MJPEG format
Mobile app can connect to this stream
"""

from flask import Flask, Response, jsonify
from flask_cors import CORS
import cv2
import threading
import time

app = Flask(__name__)
CORS(app)

# Global variables
camera = None
output_frame = None
lock = threading.Lock()
is_streaming = False

class WebcamStream:
    def __init__(self, camera_index=0):
        """Initialize webcam stream"""
        self.camera_index = camera_index
        self.camera = None
        self.is_running = False
        
    def start(self):
        """Start the webcam stream"""
        global camera, is_streaming
        
        if self.is_running:
            print("⚠️  Stream already running")
            return True
            
        # Try to open camera
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

# Global stream instance
webcam_stream = WebcamStream(camera_index=1)

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
        'streaming': is_streaming,
        'camera_index': webcam_stream.camera_index
    })

@app.route('/start')
def start_stream():
    """Start webcam streaming"""
    success = webcam_stream.start()
    return jsonify({
        'success': success,
        'message': 'Stream started' if success else 'Failed to start stream'
    })

@app.route('/stop')
def stop_stream():
    """Stop webcam streaming"""
    webcam_stream.stop()
    return jsonify({
        'success': True,
        'message': 'Stream stopped'
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

if __name__ == '__main__':
    print("="*70)
    print("WEBCAM STREAMING SERVER")
    print("="*70)
    print("\nLogitech C270 Webcam Stream for Angel Eyes Mobile App")
    print("\nEndpoints:")
    print("  GET  /health        - Check server status")
    print("  GET  /start         - Start webcam stream")
    print("  GET  /stop          - Stop webcam stream")
    print("  GET  /video_feed    - MJPEG video stream")
    print("  GET  /snapshot      - Single frame JPEG")
    print("\nStarting server on http://0.0.0.0:5002")
    print("="*70)
    
    # Auto-start webcam
    print("\n🎥 Auto-starting webcam...")
    webcam_stream.start()
    
    # Run Flask server
    app.run(host='0.0.0.0', port=5002, threaded=True, debug=False)
