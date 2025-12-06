import numpy as np
import librosa
import sounddevice as sd
from tensorflow.keras.models import load_model
import queue
import threading
import time
from collections import deque
import os

# Get the directory where this script is located
script_dir = os.path.dirname(os.path.abspath(__file__))

# Load the trained models
print("Loading models...")
stage1_model = load_model(os.path.join(script_dir, 'stage1_cry_detection_model1.h5'), compile=False)
stage1_model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
stage2_model = load_model(os.path.join(script_dir, 'stage2_cry_classification_model.h5'), compile=False)
stage2_model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
print("Models loaded successfully!")

# Audio parameters (must match training parameters)
SAMPLE_RATE = 16000
DURATION = 3  # seconds of audio to analyze
N_MELS = 128
N_FFT = 2048
HOP_LENGTH = 512
MAX_LENGTH = int(DURATION * SAMPLE_RATE)
BUFFER_SIZE = MAX_LENGTH
HOP_LENGTH_STREAM = int(SAMPLE_RATE * 0.5)  # Analyze every 0.5 seconds

# Cry classification labels
CRY_LABELS = ['belly_pain', 'burping', 'cold_hot', 'discomfort', 'hungry', 'tired']

# Audio queue for processing
audio_queue = queue.Queue()
is_recording = True

def extract_features(audio_data):
    """Extract mel spectrogram features from audio data (matches training format)"""
    try:
        # Ensure audio is the right length
        if len(audio_data) < MAX_LENGTH:
            audio_data = np.pad(audio_data, (0, MAX_LENGTH - len(audio_data)), mode='constant')
        else:
            audio_data = audio_data[:MAX_LENGTH]
        
        # Extract Mel spectrogram (exactly as in training)
        mel_spec = librosa.feature.melspectrogram(
            y=audio_data, 
            sr=SAMPLE_RATE, 
            n_mels=N_MELS, 
            n_fft=N_FFT, 
            hop_length=HOP_LENGTH
        )
        # Convert to log scale (dB) - EXACTLY as in training
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
        
        # Add channel dimension (128, 94) -> (128, 94, 1)
        mel_spec_db = mel_spec_db[..., np.newaxis]
        
        return mel_spec_db
    except Exception as e:
        print(f"Error extracting features: {e}")
        return None

def audio_callback(indata, frames, time_info, status):
    """Callback function for audio stream"""
    if status:
        print(f"Status: {status}")
    # Add audio data to queue
    audio_queue.put(indata.copy().flatten())

def process_audio():
    """Process audio from queue and detect/classify cries"""
    audio_buffer = deque(maxlen=BUFFER_SIZE)
    last_detection_time = 0
    
    print("\n" + "="*60)
    print("🎤 REAL-TIME BABY CRY DETECTION & CLASSIFICATION")
    print("="*60)
    print("Listening... Press Ctrl+C to stop")
    print("-"*60 + "\n")
    
    while is_recording:
        try:
            # Get audio data from queue (with timeout to allow checking is_recording)
            audio_chunk = audio_queue.get(timeout=0.1)
            
            # Check if enough time has passed since last detection (3 second cooldown)
            current_time = time.time()
            time_since_detection = current_time - last_detection_time
            
            # Only add to buffer if cooldown period has passed
            if time_since_detection >= 3.0:
                # Add to buffer
                audio_buffer.extend(audio_chunk)
                
                # Process when buffer is full
                if len(audio_buffer) >= BUFFER_SIZE:
                    audio_data = np.array(list(audio_buffer))
                    
                    # Extract features
                    features = extract_features(audio_data)
                    if features is None:
                        # Clear buffer and continue (error in feature extraction)
                        audio_buffer.clear()
                        continue
                    
                    # Reshape for model input: add batch dimension (1, 128, 94, 1)
                    features_reshaped = features.reshape(1, N_MELS, -1, 1)
                    
                    # Stage 1: Detect if there's a cry
                    cry_prediction = stage1_model.predict(features_reshaped, verbose=0)
                    confidence = cry_prediction[0][0]
                    is_cry = confidence > 0.96  # Increased to 90% to reduce false positives
                    
                   
                    
                    if is_cry:
                        print(f"🚨 CRY DETECTED! (Confidence: {confidence*100:.1f}%)")
                        
                        # Stage 2: Classify the type of cry
                        cry_type_prediction = stage2_model.predict(features_reshaped, verbose=0)
                        cry_type_idx = np.argmax(cry_type_prediction[0])
                        cry_type = CRY_LABELS[cry_type_idx]
                        cry_type_confidence = cry_type_prediction[0][cry_type_idx]
                        
                        
                        # Update last detection time and clear buffer immediately
                        last_detection_time = current_time
                        audio_buffer.clear()
                    else:
                        # Occasionally show that it's listening
                        if np.random.random() < 0.1:  # 10% chance
                            print(f"✓ Monitoring... (No cry detected - {time.strftime('%H:%M:%S')})")
                    
                    # Clear buffer after processing
                    audio_buffer.clear()
            else:
                # During cooldown, discard incoming audio to prevent buffer contamination
                pass
                
        except queue.Empty:
            continue
        except Exception as e:
            print(f"Error processing audio: {e}")
            continue

def main():
    global is_recording
    
    try:
        # Start processing thread
        processing_thread = threading.Thread(target=process_audio, daemon=True)
        processing_thread.start()
        
        # Start audio stream
        with sd.InputStream(callback=audio_callback,
                          channels=1,
                          samplerate=SAMPLE_RATE,
                          blocksize=HOP_LENGTH):
            print("Recording started...")
            processing_thread.join()
            
    except KeyboardInterrupt:
        print("\n\n" + "="*60)
        print("🛑 Stopping detection...")
        print("="*60)
        is_recording = False
        time.sleep(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nMake sure you have a microphone connected and accessible.")
    finally:
        print("Thank you for using Baby Cry Detection System!")

if __name__ == "__main__":
    main()
