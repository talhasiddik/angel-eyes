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
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import apiClient from '../services/api';

export default function MonitoringScreen() {
  const router = useRouter();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedBabyId, setSelectedBabyId] = useState(null);
  const [babyName, setBabyName] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [sessionDuration, setSessionDuration] = useState('00:00:00');

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
      if (isMonitoring && sessionId) {
        // End session when navigating away
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

  const startMonitoring = async () => {
    try {
      // Check camera permission
      if (!permission) {
        Alert.alert('Error', 'Camera permissions not loaded');
        return;
      }

      if (!permission.granted) {
        const { granted } = await requestPermission();
        if (!granted) {
          Alert.alert(
            'Camera Permission Required',
            'Please grant camera permission to use live monitoring.',
            [{ text: 'OK' }]
          );
          return;
        }
      }

      setIsConnecting(true);

      // Create monitoring session in backend
      const response = await apiClient.post('/monitoring/sessions', {
        babyId: selectedBabyId,
        deviceType: 'mobile',
        deviceName: 'Mobile Camera'
      });

      if (response.success) {
        setSessionId(response.data.session.id);
        setSessionStartTime(new Date());
        setIsMonitoring(true);
        Alert.alert('Success', 'Live monitoring started successfully!');
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

      <View style={styles.content}>
        {/* Camera Preview */}
        <View style={styles.cameraContainer}>
          {isMonitoring && permission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing="back"
              mode="video"
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingText}>LIVE</Text>
                </View>
              </View>
            </CameraView>
          ) : (
            <View style={styles.cameraPlaceholder}>
              <Ionicons 
                name="videocam-outline" 
                size={80} 
                color="#ccc" 
              />
              <Text style={styles.cameraText}>
                {!permission?.granted ? 'Camera Access Required' : 'Camera Feed'}
              </Text>
              <Text style={styles.cameraSubtext}>
                {isMonitoring ? 'Loading camera...' : 'Tap Start Monitoring to begin'}
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
              name="shield-checkmark" 
              size={20} 
              color={isMonitoring ? "#4CAF50" : "#ccc"} 
            />
            <Text style={styles.statusText}>
              AI Detection {isMonitoring ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* Feature Info */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>AI Safety Features</Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="warning" size={16} color="#FF6B6B" />
              <Text style={styles.featureText}>Choking Detection</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="bed" size={16} color="#4D96FF" />
              <Text style={styles.featureText}>Safe Sleep Monitoring</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="heart" size={16} color="#6BCB77" />
              <Text style={styles.featureText}>Vital Signs Tracking</Text>
            </View>
          </View>
        </View>
      </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
    width: '100%',
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
});
