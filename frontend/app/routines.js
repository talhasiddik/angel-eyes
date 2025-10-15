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

export default function RoutinesScreen() {
  const router = useRouter();
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBabyId, setSelectedBabyId] = useState(null);

  // Sample routine data - replace with API calls
  const sampleRoutines = [
    {
      _id: '1',
      title: 'Morning Feeding',
      type: 'feeding',
      time: '07:00',
      completed: true,
      lastCompleted: new Date(),
    },
    {
      _id: '2',
      title: 'Diaper Change',
      type: 'diaper',
      time: '09:30',
      completed: false,
      lastCompleted: null,
    },
    {
      _id: '3',
      title: 'Afternoon Nap',
      type: 'sleep',
      time: '13:00',
      completed: false,
      lastCompleted: null,
    },
    {
      _id: '4',
      title: 'Evening Bath',
      type: 'hygiene',
      time: '18:00',
      completed: false,
      lastCompleted: null,
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
        loadRoutines(babyId);
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

  const loadRoutines = async (babyId) => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call that uses babyId
      // const response = await apiClient.getRoutines(babyId);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setRoutines(sampleRoutines);
    } catch (error) {
      console.error('Failed to load routines:', error);
      Alert.alert('Error', 'Failed to load routines');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedBabyId) {
      await loadRoutines(selectedBabyId);
    }
    setRefreshing(false);
  };

  const toggleRoutineComplete = (routineId) => {
    try {
      const updatedRoutines = routines.map(routine => {
        if (routine._id === routineId) {
          return {
            ...routine,
            completed: !routine.completed,
            lastCompleted: !routine.completed ? new Date() : null
          };
        }
        return routine;
      });
      setRoutines(updatedRoutines);
      
      // TODO: Update on backend
      // await apiClient.updateRoutine(routineId, { completed: !routine.completed });
    } catch (error) {
      console.error('Failed to update routine:', error);
      Alert.alert('Error', 'Failed to update routine');
    }
  };

  const getRoutineIcon = (type) => {
    switch (type) {
      case 'feeding': return 'restaurant-outline';
      case 'diaper': return 'medical-outline';
      case 'sleep': return 'bed-outline';
      case 'hygiene': return 'water-outline';
      default: return 'checkmark-circle-outline';
    }
  };

  const getRoutineColor = (type) => {
    switch (type) {
      case 'feeding': return '#FF6B6B';
      case 'diaper': return '#FFD93D';
      case 'sleep': return '#4D96FF';
      case 'hygiene': return '#6BCB77';
      default: return '#9C27B0';
    }
  };

  const renderRoutineItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.routineCard, item.completed && styles.completedCard]}
      onPress={() => toggleRoutineCompletion(item._id)}
    >
      <View style={styles.routineHeader}>
        <View style={[styles.routineIconContainer, { backgroundColor: getRoutineColor(item.type) }]}>
          <Ionicons 
            name={getRoutineIcon(item.type)} 
            size={24} 
            color="#fff" 
          />
        </View>
        <View style={styles.routineInfo}>
          <Text style={[styles.routineTitle, item.completed && styles.completedTitle]}>
            {item.title}
          </Text>
          <Text style={styles.routineTime}>Scheduled: {item.time}</Text>
          {item.lastCompleted && (
            <Text style={styles.lastCompleted}>
              Last completed: {item.lastCompleted.toLocaleTimeString()}
            </Text>
          )}
        </View>
        <View style={styles.routineStatus}>
          <Ionicons
            name={item.completed ? "checkmark-circle" : "ellipse-outline"}
            size={32}
            color={item.completed ? "#4CAF50" : "#ccc"}
          />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6a1b9a" />
        <Text style={styles.loadingText}>Loading routines...</Text>
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
        <Text style={styles.title}>Baby Routines</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color="#512da8" />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {routines.filter(r => r.completed).length}
          </Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {routines.filter(r => !r.completed).length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {Math.round((routines.filter(r => r.completed).length / routines.length) * 100) || 0}%
          </Text>
          <Text style={styles.statLabel}>Progress</Text>
        </View>
      </View>

      {/* Routines List */}
      <FlatList
        data={routines}
        keyExtractor={(item) => item._id}
        renderItem={renderRoutineItem}
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
      />

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.quickActionButton, { backgroundColor: '#FF6B6B' }]}>
          <Ionicons name="restaurant" size={20} color="#fff" />
          <Text style={styles.quickActionText}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickActionButton, { backgroundColor: '#FFD93D' }]}>
          <Ionicons name="medical" size={20} color="#fff" />
          <Text style={styles.quickActionText}>Diaper</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickActionButton, { backgroundColor: '#4D96FF' }]}>
          <Ionicons name="bed" size={20} color="#fff" />
          <Text style={styles.quickActionText}>Sleep</Text>
        </TouchableOpacity>
      </View>
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
  addButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#512da8',
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
    color: '#512da8',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  routineCard: {
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
  completedCard: {
    backgroundColor: '#f8f8f8',
    opacity: 0.8,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routineIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  routineInfo: {
    flex: 1,
  },
  routineTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  completedTitle: {
    textDecorationLine: 'line-through',
    color: '#666',
  },
  routineTime: {
    fontSize: 14,
    color: '#666',
  },
  lastCompleted: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 2,
  },
  routineStatus: {
    marginLeft: 16,
  },
  quickActions: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  quickActionText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});
