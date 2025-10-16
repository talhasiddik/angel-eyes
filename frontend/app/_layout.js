import React from 'react';
import { Stack } from 'expo-router';
import { View, StatusBar, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Layout() {
  return (
    <>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#fff"
        translucent={false}
      />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTintColor: '#6a1b9a',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          headerShadowVisible: false,
          statusBarTranslucent: false,
          contentStyle: {
            paddingTop: Platform.OS === 'android' ? 25 : 0,
            backgroundColor: '#f5f5f5',
          },
        }}
      >
      <Stack.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
          headerBackTitleVisible: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="signup"
        options={{
          title: 'Sign Up',
          headerBackTitleVisible: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="babyprofile"
        options={{
          title: 'Baby Profile',
          headerBackTitleVisible: false,
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="dashboard"
        options={{
          headerShown: false,  // Hide React Navigation header - page has custom header
        }}
      />
      <Stack.Screen
        name="monitoring"
        options={{
          headerShown: false,  // Hide React Navigation header - page has custom header
        }}
      />
      <Stack.Screen
        name="detections"
        options={{
          headerShown: false,  // Hide React Navigation header - page has custom header
        }}
      />
      <Stack.Screen
        name="community"
        options={{
          headerShown: false,  // Hide React Navigation header - page has custom header
        }}
      />
      <Stack.Screen
        name="routines"
        options={{
          headerShown: false,  // Hide React Navigation header - page has custom header
        }}
      />
    </Stack>
    </>
  );
}
