import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../services/api';

export default function DetectionsScreen() {
  const router = useRouter();
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, critical, warning, info
  const [selectedBabyId, setSelectedBabyId] = useState(null);
  const [babyName, setBabyName] = useState('');

  // Sample detection data - replace with API calls
  const sampleDetections = [
    {
      _id: '1',
      type: 'choking_risk',
      severity: 'critical',
      message: 'Potential choking detected - immediate attention required',
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      resolved: false,
      confidence: 0.95,
    },
    {
      _id: '2',
      type: 'unsafe_sleep',
      severity: 'warning',
      message: 'Baby detected in unsafe sleep position',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      resolved: true,
      confidence: 0.87,
    },
    {
      _id: '3',
      type: 'crying_detected',
      severity: 'info',
      message: 'Continuous crying detected for 5 minutes',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      resolved: true,
      confidence: 0.92,
    },
    {
      _id: '4',
      type: 'movement_anomaly',
      severity: 'warning',
      message: 'Unusual movement pattern detected',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      resolved: true,
      confidence: 0.78,
    },
  ];

  useEffect(() => {
    loadSelectedBaby();
  }, []);

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
        loadDetections(babyId);
      } else {
        setLoading(false);
        Alert.alert(
          'No Baby Selected',
          'Please select a baby from the dashboard first.',
          [{ text: 'Go to Dashboard', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      console.error('Failed to load selected baby:', error);
      setLoading(false);
    }
  };

  const loadDetections = async (babyId) => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call that uses babyId
      // const response = await apiClient.getDetections(babyId);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setDetections(sampleDetections);
    } catch (error) {
      console.error('Failed to load detections:', error);
      Alert.alert('Error', 'Failed to load detections');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedBabyId) {
      await loadDetections(selectedBabyId);
    }
    setRefreshing(false);
  };

  const markAsResolved = async (detectionId) => {
    try {
      const updatedDetections = detections.map(detection => {
        if (detection._id === detectionId) {
          return { ...detection, resolved: true };
        }
        return detection;
      });
      setDetections(updatedDetections);
      
      // TODO: Update on backend
      // await apiClient.resolveDetection(detectionId);
    } catch (error) {
      console.error('Failed to resolve detection:', error);
      Alert.alert('Error', 'Failed to resolve detection');
    }
  };

  const getDetectionIcon = (type) => {
    switch (type) {
      case 'choking_risk': return 'warning';
      case 'unsafe_sleep': return 'bed';
      case 'crying_detected': return 'volume-high';
      case 'movement_anomaly': return 'body';
      default: return 'alert-circle';
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#F44336';
      case 'warning': return '#FF9800';
      case 'info': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      return `${days}d ago`;
    }
  };

  const filteredDetections = detections.filter(detection => {
    if (filter === 'all') return true;
    return detection.severity === filter;
  });

  const renderDetectionItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.detectionCard, item.resolved && styles.resolvedCard]}
      onPress={() => {
        if (!item.resolved) {
          Alert.alert(
            'Mark as Resolved',
            'Has this issue been addressed?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Resolved', onPress: () => markAsResolved(item._id) }
            ]
          );
        }
      }}
    >
      <View style={styles.detectionHeader}>
        <View style={[styles.detectionIconContainer, { backgroundColor: getSeverityColor(item.severity) }]}>
          <Ionicons 
            name={getDetectionIcon(item.type)} 
            size={24} 
            color="#fff" 
          />
        </View>
        <View style={styles.detectionInfo}>
          <Text style={[styles.detectionMessage, item.resolved && styles.resolvedMessage]}>
            {item.message}
          </Text>
          <View style={styles.detectionMeta}>
            <Text style={styles.detectionTime}>{formatTimestamp(item.timestamp)}</Text>
            <Text style={styles.detectionConfidence}>
              Confidence: {Math.round(item.confidence * 100)}%
            </Text>
          </View>
        </View>
        <View style={styles.detectionStatus}>
          {item.resolved ? (
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          ) : (
            <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(item.severity) }]}>
              <Text style={styles.severityText}>{item.severity.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6a1b9a" />
        <Text style={styles.loadingText}>Loading detections...</Text>
      </View>
    );
  }

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
          <Text style={styles.title}>AI Detections</Text>
          {babyName ? <Text style={styles.subtitle}>{babyName}</Text> : null}
        </View>
        <View style={styles.placeholder} />
        <TouchableOpacity style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={24} color="#512da8" />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#F44336' }]}>
            {detections.filter(d => d.severity === 'critical' && !d.resolved).length}
          </Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#FF9800' }]}>
            {detections.filter(d => d.severity === 'warning' && !d.resolved).length}
          </Text>
          <Text style={styles.statLabel}>Warnings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#4CAF50' }]}>
            {detections.filter(d => d.resolved).length}
          </Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterContainer}>
        {['all', 'critical', 'warning', 'info'].map((filterType) => (
          <TouchableOpacity
            key={filterType}
            style={[
              styles.filterButton,
              filter === filterType && styles.activeFilterButton
            ]}
            onPress={() => setFilter(filterType)}
          >
            <Text style={[
              styles.filterText,
              filter === filterType && styles.activeFilterText
            ]}>
              {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Detections List */}
      <FlatList
        data={filteredDetections}
        keyExtractor={(item) => item._id}
        renderItem={renderDetectionItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6a1b9a']}
            tintColor="#6a1b9a"
          />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-checkmark" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No {filter === 'all' ? '' : filter} detections</Text>
            <Text style={styles.emptySubtext}>All clear! Your baby is safe.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0eef8',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
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
  settingsButton: {
    padding: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statCard: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  activeFilterButton: {
    backgroundColor: '#512da8',
    borderColor: '#512da8',
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  listContainer: {
    padding: 16,
  },
  detectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  resolvedCard: {
    backgroundColor: '#f8f8f8',
    opacity: 0.8,
  },
  detectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detectionInfo: {
    flex: 1,
  },
  detectionMessage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  resolvedMessage: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  detectionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detectionTime: {
    fontSize: 14,
    color: '#666',
  },
  detectionConfidence: {
    fontSize: 12,
    color: '#999',
  },
  detectionStatus: {
    marginLeft: 16,
    justifyContent: 'center',
  },
  severityBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  severityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
