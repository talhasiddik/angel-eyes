import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../services/api';

// Flask AI Service URL - CHANGE THIS TO YOUR COMPUTER'S IP
const AI_SERVICE_URL = 'http://192.168.18.142:5001';
// Webcam Stream Server URL - CHANGE THIS TO YOUR COMPUTER'S IP
const WEBCAM_STREAM_URL = 'http://192.168.18.142:5002';

export default function MonitoringScreen() {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedBabyId, setSelectedBabyId] = useState(null);
  const [babyName, setBabyName] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');
  
  // AI Detection States
  const [aiResults, setAiResults] = useState({
    sleepSafety: {
      isSafe: null,
      confidence: 0,
      alertLevel: 'normal',
      position: 'unknown',
      status: null,
      message: ''
    },
    cryDetection: {
      isCrying: false,
      cryProbability: 0,
      cryReason: null,
      reasonConfidence: 0,
      recommendations: []
    },
    lastUpdate: null
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [webcamUrl, setWebcamUrl] = useState(null);
  const analysisIntervalRef = useRef(null);

  useEffect(() => {
    loadSelectedBaby();
  }, []);

  useEffect(() => {
    let interval;
    if (isMonitoring && sessionStartTime) {
      interval = setInterval(() => {
        const now = new Date();
        const diff = Math.floor((now - sessionStartTime) / 1000);
        const hours = Math.floor(diff / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const seconds = (diff % 60).toString().padStart(2, '0');
        setSessionDuration(`${hours}:${minutes}:${seconds}`);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isMonitoring, sessionStartTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop AI analysis
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
      }
      
      // End session when navigating away
      if (isMonitoring && sessionId) {
        apiClient.patch(`/monitoring/sessions/${sessionId}`, {
          status: 'ended'
        }).catch(err => console.error('Failed to end session on unmount:', err));
      }
    };
  }, [isMonitoring, sessionId]);

  const loadSelectedBaby = async () => {
    try {
      const babyId = await AsyncStorage.getItem('selectedBabyId');
      if (babyId) {
        setSelectedBabyId(babyId);
        // Load baby details to show name
        const response = await apiClient.getBabies();
        if (response.success) {
          const baby = response.data.babies.find(b => b.id === babyId);
          if (baby) {
            setBabyName(baby.name);
          }
        }
      } else {
        Alert.alert(
          'No Baby Selected',
          'Please select a baby from the dashboard first.',
          [{ text: 'Go to Dashboard', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error('Failed to load selected baby:', error);
    }
  };

  // AI Analysis Functions
  const captureAndAnalyzeFrame = async () => {
    if (isAnalyzing) return;

    try {
      setIsAnalyzing(true);

      // Get snapshot from webcam stream server
      const snapshotResponse = await fetch(`${WEBCAM_STREAM_URL}/snapshot`);
      
      if (!snapshotResponse.ok) {
        console.log('❌ Failed to get webcam snapshot');
        return;
      }

      // Convert to base64
      const blob = await snapshotResponse.blob();
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result.split(',')[1];
          resolve(base64data);
        };
        reader.readAsDataURL(blob);
      });

      if (!base64) {
        console.log('❌ No base64 image data');
        return;
      }

      console.log('✅ Webcam snapshot captured, sending to AI service...');

      // Send to AI service for sleep safety analysis
      const response = await fetch(`${AI_SERVICE_URL}/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frame: base64,  // Backend expects 'frame' not 'image'
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('🤖 AI Result:', result);
        
        // Update sleep safety results
        setAiResults(prev => ({
          ...prev,
          sleepSafety: {
            isSafe: result.is_safe,
            confidence: result.confidence || 0,
            alertLevel: result.alert_level || 'normal',
            position: result.position_classification || result.position || 'unknown',
            status: result.status || 'detection',
            message: result.message || ''
          },
          lastUpdate: new Date()
        }));

        // Show alert for unsafe conditions (only if baby is actually detected)
        if (!result.is_safe && result.alert_level === 'critical' && result.status !== 'no_detection') {
          Alert.alert(
            '⚠️ Safety Alert',
            `Unsafe sleeping position detected!\nPosition: ${result.position_classification}\nConfidence: ${(result.confidence * 100).toFixed(1)}%`,
            [{ text: 'OK' }]
          );
        }
      } else {
        const errorText = await response.text();
        console.error('❌ AI service error:', response.status, errorText);
      }
    } catch (error) {
      console.error('❌ Frame analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startAIAnalysis = () => {
    // Clear any existing interval
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
    }

    // Start periodic frame analysis (every 2 seconds)
    analysisIntervalRef.current = setInterval(() => {
      captureAndAnalyzeFrame();
    }, 2000);

    // First analysis immediately
    setTimeout(() => captureAndAnalyzeFrame(), 1000);
  };

  const stopAIAnalysis = () => {
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = null;
    }
    
    // Reset AI results
    setAiResults({
      sleepSafety: {
        isSafe: null,
        confidence: 0,
        alertLevel: 'normal',
        position: 'unknown',
        status: null,
        message: ''
      },
      cryDetection: {
        isCrying: false,
        cryProbability: 0,
        cryReason: null,
        reasonConfidence: 0,
        recommendations: []
      },
      lastUpdate: null
    });
  };

  const startMonitoring = async () => {
    try {
      // Check webcam stream server
      try {
        const healthCheck = await fetch(`${WEBCAM_STREAM_URL}/health`);
        if (!healthCheck.ok) {
          Alert.alert(
            'Webcam Server Not Running',
            'Please start the webcam stream server first:\n\ncd backend\npython webcam-stream-server.py',
            [{ text: 'OK' }]
          );
          return;
        }
        // Start webcam stream
        await fetch(`${WEBCAM_STREAM_URL}/start`);
      } catch (err) {
        Alert.alert(
          'Cannot Connect to Webcam',
          'Make sure webcam stream server is running on port 5002',
          [{ text: 'OK' }]
        );
        return;
      }

      setIsConnecting(true);

      // Set webcam stream URL with cache buster
      setWebcamUrl(`${WEBCAM_STREAM_URL}/video_feed?t=${Date.now()}`);

      // Create monitoring session in backend
      const response = await apiClient.post('/monitoring/sessions', {
        babyId: selectedBabyId,
        deviceType: 'webcam',
        deviceName: 'Logitech C270'
      });

      if (response.success) {
        setSessionId(response.data.session.id);
        setSessionStartTime(new Date());
        setIsMonitoring(true);
        
        // Start AI analysis
        startAIAnalysis();
        
        Alert.alert('Success', 'Live monitoring with AI detection started!');
      } else {
        throw new Error(response.message || 'Failed to create session');
      }
    } catch (error) {
      console.error('Failed to start monitoring:', error);
      Alert.alert('Error', 'Failed to start monitoring. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const stopMonitoring = async () => {
    Alert.alert(
      'Stop Monitoring',
      'Are you sure you want to stop live monitoring?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Stop', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Stop AI analysis first
              stopAIAnalysis();
              
              // Clear webcam URL
              setWebcamUrl(null);
              
              // End monitoring session in backend
              if (sessionId) {
                await apiClient.patch(`/monitoring/sessions/${sessionId}`, {
                  status: 'ended'
                });
              }
              
              setIsMonitoring(false);
              setSessionId(null);
              setSessionStartTime(null);
              Alert.alert('Stopped', 'Live monitoring has been stopped.');
            } catch (error) {
              console.error('Failed to stop monitoring:', error);
              // Still stop locally even if backend fails
              stopAIAnalysis();
              setWebcamUrl(null);
              setIsMonitoring(false);
              setSessionId(null);
              setSessionStartTime(null);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#512da8" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Live Monitoring</Text>
          {babyName ? <Text style={styles.subtitle}>{babyName}</Text> : null}
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={true}
      >
        {/* Camera Preview */}
        <View style={styles.cameraContainer}>
          {isMonitoring && webcamUrl ? (
            <View style={styles.camera}>
              <WebView
                source={{ uri: webcamUrl }}
                style={styles.webcamStream}
                scrollEnabled={false}
                scalesPageToFit={true}
                bounces={false}
              />
              <View style={styles.cameraOverlay}>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>LIVE - WEBCAM</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Ionicons 
                name="videocam-outline" 
                size={80} 
                color="#ccc" 
              />
              <Text style={styles.cameraText}>
                Logitech C270 Webcam
              </Text>
              <Text style={styles.cameraSubtext}>
                {isMonitoring ? 'Loading webcam...' : 'Tap Start Monitoring to begin'}
              </Text>
            </View>
          )}
        </View>

        {/* Control Buttons */}
        <View style={styles.controlsContainer}>
          {!isMonitoring ? (
            <TouchableOpacity
              style={[styles.controlButton, styles.startButton]}
              onPress={startMonitoring}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="play" size={24} color="#fff" />
              )}
              <Text style={styles.controlButtonText}>
                {isConnecting ? 'Connecting...' : 'Start Monitoring'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.controlButton, styles.stopButton]}
              onPress={stopMonitoring}
            >
              <Ionicons name="stop" size={24} color="#fff" />
              <Text style={styles.controlButtonText}>Stop Monitoring</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Status Info */}
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <Ionicons 
              name="wifi" 
              size={20} 
              color={isMonitoring ? "#4CAF50" : "#ccc"} 
            />
            <Text style={styles.statusText}>
              {isMonitoring ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Ionicons 
              name="time-outline" 
              size={20} 
              color={isMonitoring ? "#2196F3" : "#ccc"} 
            />
            <Text style={styles.statusText}>
              Duration: {sessionDuration}
            </Text>
          </View>
          
          <View style={styles.statusItem}>
            <Ionicons 
              name={aiResults.sleepSafety.isSafe === true ? "shield-checkmark" : 
                    aiResults.sleepSafety.isSafe === false ? "warning" : "shield-outline"} 
              size={20} 
              color={aiResults.sleepSafety.isSafe === true ? "#4CAF50" : 
                     aiResults.sleepSafety.isSafe === false ? "#F44336" : "#ccc"} 
            />
            <Text style={styles.statusText}>
              AI Detection {isMonitoring ? 'Active' : 'Inactive'}
              {isAnalyzing && ' 🔄'}
            </Text>
          </View>
        </View>

        {/* Real-time AI Results */}
        {isMonitoring && aiResults.lastUpdate && (
          <View style={styles.aiResultsContainer}>
            <Text style={styles.aiResultsTitle}>🤖 Live AI Analysis</Text>
            
            {/* Sleep Safety Status */}
            <View style={[
              styles.aiResultCard,
              { borderLeftColor: aiResults.sleepSafety.status === 'no_detection' ? '#FF9800' : 
                                 aiResults.sleepSafety.isSafe ? '#4CAF50' : '#F44336' }
            ]}>
              <View style={styles.aiResultHeader}>
                <Ionicons 
                  name="bed" 
                  size={24} 
                  color={aiResults.sleepSafety.status === 'no_detection' ? '#FF9800' : 
                         aiResults.sleepSafety.isSafe ? '#4CAF50' : '#F44336'} 
                />
                <Text style={styles.aiResultTitle}>Sleep Safety</Text>
              </View>
              
              <View style={styles.aiResultContent}>
                {aiResults.sleepSafety.status === 'no_detection' ? (
                  <>
                    <Text style={[
                      styles.aiResultStatus,
                      { color: '#FF9800' }
                    ]}>
                      👁️ NO BABY DETECTED
                    </Text>
                    <Text style={styles.aiResultMessage}>
                      {aiResults.sleepSafety.message || 'No baby visible in camera view'}
                    </Text>
                    <Text style={styles.aiResultHint}>
                      💡 Point the camera at the baby to start monitoring
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[
                      styles.aiResultStatus,
                      { color: aiResults.sleepSafety.isSafe ? '#4CAF50' : '#F44336' }
                    ]}>
                      {aiResults.sleepSafety.isSafe ? '✅ SAFE' : '⚠️ UNSAFE'}
                    </Text>
                    
                    <View style={styles.aiResultDetails}>
                      <Text style={styles.aiResultLabel}>Position:</Text>
                      <Text style={styles.aiResultValue}>
                        {aiResults.sleepSafety.position || 'Detecting...'}
                      </Text>
                    </View>
                    
                    <View style={styles.aiResultDetails}>
                      <Text style={styles.aiResultLabel}>Confidence:</Text>
                      <Text style={styles.aiResultValue}>
                        {(aiResults.sleepSafety.confidence * 100).toFixed(1)}%
                      </Text>
                    </View>
                    
                    <View style={styles.aiResultDetails}>
                      <Text style={styles.aiResultLabel}>Alert Level:</Text>
                      <Text style={[
                        styles.aiResultValue,
                        { color: aiResults.sleepSafety.alertLevel === 'critical' ? '#F44336' :
                                 aiResults.sleepSafety.alertLevel === 'warning' ? '#FF9800' : '#4CAF50' }
                      ]}>
                        {aiResults.sleepSafety.alertLevel.toUpperCase()}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Cry Detection Status */}
            <View style={[
              styles.aiResultCard,
              { borderLeftColor: aiResults.cryDetection.isCrying ? '#FF6B6B' : '#4CAF50' }
            ]}>
              <View style={styles.aiResultHeader}>
                <Ionicons 
                  name="volume-high" 
                  size={24} 
                  color={aiResults.cryDetection.isCrying ? '#FF6B6B' : '#4CAF50'} 
                />
                <Text style={styles.aiResultTitle}>Cry Detection</Text>
              </View>
              
              <View style={styles.aiResultContent}>
                <Text style={[
                  styles.aiResultStatus,
                  { color: aiResults.cryDetection.isCrying ? '#FF6B6B' : '#4CAF50' }
                ]}>
                  {aiResults.cryDetection.isCrying ? '🔊 CRYING DETECTED' : '✅ No Crying'}
                </Text>
                
                {aiResults.cryDetection.isCrying && aiResults.cryDetection.cryReason && (
                  <>
                    <View style={styles.aiResultDetails}>
                      <Text style={styles.aiResultLabel}>Reason:</Text>
                      <Text style={styles.aiResultValue}>
                        {aiResults.cryDetection.cryReason}
                      </Text>
                    </View>
                    
                    <View style={styles.aiResultDetails}>
                      <Text style={styles.aiResultLabel}>Confidence:</Text>
                      <Text style={styles.aiResultValue}>
                        {(aiResults.cryDetection.reasonConfidence * 100).toFixed(1)}%
                      </Text>
                    </View>
                    
                    {aiResults.cryDetection.recommendations && 
                     aiResults.cryDetection.recommendations.length > 0 && (
                      <View style={styles.recommendationsContainer}>
                        <Text style={styles.recommendationsTitle}>💡 Recommendations:</Text>
                        {aiResults.cryDetection.recommendations.map((rec, idx) => (
                          <Text key={idx} style={styles.recommendationText}>
                            • {rec}
                          </Text>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>
            
            <Text style={styles.lastUpdateText}>
              Last updated: {new Date(aiResults.lastUpdate).toLocaleTimeString()}
            </Text>
          </View>
        )}

        {/* Feature Info - Only show when not monitoring */}
        {!isMonitoring && (
          <View style={styles.featuresContainer}>
            <Text style={styles.featuresTitle}>AI Safety Features</Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Ionicons name="bed" size={16} color="#4D96FF" />
                <Text style={styles.featureText}>Sleep Position Safety Detection</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="volume-high" size={16} color="#FF6B6B" />
                <Text style={styles.featureText}>Cry Detection & Reason Classification</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="shield-checkmark" size={16} color="#6BCB77" />
                <Text style={styles.featureText}>Real-time AI Monitoring</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0eef8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#512da8',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
  },
  cameraContainer: {
    height: 400,  // Fixed height so it doesn't take full screen
    backgroundColor: '#000',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  webcamStream: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  cameraText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  cameraSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
  },
  controlsContainer: {
    marginBottom: 20,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  statusContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  featuresContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#512da8',
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
  aiResultsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  aiResultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#512da8',
    marginBottom: 16,
  },
  aiResultCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  aiResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  aiResultContent: {
    paddingLeft: 32,
  },
  aiResultStatus: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  aiResultDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiResultLabel: {
    fontSize: 14,
    color: '#666',
  },
  aiResultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  aiResultMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  aiResultHint: {
    fontSize: 13,
    color: '#FF9800',
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  recommendationsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#512da8',
    marginBottom: 8,
  },
  recommendationText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
    lineHeight: 18,
  },
  lastUpdateText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
  },
});
