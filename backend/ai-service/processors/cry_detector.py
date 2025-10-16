"""
Cry Detection Processor
Based on two-stage cry detection models:
- Stage 1: Binary cry detection (cry vs non-cry)
- Stage 2: Cry reason classification (6 classes)
"""

import numpy as np
import os
import io
from tensorflow.keras.models import load_model, Sequential
from tensorflow.keras import layers
import h5py

try:
    import librosa
    import soundfile as sf
    AUDIO_LIBS_AVAILABLE = True
except ImportError:
    AUDIO_LIBS_AVAILABLE = False
    print("⚠️  Audio libraries not available - install librosa and soundfile")

class CryDetector:
    def __init__(self):
        self.stage1_path = os.path.join('models', 'stage1_cry_detection_model.h5')
        self.stage2_path = os.path.join('models', 'stage2_cry_classification_model (1).h5')
        
        self.stage1_model = None  # Cry detection (binary)
        self.stage2_model = None  # Cry classification (6 classes)
        
        # Configuration (from training code)
        self.SAMPLE_RATE = 16000
        self.DURATION = 3
        self.N_MELS = 128
        self.N_FFT = 2048
        self.HOP_LENGTH = 512
        self.MAX_LENGTH = int(self.DURATION * self.SAMPLE_RATE)
        
        # Cry classes (from training code)
        self.CRY_CLASSES = [
            'belly pain',
            'burping',
            'cold_hot',
            'discomfort',
            'hungry',
            'tired'
        ]
        
        self.load_models()
    
    def build_cnn_model(self, input_shape, num_classes):
        """
        Rebuild CNN model architecture to match training code.
        This allows us to load weights without Keras version compatibility issues.
        """
        model = Sequential()
        
        # Conv Block 1
        model.add(layers.Conv2D(32, (3, 3), activation='relu', padding='same', input_shape=input_shape))
        model.add(layers.BatchNormalization())
        model.add(layers.Conv2D(32, (3, 3), activation='relu', padding='same'))
        model.add(layers.BatchNormalization())
        model.add(layers.MaxPooling2D((2, 2)))
        model.add(layers.Dropout(0.25))
        
        # Conv Block 2
        model.add(layers.Conv2D(64, (3, 3), activation='relu', padding='same'))
        model.add(layers.BatchNormalization())
        model.add(layers.Conv2D(64, (3, 3), activation='relu', padding='same'))
        model.add(layers.BatchNormalization())
        model.add(layers.MaxPooling2D((2, 2)))
        model.add(layers.Dropout(0.25))
        
        # Conv Block 3
        model.add(layers.Conv2D(128, (3, 3), activation='relu', padding='same'))
        model.add(layers.BatchNormalization())
        model.add(layers.Conv2D(128, (3, 3), activation='relu', padding='same'))
        model.add(layers.BatchNormalization())
        model.add(layers.MaxPooling2D((2, 2)))
        model.add(layers.Dropout(0.25))
        
        # Conv Block 4
        model.add(layers.Conv2D(256, (3, 3), activation='relu', padding='same'))
        model.add(layers.BatchNormalization())
        model.add(layers.MaxPooling2D((2, 2)))
        model.add(layers.Dropout(0.25))
        
        # Dense layers
        model.add(layers.GlobalAveragePooling2D())
        model.add(layers.Dense(256, activation='relu'))
        model.add(layers.BatchNormalization())
        model.add(layers.Dropout(0.5))
        model.add(layers.Dense(128, activation='relu'))
        model.add(layers.Dropout(0.5))
        
        # Output layer
        if num_classes == 2:
            model.add(layers.Dense(1, activation='sigmoid'))
        else:
            model.add(layers.Dense(num_classes, activation='softmax'))
        
        return model
    
    def load_models(self):
        """Load both Keras models by rebuilding architecture and loading weights"""
        import tensorflow as tf
        
        try:
            # Stage 1: Binary Cry Detection (cry vs non-cry)
            if os.path.exists(self.stage1_path):
                print(f"🔄 Loading Stage 1 model from {self.stage1_path}...")
                
                # Rebuild model architecture
                self.stage1_model = self.build_cnn_model(
                    input_shape=(128, 94, 1),  # (n_mels, time_steps, channels)
                    num_classes=2  # Binary classification
                )
                
                # Load weights only (avoids Keras version issues)
                self.stage1_model.load_weights(self.stage1_path)
                
                # Compile model
                self.stage1_model.compile(
                    optimizer='adam',
                    loss='binary_crossentropy',
                    metrics=['accuracy']
                )
                
                print(f"✅ Cry detection model (stage 1) loaded successfully")
            else:
                print(f"⚠️  Cry detection model not found at {self.stage1_path}")
                self.stage1_model = None
            
            # Stage 2: Cry Reason Classification (6 classes)
            if os.path.exists(self.stage2_path):
                print(f"🔄 Loading Stage 2 model from {self.stage2_path}...")
                
                # Rebuild model architecture
                self.stage2_model = self.build_cnn_model(
                    input_shape=(128, 94, 1),
                    num_classes=6  # 6 cry reasons
                )
                
                # Load weights only
                self.stage2_model.load_weights(self.stage2_path)
                
                # Compile model
                self.stage2_model.compile(
                    optimizer='adam',
                    loss='categorical_crossentropy',
                    metrics=['accuracy']
                )
                
                print(f"✅ Cry classification model (stage 2) loaded successfully")
            else:
                print(f"⚠️  Cry classification model not found at {self.stage2_path}")
                self.stage2_model = None
                
        except Exception as e:
            print(f"❌ Error loading cry detection models: {e}")
            import traceback
            traceback.print_exc()
            self.stage1_model = None
            self.stage2_model = None
    
    def is_loaded(self):
        """Check if both models are loaded"""
        return (self.stage1_model is not None and 
                self.stage2_model is not None and 
                AUDIO_LIBS_AVAILABLE)
    
    def preprocess_audio(self, audio_bytes):
        """
        Preprocess audio for cry detection
        Extracts Mel spectrogram features
        Based on training code from cry.py
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
                audio = librosa.resample(audio, orig_sr=sr, target_sr=self.SAMPLE_RATE)
            
            # Pad or truncate to fixed length (3 seconds)
            if len(audio) < self.MAX_LENGTH:
                audio = np.pad(audio, (0, self.MAX_LENGTH - len(audio)), mode='constant')
            else:
                audio = audio[:self.MAX_LENGTH]
            
            # Extract Mel spectrogram
            mel_spec = librosa.feature.melspectrogram(
                y=audio,
                sr=self.SAMPLE_RATE,
                n_mels=self.N_MELS,
                n_fft=self.N_FFT,
                hop_length=self.HOP_LENGTH
            )
            
            # Convert to log scale (dB)
            mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
            
            # Add channel dimension for CNN (128, 94, 1)
            mel_spec_db = mel_spec_db[..., np.newaxis]
            
            # Add batch dimension (1, 128, 94, 1)
            mel_spec_db = mel_spec_db[np.newaxis, ...]
            
            return mel_spec_db
            
        except Exception as e:
            print(f"❌ Audio preprocessing error: {e}")
            return None
    
    def detect_from_bytes(self, audio_bytes):
        """
        Two-stage cry detection from audio bytes
        Stage 1: Detect if crying (binary)
        Stage 2: Classify cry reason (6 classes)
        """
        # Mock mode if models not loaded
        if not self.is_loaded():
            return {
                'is_crying': False,
                'confidence': 0.0,
                'cry_reason': None,
                'reason_confidence': 0.0,
                'status': 'mock',
                'message': 'Models or audio libraries not loaded - using mock detection',
                'recommendations': []
            }
        
        try:
            # Preprocess audio to Mel spectrogram
            features = self.preprocess_audio(audio_bytes)
            
            if features is None:
                return {
                    'is_crying': False,
                    'confidence': 0.0,
                    'status': 'error',
                    'message': 'Audio preprocessing failed',
                    'cry_reason': None,
                    'recommendations': []
                }
            
            # === Stage 1: Cry Detection (Binary) ===
            stage1_pred = self.stage1_model.predict(features, verbose=0)
            cry_probability = float(stage1_pred[0][0])
            is_crying = cry_probability > 0.5
            
            result = {
                'is_crying': is_crying,
                'confidence': cry_probability if is_crying else (1 - cry_probability),
                'cry_probability': cry_probability,
                'status': 'detected'
            }
            
            # === Stage 2: Cry Classification (if crying) ===
            if is_crying and self.stage2_model is not None:
                stage2_pred = self.stage2_model.predict(features, verbose=0)
                
                # Get predicted class
                cry_type_idx = np.argmax(stage2_pred[0])
                cry_type = self.CRY_CLASSES[cry_type_idx]
                cry_type_confidence = float(stage2_pred[0][cry_type_idx])
                
                result['cry_reason'] = cry_type
                result['reason_confidence'] = cry_type_confidence
                result['all_probabilities'] = {
                    self.CRY_CLASSES[i]: float(stage2_pred[0][i]) 
                    for i in range(len(self.CRY_CLASSES))
                }
                result['recommendations'] = self.get_recommendations(cry_type)
                result['message'] = f'Baby is crying - Reason: {cry_type}'
            else:
                result['cry_reason'] = None
                result['reason_confidence'] = 0.0
                result['recommendations'] = []
                result['message'] = 'No crying detected'
            
            return result
            
        except Exception as e:
            print(f"❌ Cry detection error: {e}")
            return {
                'is_crying': False,
                'confidence': 0.0,
                'status': 'error',
                'error': str(e),
                'cry_reason': None,
                'recommendations': []
            }
    
    def get_recommendations(self, cry_type):
        """
        Get actionable recommendations based on cry reason
        From training code recommendations
        """
        recommendations = {
            'belly pain': [
                '⚠️ Check for signs of pain or discomfort',
                '🩺 Gently massage baby\'s belly',
                '📞 Consult doctor if persistent'
            ],
            'burping': [
                '💨 Hold baby upright and pat back gently',
                '⏰ Try burping during and after feeding',
                '🤱 Check feeding technique'
            ],
            'cold_hot': [
                '🌡️ Check room temperature (68-72°F / 20-22°C)',
                '👶 Adjust baby\'s clothing layers',
                '✋ Feel baby\'s neck/back to check temperature'
            ],
            'discomfort': [
                '🍼 Check if diaper needs changing',
                '👕 Check for tight clothing or tags',
                '🛏️ Adjust baby\'s position'
            ],
            'hungry': [
                '🍼 Offer milk/formula',
                '⏰ Check last feeding time',
                '👶 Look for hunger cues (rooting, sucking)'
            ],
            'tired': [
                '😴 Create calm, quiet environment',
                '🌙 Try soothing techniques (rocking, white noise)',
                '⏰ Check nap schedule'
            ]
        }
        
        return recommendations.get(cry_type, ['Monitor baby closely', 'Provide comfort'])
