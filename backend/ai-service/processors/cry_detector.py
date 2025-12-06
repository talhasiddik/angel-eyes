"""
Cry Detection Processor
Binary cry detection only (cry vs non-cry)
"""

import numpy as np
import os
import io
from tensorflow.keras.models import load_model

try:
    import librosa
    import soundfile as sf
    AUDIO_LIBS_AVAILABLE = True
except ImportError:
    AUDIO_LIBS_AVAILABLE = False

class CryDetector:
    def __init__(self):
        # Use updated model - stage1 only for binary cry detection
        base_dir = os.path.dirname(os.path.dirname(__file__))
        self.model_path = os.path.join(base_dir, 'updatedModels', 'stage1_cry_detection_model1.h5')
        
        self.model = None  # Binary cry detection model
        
        # Configuration (from training code)
        self.SAMPLE_RATE = 16000
        self.DURATION = 3
        self.N_MELS = 128
        self.N_FFT = 2048
        self.HOP_LENGTH = 512
        self.MAX_LENGTH = int(self.DURATION * self.SAMPLE_RATE)
        
        self.load_model()
    
    def load_model(self):
        """Load cry detection model (binary classification only)"""
        try:
            if not AUDIO_LIBS_AVAILABLE:
                print("⚠️  Cannot load cry detector - audio libraries not available")
                return
            
            # Load binary cry detection model
            if os.path.exists(self.model_path):
                print(f"🔄 Loading cry detection model from {self.model_path}...")
                
                try:
                    # Try loading directly
                    self.model = load_model(self.model_path, compile=False)
                    self.model.compile(
                        optimizer='adam',
                        loss='binary_crossentropy',
                        metrics=['accuracy']
                    )
                    print(f"✅ Cry detection model loaded successfully")
                except Exception as e:
                    print(f"❌ Failed to load cry detection model: {e}")
                    self.model = None
            else:
                print(f"⚠️  Cry detection model not found at {self.model_path}")
                self.model = None
                
        except Exception as e:
            print(f"❌ Error loading cry detection model: {e}")
            import traceback
            traceback.print_exc()
            self.model = None
    
    def is_loaded(self):
        """Check if model is loaded"""
        return self.model is not None and AUDIO_LIBS_AVAILABLE
    
    def preprocess_audio(self, audio_bytes):
        """
        Preprocess audio for cry detection
        Extracts Mel spectrogram features
        Based on training code from realtime_cry_detection.py
        """
        if not AUDIO_LIBS_AVAILABLE:
            return None
        
        try:
            # Load audio from bytes
            audio_buffer = io.BytesIO(audio_bytes)
            audio, sr = sf.read(audio_buffer)
            
            # Convert stereo to mono if needed
            if len(audio.shape) > 1:
                audio = np.mean(audio, axis=1)
            
            # Resample to target sample rate if needed
            if sr != self.SAMPLE_RATE:
                audio = librosa.resample(y=audio, orig_sr=sr, target_sr=self.SAMPLE_RATE)
            
            # Ensure audio is exactly 3 seconds
            if len(audio) < self.MAX_LENGTH:
                # Pad with zeros if too short
                audio = np.pad(audio, (0, self.MAX_LENGTH - len(audio)))
            else:
                # Trim if too long
                audio = audio[:self.MAX_LENGTH]
            
            # Extract Mel spectrogram (exactly as in training)
            mel_spec = librosa.feature.melspectrogram(
                y=audio,
                sr=self.SAMPLE_RATE,
                n_mels=self.N_MELS,
                n_fft=self.N_FFT,
                hop_length=self.HOP_LENGTH
            )
            
            # Convert to log scale (dB)
            mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
            
            # Add channel dimension (128, 94) -> (128, 94, 1)
            mel_spec_db = mel_spec_db[..., np.newaxis]
            
            return mel_spec_db
            
        except Exception as e:
            print(f"Error preprocessing audio: {e}")
            return None
    
    def detect(self, audio_bytes):
        """
        Detect if baby is crying from audio
        Returns dict with cry detection results (binary only)
        """
        if not self.is_loaded():
            return {
                'is_crying': False,
                'confidence': 0.0,
                'error': 'Model not loaded or audio libraries not available'
            }
        
        try:
            # Preprocess audio
            features = self.preprocess_audio(audio_bytes)
            if features is None:
                return {
                    'is_crying': False,
                    'confidence': 0.0,
                    'error': 'Failed to preprocess audio'
                }
            
            # Reshape for model input: add batch dimension (1, 128, 94, 1)
            features_reshaped = features.reshape(1, self.N_MELS, -1, 1)
            
            # Binary cry detection
            prediction = self.model.predict(features_reshaped, verbose=0)
            confidence = float(prediction[0][0])
            is_crying = confidence > 0.96  # Same threshold as training code
            
            return {
                'is_crying': is_crying,
                'confidence': confidence
            }
            
        except Exception as e:
            print(f"Error during cry detection: {e}")
            import traceback
            traceback.print_exc()
            return {
                'is_crying': False,
                'confidence': 0.0,
                'error': str(e)
            }
