import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, SafeAreaView,
  FlatList, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../services/api';

export default function RoutinesScreen() {
  const router = useRouter();
  const [routines, setRoutines] = useState([]);
  const [todayEntries, setTodayEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBabyId, setSelectedBabyId] = useState(null);
  const [selectedBabyName, setSelectedBabyName] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [quickActionModal, setQuickActionModal] = useState(null);
  const [routineName, setRoutineName] = useState('');
  const [routineType, setRoutineType] = useState('Custom');
  const [routineTime, setRoutineTime] = useState('09:00');
  const [routineNotes, setRoutineNotes] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDuration, setQuickDuration] = useState('');

  useEffect(() => { loadSelectedBaby(); }, []);

  const handleTimeChange = (text) => {
    // Remove non-numeric characters except colon
    let cleaned = text.replace(/[^\d:]/g, '');
    
    // Auto-add colon after 2 digits
    if (cleaned.length === 2 && !cleaned.includes(':')) {
      cleaned = cleaned + ':';
    }
    
    // Limit to HH:MM format (5 characters)
    if (cleaned.length <= 5) {
      setRoutineTime(cleaned);
    }
  };

  const loadSelectedBaby = async () => {
    try {
      const babyId = await AsyncStorage.getItem('selectedBabyId');
      const babyName = await AsyncStorage.getItem('selectedBabyName');
      if (babyId) {
        setSelectedBabyId(babyId);
        setSelectedBabyName(babyName || 'Baby');
        loadRoutinesData(babyId);
      } else {
        setLoading(false);
        Alert.alert('No Baby Selected', 'Please select a baby from the dashboard first.',
          [{ text: 'Go to Dashboard', onPress: () => router.back() }]);
      }
    } catch (error) {
      console.error('Failed to load selected baby:', error);
      setLoading(false);
    }
  };

  const loadRoutinesData = async (babyId) => {
    try {
      setLoading(true);
      const [routinesRes, entriesRes] = await Promise.all([
        apiClient.getRoutines({ babyId }),
        apiClient.get(`/routines/entries?babyId=${babyId}&startDate=${new Date().toISOString().split('T')[0]}`)
      ]);
      if (routinesRes.success) {
        // Map 'id' to '_id' for compatibility
        const routinesWithId = (routinesRes.data.routines || []).map(r => ({ ...r, _id: r.id || r._id }));
        setRoutines(routinesWithId);
      }
      if (entriesRes.success) setTodayEntries(entriesRes.data.entries || []);
    } catch (error) {
      console.error('Failed to load routines:', error);
      Alert.alert('Error', 'Failed to load routines');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (selectedBabyId) await loadRoutinesData(selectedBabyId);
    setRefreshing(false);
  };

  const handleAddRoutine = async () => {
    if (!routineName.trim()) {
      Alert.alert('Invalid Input', 'Please enter a routine name');
      return;
    }
    
    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(routineTime)) {
      Alert.alert(
        'Invalid Time Format',
        'Please enter time in HH:MM format (e.g., 09:00, 14:30)\n\nHours: 00-23\nMinutes: 00-59',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      const response = await apiClient.createRoutine({
        babyId: selectedBabyId,
        name: routineName,
        type: routineType,
        schedule: [{ time: routineTime, notes: routineNotes || 'No notes' }],
        daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      });
      if (response.success) {
        Alert.alert('Success', 'Routine added successfully!');
        setAddModalVisible(false);
        resetForm();
        await loadRoutinesData(selectedBabyId);
      } else {
        Alert.alert('Error', response.message || 'Failed to add routine');
      }
    } catch (error) {
      console.error('Failed to add routine:', error);
      Alert.alert('Error', 'Failed to add routine');
    }
  };

  const handleDeleteRoutine = (routine) => {
    Alert.alert('Delete Routine', `Are you sure you want to delete "${routine.name}"?`,
      [{ text: 'Cancel', style: 'cancel' },
       { text: 'Delete', style: 'destructive', onPress: async () => {
         try {
           await apiClient.delete(`/routines/${routine._id}`);
           await loadRoutinesData(selectedBabyId);
           Alert.alert('Success', 'Routine deleted');
         } catch (error) {
           console.error('Failed to delete routine:', error);
           Alert.alert('Error', 'Failed to delete routine');
         }
       }}]
    );
  };

  const handleToggleRoutine = async (routine) => {
    try {
      const alreadyCompleted = isRoutineCompletedToday(routine._id);
      console.log('Routine check:', routine._id, 'Already completed:', alreadyCompleted);
      console.log('Today entries:', todayEntries.map(e => ({
        routine: e.routine?._id || e.routine?.id || e.routine,
        routineId: e.routineId?._id || e.routineId?.id || e.routineId
      })));
      
      if (alreadyCompleted) {
        Alert.alert('Info', 'This routine is already completed for today');
        return;
      }
      console.log('Toggling routine:', routine._id, routine.type);
      const response = await apiClient.logRoutineEntry({
        routineId: routine._id,
        babyId: selectedBabyId,
        type: routine.type,
        actualTime: new Date().toISOString(),
        notes: 'Completed'
      });
      if (response.success) await loadRoutinesData(selectedBabyId);
    } catch (error) {
      console.error('Failed to toggle routine:', error);
      Alert.alert('Error', 'Failed to update routine');
    }
  };

  const handleQuickAction = async (type) => {
    try {
      const entryData = {
        babyId: selectedBabyId,
        type: type === 'feed' ? 'Feeding' : type === 'sleep' ? 'Sleep' : 'Diaper',
        actualTime: new Date().toISOString(),
        notes: quickNotes || `Quick ${type} log`,
      };
      
      // Add type-specific fields
      if (type === 'feed' && quickAmount) {
        entryData.details = { amount: quickAmount };
      }
      if (type === 'sleep' && quickDuration) {
        entryData.duration = parseInt(quickDuration);
      }
      if (type === 'diaper') {
        entryData.details = { notes: quickNotes || 'Diaper change' };
      }
      
      console.log('Sending entry data:', entryData);
      const response = await apiClient.logRoutineEntry(entryData);
      if (response.success) {
        Alert.alert('Success', `${type.charAt(0).toUpperCase() + type.slice(1)} logged successfully!`);
        setQuickActionModal(null);
        resetQuickForm();
        await loadRoutinesData(selectedBabyId);
      }
    } catch (error) {
      console.error('Failed to log quick action:', error);
      Alert.alert('Error', 'Failed to log activity');
    }
  };

  const resetForm = () => {
    setRoutineName(''); setRoutineType('Custom');
    setRoutineTime('09:00'); setRoutineNotes('');
  };

  const resetQuickForm = () => {
    setQuickNotes(''); setQuickAmount(''); setQuickDuration('');
  };

  const calculateProgress = () => {
    if (routines.length === 0) return 0;
    // Only count entries that have a routineId or routine (not quick actions)
    const completedRoutines = todayEntries.filter(entry => entry.routineId || entry.routine);
    return Math.round((completedRoutines.length / routines.length) * 100);
  };

  const getRoutineIcon = (type) => {
    const icons = { 'Feeding': 'restaurant-outline', 'Sleep': 'bed-outline', 'Diaper': 'water-outline',
      'Medicine': 'medical-outline', 'Activity': 'fitness-outline', 'Custom': 'calendar-outline' };
    return icons[type] || 'ellipse-outline';
  };

  const getRoutineColor = (type) => {
    const colors = { 'Feeding': '#FF6B6B', 'Sleep': '#4D96FF', 'Diaper': '#FFD93D',
      'Medicine': '#6BCB77', 'Activity': '#9D84B7', 'Custom': '#512da8' };
    return colors[type] || '#512da8';
  };

  const isRoutineCompletedToday = (routineId) => {
    const found = todayEntries.some(entry => {
      // Backend returns 'routine' field, not 'routineId'
      const entryRoutineId = entry.routine?._id || entry.routine?.id || entry.routine ||
                             entry.routineId?._id || entry.routineId?.id || entry.routineId;
      const match = entryRoutineId?.toString() === routineId?.toString();
      return match;
    });
    return found;
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) return (
    <View style={[styles.container, styles.centered]}>
      <ActivityIndicator size="large" color="#6a1b9a" />
      <Text style={styles.loadingText}>Loading routines...</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#512da8" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{selectedBabyName}'s Routines</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setAddModalVisible(true)}>
          <Ionicons name="add-circle-outline" size={28} color="#512da8" />
        </TouchableOpacity>
      </View>
      <View style={styles.summaryCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{todayEntries.filter(e => e.routineId || e.routine).length}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{routines.length - todayEntries.filter(e => e.routineId || e.routine).length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, {color: '#6a1b9a'}]}>{calculateProgress()}%</Text>
          <Text style={styles.statLabel}>Progress</Text>
        </View>
      </View>
      <FlatList
        data={routines}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6a1b9a']} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No routines yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first routine</Text>
          </View>
        }
        renderItem={({ item }) => {
          const completed = isRoutineCompletedToday(item._id);
          const color = getRoutineColor(item.type);
          return (
            <View style={styles.routineCard}>
              <TouchableOpacity style={styles.routineContent} onPress={() => handleToggleRoutine(item)} activeOpacity={0.7}>
                <View style={[styles.routineIcon, {backgroundColor: color + '20'}]}>
                  <Ionicons name={getRoutineIcon(item.type)} size={24} color={color} />
                </View>
                <View style={styles.routineInfo}>
                  <Text style={styles.routineName}>{item.name}</Text>
                  <Text style={styles.routineTime}>Scheduled: {formatTime(item.schedule[0]?.time)}</Text>
                  {completed && <Text style={styles.completedText}> Completed today</Text>}
                </View>
                <View style={styles.routineActions}>
                  <TouchableOpacity style={[styles.checkButton, completed && styles.checkedButton]} onPress={() => handleToggleRoutine(item)}>
                    <Ionicons name={completed ? "checkmark-circle" : "ellipse-outline"} size={32} color={completed ? "#6BCB77" : "#ccc"} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteRoutine(item)}>
                <Ionicons name="trash-outline" size={20} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.quickButton, {backgroundColor: '#FF6B6B'}]} onPress={() => setQuickActionModal('feed')}>
          <Ionicons name="restaurant" size={24} color="#fff" />
          <Text style={styles.quickButtonText}>Feed</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, {backgroundColor: '#FFD93D'}]} onPress={() => setQuickActionModal('diaper')}>
          <Ionicons name="water" size={24} color="#fff" />
          <Text style={styles.quickButtonText}>Diaper</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, {backgroundColor: '#4D96FF'}]} onPress={() => setQuickActionModal('sleep')}>
          <Ionicons name="bed" size={24} color="#fff" />
          <Text style={styles.quickButtonText}>Sleep</Text>
        </TouchableOpacity>
      </View>
      <Modal visible={addModalVisible} animationType="slide" transparent={true} onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Routine</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={28} color="#512da8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.inputLabel}>Routine Name</Text>
              <TextInput style={styles.input} placeholder="e.g., Morning Feeding" value={routineName} onChangeText={setRoutineName} />
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeSelector}>
                {['Feeding', 'Sleep', 'Diaper', 'Medicine', 'Activity', 'Custom'].map(type => (
                  <TouchableOpacity key={type} style={[styles.typeButton, routineType === type && styles.typeButtonActive]} onPress={() => setRoutineType(type)}>
                    <Text style={[styles.typeButtonText, routineType === type && styles.typeButtonTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Time</Text>
              <TextInput 
                style={styles.input} 
                placeholder="HH:MM (e.g., 09:00, 14:30)" 
                value={routineTime} 
                onChangeText={handleTimeChange}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                autoCapitalize="none"
              />
              <Text style={styles.inputHint}>Enter time in 24-hour format (00:00 - 23:59)</Text>
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Add notes..." value={routineNotes} onChangeText={setRoutineNotes} multiline numberOfLines={3} />
              <TouchableOpacity style={styles.submitButton} onPress={handleAddRoutine}>
                <Text style={styles.submitButtonText}>Add Routine</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={quickActionModal !== null} animationType="slide" transparent={true} onRequestClose={() => setQuickActionModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Log {quickActionModal === 'feed' ? 'Feeding' : quickActionModal === 'sleep' ? 'Sleep' : 'Diaper Change'}</Text>
              <TouchableOpacity onPress={() => { setQuickActionModal(null); resetQuickForm(); }}>
                <Ionicons name="close" size={28} color="#512da8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {quickActionModal === 'feed' && (
                <><Text style={styles.inputLabel}>Amount (ml/oz)</Text>
                <TextInput style={styles.input} placeholder="e.g., 120" value={quickAmount} onChangeText={setQuickAmount} keyboardType="numeric" /></>
              )}
              {quickActionModal === 'sleep' && (
                <><Text style={styles.inputLabel}>Duration (minutes)</Text>
                <TextInput style={styles.input} placeholder="e.g., 60" value={quickDuration} onChangeText={setQuickDuration} keyboardType="numeric" /></>
              )}
              <Text style={styles.inputLabel}>Notes (Optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="Add notes..." value={quickNotes} onChangeText={setQuickNotes} multiline numberOfLines={3} />
              <TouchableOpacity style={styles.submitButton} onPress={() => handleQuickAction(quickActionModal)}>
                <Text style={styles.submitButtonText}>Log Activity</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0eef8' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  backButton: { padding: 8 },
  titleContainer: { flex: 1, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#512da8' },
  addButton: { padding: 4 },
  summaryCard: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 32, fontWeight: 'bold', color: '#333' },
  statLabel: { fontSize: 14, color: '#666', marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#999', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#bbb', marginTop: 8 },
  routineCard: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  routineContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  routineIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  routineInfo: { flex: 1, marginLeft: 16 },
  routineName: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 4 },
  routineTime: { fontSize: 14, color: '#666' },
  completedText: { fontSize: 12, color: '#6BCB77', marginTop: 4, fontWeight: '600' },
  routineActions: { marginLeft: 12 },
  checkButton: { padding: 4 },
  checkedButton: {},
  deleteButton: { position: 'absolute', top: 8, right: 8, padding: 8 },
  quickActions: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', paddingVertical: 16, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: '#e0e0e0', shadowColor: '#000', shadowOffset: {width: 0, height: -2}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8 },
  quickButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  quickButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#512da8' },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 12 },
  inputHint: { fontSize: 12, color: '#999', marginTop: 4, marginBottom: 8 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#e0e0e0' },
  textArea: { height: 80, textAlignVertical: 'top' },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  typeButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f5f5f5', marginRight: 8, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  typeButtonActive: { backgroundColor: '#6a1b9a', borderColor: '#6a1b9a' },
  typeButtonText: { fontSize: 14, color: '#666' },
  typeButtonTextActive: { color: '#fff', fontWeight: '600' },
  submitButton: { backgroundColor: '#6a1b9a', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
