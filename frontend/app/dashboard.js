import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  BackHandler
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../services/api';
import authService from '../services/auth';

export default function DashboardScreen() {
  const router = useRouter();
  
  // State management
  const [babies, setBabies] = useState([]);
  const [selectedBaby, setSelectedBaby] = useState(null);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loading, setLoading] = useState(true);  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);

  // Handle hardware back button - only when dashboard is focused
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const backAction = () => {
        if (!isActive) return false; // Don't handle if not active
        
        Alert.alert(
          'Exit App',
          'Are you sure you want to exit?',
          [
            {
              text: 'Cancel',
              onPress: () => null,
              style: 'cancel'
            },
            {
              text: 'Yes',
              onPress: () => BackHandler.exitApp()
            }
          ]
        );
        return true; // Prevent default behavior
      };

      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        backAction
      );

      return () => {
        isActive = false;
        backHandler.remove();
      };
    }, [])
  );

  // Dashboard modules with simple icons instead of image imports
  const modules = [
    { 
      id: 1, 
      title: 'Live Monitoring', 
      icon: "videocam-outline",
      color: '#FF6B6B',
      route: '/monitoring'
    },
    { 
      id: 2, 
      title: 'Track and Routine', 
      icon: "calendar-outline",
      color: '#4D96FF',
      route: '/routines'
    },
    { 
      id: 3, 
      title: 'Community', 
      icon: "people-outline",
      color: '#6BCB77',
      route: '/community'
    },
    { 
      id: 4, 
      title: 'Detections', 
      icon: "alert-circle-outline",
      color: '#FFD93D',
      route: '/detections'
    }
  ];

  // Load initial data
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Get current user
      const currentUser = authService.getUser();
      setUser(currentUser);

      // Load babies and dashboard stats in parallel
      const [babiesResponse, statsResponse] = await Promise.all([
        apiClient.getBabies(),
        apiClient.getDashboardStats()
      ]);

      if (babiesResponse.success) {
        const babyList = babiesResponse.data.babies || [];
        console.log('📊 Loaded babies:', babyList.length);
        setBabies(babyList);
        
        if (babyList.length > 0) {
          // Load previously selected baby from AsyncStorage
          const savedBabyId = await AsyncStorage.getItem('selectedBabyId');
          
          if (savedBabyId) {
            // Find the previously selected baby (use 'id' field from API)
            const savedBaby = babyList.find(b => b.id === savedBabyId);
            if (savedBaby) {
              setSelectedBaby(savedBaby);
            } else {
              // If saved baby not found, select first baby
              const firstBaby = babyList[0];
              if (firstBaby.id) {
                setSelectedBaby(firstBaby);
                await AsyncStorage.setItem('selectedBabyId', firstBaby.id);
              }
            }
          } else {
            // No saved baby, select first one
            const firstBaby = babyList[0];
            if (firstBaby.id) {
              setSelectedBaby(firstBaby);
              await AsyncStorage.setItem('selectedBabyId', firstBaby.id);
            }
          }
        }
      }

      if (statsResponse.success) {
        setDashboardStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Dashboard data loading error:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleModulePress = (module) => {
    if (babies.length === 0) {
      Alert.alert(
        'No Baby Profiles',
        'Please add a baby profile first to access this feature.',
        [
          {
            text: 'Add Baby',
            onPress: () => router.push('/babyprofile')
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
      return;
    }

    // Navigate to the specific module
    router.push(module.route);
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Logout',
          onPress: async () => {
            await authService.logout();
            // Replace the navigation stack to prevent going back
            router.replace('/');
          }
        }
      ]
    );  };

  // Calculate baby's age in weeks or months
  const calculateAge = (dob) => {
    if (!dob || !(dob instanceof Date)) {
      return 'Unknown';
    }
    
    const today = new Date();
    const birthDate = dob; // Already a Date object
    
    let ageInMonths = (today.getFullYear() - birthDate.getFullYear()) * 12;
    ageInMonths -= birthDate.getMonth();
    ageInMonths += today.getMonth();
    
    if (ageInMonths < 1) {
      const ageInDays = Math.floor((today - birthDate) / (1000 * 60 * 60 * 24));
      return `${ageInDays} days`;
    } else if (ageInMonths < 24) {
      return `${ageInMonths} months`;
    } else {
      const years = Math.floor(ageInMonths / 12);
      const remainingMonths = ageInMonths % 12;
      return remainingMonths > 0 ? `${years} years, ${remainingMonths} months` : `${years} years`;    }
  };

  // Handle baby selection
  const handleSelectBaby = async (baby) => {
    try {
      if (!baby.id) {
        console.error('❌ Cannot select baby - no ID found:', baby);
        Alert.alert('Error', 'Invalid baby data');
        return;
      }
      
      setSelectedBaby(baby);
      
      // Save selection to AsyncStorage for persistence
      await AsyncStorage.setItem('selectedBabyId', baby.id);
      
      // Reload dashboard stats for the selected baby
      const statsResponse = await apiClient.getDashboardStats();
      if (statsResponse.success) {
        setDashboardStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Failed to save selected baby:', error);
      Alert.alert('Error', 'Failed to save baby selection');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6a1b9a" />
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  // Show add baby button if no babies exist
  if (babies.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.emptyTitle}>Welcome to Angel Eyes</Text>
        <Text style={styles.emptySubtitle}>No baby profiles yet</Text>
        <TouchableOpacity 
          style={styles.addBabyButton}
          onPress={() => router.push('/babyprofile')}
        >
          <Ionicons name="add-circle-outline" size={24} color="#fff" />
          <Text style={styles.addBabyText}>Add Baby Profile</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header with welcome message and logout */}
      <View style={styles.header}>
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeText}>Welcome to</Text>
          <Text style={styles.appName}>Angel Eyes</Text>
        </View>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={24} color="#512da8" />
        </TouchableOpacity>
      </View>

      <FlatList
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#6a1b9a']}
            tintColor="#6a1b9a"
          />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Baby selector */}
            <View style={{marginBottom: 15}}>
              <FlatList
                horizontal
                data={babies}
                keyExtractor={(item) => item.id || Math.random().toString()}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.babyListContainer}
                renderItem={({ item }) => {
                  const isSelected = selectedBaby?.id === item.id;
                  
                  return (
                    <TouchableOpacity
                      style={[
                        styles.babyCard,
                        isSelected && styles.selectedBabyCard
                      ]}
                      onPress={() => handleSelectBaby(item)}
                    >
                      {/* Selection badge */}
                      {isSelected && (
                        <View style={styles.selectedBadge}>
                          <Ionicons name="checkmark-circle" size={20} color="#6a1b9a" />
                        </View>
                      )}
                      <View style={styles.babyIconContainer}>
                        <Ionicons 
                          name={item.gender === 'male' || item.gender === 'Male' ? "male" : "female"} 
                          size={24} 
                          color={item.gender === 'male' || item.gender === 'Male' ? "#4D96FF" : "#FF6B6B"} 
                        />
                      </View>
                      <Text style={styles.babyName}>{item.name}</Text>
                      <Text style={styles.babyAge}>{calculateAge(new Date(item.dateOfBirth))}</Text>
                    </TouchableOpacity>
                  );
                }}
                ListFooterComponent={
                  <TouchableOpacity
                    style={styles.addBabyCard}
                    onPress={() => router.push('/babyprofile')}
                  >
                    <Ionicons name="add-circle-outline" size={28} color="#512da8" />
                    <Text style={styles.addBabyCardText}>Add Baby</Text>
                  </TouchableOpacity>
                }
              />
            </View>

            {/* Dashboard Stats */}
            {dashboardStats && (
              <View style={styles.statsContainer}>
                <Text style={styles.sectionTitle}>Today's Overview</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <Ionicons name="videocam" size={24} color="#FF6B6B" />
                    <Text style={styles.statValue}>{dashboardStats.todaySessionsCount || 0}</Text>
                    <Text style={styles.statLabel}>Sessions</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="alert-circle" size={24} color="#FFD93D" />
                    <Text style={styles.statValue}>{dashboardStats.todayDetectionsCount || 0}</Text>
                    <Text style={styles.statLabel}>Alerts</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="time" size={24} color="#4D96FF" />
                    <Text style={styles.statValue}>{dashboardStats.totalMonitoringHours || 0}h</Text>
                    <Text style={styles.statLabel}>Monitored</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Ionicons name="calendar" size={24} color="#6BCB77" />
                    <Text style={styles.statValue}>{dashboardStats.completedRoutines || 0}</Text>
                    <Text style={styles.statLabel}>Routines</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Dashboard modules */}
            <View style={{marginTop: 20}}>
              <Text style={styles.sectionTitle}>Features</Text>
            </View>
          </>
        }
        data={modules}
        numColumns={2}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item: module }) => (
          <View style={styles.moduleWrapper}>
            <TouchableOpacity
              style={styles.moduleCard}
              onPress={() => handleModulePress(module)}
            >
              <View style={[styles.moduleIconContainer, { backgroundColor: module.color }]}>
                <Ionicons name={module.icon} size={32} color="#fff" />
              </View>
              <Text style={styles.moduleTitle}>{module.title}</Text>
            </TouchableOpacity>
          </View>
        )}
        columnWrapperStyle={styles.moduleRow}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({  container: {
    flex: 1,
    backgroundColor: '#f0eef8',
    padding: 16,
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
  emptyContainer: {
    flex: 1,
    backgroundColor: '#f0eef8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#512da8',
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
  },
  addBabyButton: {
    flexDirection: 'row',
    backgroundColor: '#6a1b9a',
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addBabyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  welcomeContainer: {
    flexDirection: 'column',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
  },  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#512da8',
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    width: '23%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  moduleWrapper: {
    width: '50%',
    paddingHorizontal: 6,
  },
  moduleRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  settingsButton: {
    padding: 8,
  },
  babyListContainer: {
    paddingHorizontal: 5,
    paddingBottom: 10,
  },
  babyCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginRight: 12,
    alignItems: 'center',
    width: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    position: 'relative',
  },
  selectedBabyCard: {
    backgroundColor: '#e8e0ff',
    borderColor: '#512da8',
    borderWidth: 2,
  },
  selectedBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 10,
    zIndex: 10,
  },
  addBabyCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#512da8',
  },
  addBabyCardText: {
    color: '#512da8',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  babyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0eef8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  babyName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  babyAge: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#512da8',
    marginBottom: 20,  },
  moduleCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 5,
    height: 140,
    justifyContent: 'center',
  },
  moduleIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
});
