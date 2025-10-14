import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import apiClient from '../services/api';

export default function BabyProfileScreen() {
  const router = useRouter();
    // Form state
  const [name, setName] = useState('');
  const [dob, setDob] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('Male');
  const [feedingType, setFeedingType] = useState('Breastfeeding');
  const [loading, setLoading] = useState(false);

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || dob;
    setShowDatePicker(Platform.OS === 'ios');
    setDob(currentDate);
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const formatDate = (date) => {
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  };

  // Parse backend error messages into user-friendly format
  const parseErrorMessage = (message) => {
    if (!message) return 'Something went wrong. Please try again.';

    // Remove quotes and clean up the message
    let cleanMessage = message.replace(/"/g, '');

    // Handle specific validation errors
    if (cleanMessage.includes('height') && cleanMessage.includes('must be greater than or equal to 20')) {
      return 'Height must be at least 20 cm. Please enter a valid height.';
    }
    
    if (cleanMessage.includes('height') && cleanMessage.includes('must be less than or equal to 150')) {
      return 'Height must be less than 150 cm. Please enter a valid height.';
    }

    if (cleanMessage.includes('weight') && cleanMessage.includes('must be greater than or equal to')) {
      return 'Weight must be at least 0.5 kg. Please enter a valid weight.';
    }
    
    if (cleanMessage.includes('weight') && cleanMessage.includes('must be less than or equal to 30')) {
      return 'Weight must be less than 30 kg. Please enter a valid weight.';
    }

    if (cleanMessage.includes('name') && cleanMessage.includes('is required')) {
      return 'Baby name is required. Please enter a name.';
    }

    if (cleanMessage.includes('dateOfBirth') && cleanMessage.includes('must be less than or equal to')) {
      return 'Date of birth cannot be in the future. Please select a valid date.';
    }

    if (cleanMessage.includes('feedingSettings.feedingType') && cleanMessage.includes('is required')) {
      return 'Please select a feeding type for your baby.';
    }

    if (cleanMessage.includes('gender') && cleanMessage.includes('is required')) {
      return 'Please select your baby\'s gender.';
    }

    // Handle network errors
    if (cleanMessage.includes('Network request failed') || cleanMessage.includes('Failed to fetch')) {
      return 'Unable to connect to server. Please check your internet connection and try again.';
    }

    // Return cleaned message or default
    return cleanMessage || 'Something went wrong. Please try again.';
  };

  // Validate form data with user-friendly messages
  const validateForm = () => {
    // Name validation
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your baby\'s name');
      return false;
    }
    
    if (name.trim().length > 100) {
      Alert.alert('Name Too Long', 'Baby name must be less than 100 characters');
      return false;
    }

    // Date of Birth validation
    if (dob > new Date()) {
      Alert.alert('Invalid Date', 'Date of birth cannot be in the future. Please select a valid date.');
      return false;
    }

    const babyAge = (new Date() - dob) / (1000 * 60 * 60 * 24 * 365); // Age in years
    if (babyAge > 10) {
      Alert.alert('Age Limit', 'This app is designed for babies and young children up to 10 years old.');
      return false;
    }

    // Height validation
    if (!height.trim()) {
      Alert.alert('Height Required', 'Please enter your baby\'s height in centimeters (cm)');
      return false;
    }
    
    const heightValue = parseFloat(height);
    if (isNaN(heightValue)) {
      Alert.alert('Invalid Height', 'Please enter a valid number for height');
      return false;
    }
    
    if (heightValue < 20) {
      Alert.alert('Height Too Low', 'Height must be at least 20 cm. Please check and enter the correct height.');
      return false;
    }
    
    if (heightValue > 150) {
      Alert.alert('Height Too High', 'Height must be less than 150 cm. Please check and enter the correct height.');
      return false;
    }

    // Weight validation
    if (!weight.trim()) {
      Alert.alert('Weight Required', 'Please enter your baby\'s weight in kilograms (kg)');
      return false;
    }
    
    const weightValue = parseFloat(weight);
    if (isNaN(weightValue)) {
      Alert.alert('Invalid Weight', 'Please enter a valid number for weight');
      return false;
    }
    
    if (weightValue < 0.5) {
      Alert.alert('Weight Too Low', 'Weight must be at least 0.5 kg. Please check and enter the correct weight.');
      return false;
    }
    
    if (weightValue > 30) {
      Alert.alert('Weight Too High', 'Weight must be less than 30 kg. Please check and enter the correct weight.');
      return false;
    }

    // Feeding type validation
    if (!feedingType) {
      Alert.alert('Feeding Type Required', 'Please select a feeding type for your baby');
      return false;
    }

    return true;
  };
  // Save baby profile and navigate to Dashboard
  const handleSaveAndContinue = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const babyData = {
        name: name.trim(),
        dateOfBirth: dob.toISOString(),
        gender,
        height: parseFloat(height),
        weight: parseFloat(weight),
        feedingSettings: {
          feedingType
        }
      };

      const response = await apiClient.createBaby(babyData);

      if (response.success) {
        Alert.alert(
          'Baby Profile Created',
          `Welcome ${name}! Your profile has been saved successfully.`,
          [
            {
              text: 'Continue to Dashboard',
              onPress: () => router.replace('/dashboard')
            }
          ]
        );
      } else {
        // Show user-friendly error message
        const errorMessage = parseErrorMessage(response.message);
        Alert.alert('Unable to Create Profile', errorMessage);
      }
    } catch (error) {
      // Show user-friendly error message
      const errorMessage = parseErrorMessage(error.message);
      Alert.alert('Unable to Create Profile', errorMessage);
      console.error('Create baby profile error:', error);
    } finally {
      setLoading(false);
    }
  };
  // Save baby profile and clear form for adding another baby
  const handleSaveAndAddAnother = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const babyData = {
        name: name.trim(),
        dateOfBirth: dob.toISOString(),
        gender,
        height: parseFloat(height),
        weight: parseFloat(weight),
        feedingSettings: {
          feedingType
        }
      };

      const response = await apiClient.createBaby(babyData);

      if (response.success) {
        Alert.alert(
          'Baby Profile Created',
          `${name}'s profile has been saved successfully!`,
          [
            {
              text: 'Add Another Baby',
              onPress: () => {                // Clear form
                setName('');
                setDob(new Date());
                setHeight('');
                setWeight('');
                setGender('Male');
                setFeedingType('Breastfeeding');
              }
            }
          ]
        );
      } else {
        // Show user-friendly error message
        const errorMessage = parseErrorMessage(response.message);
        Alert.alert('Unable to Create Profile', errorMessage);
      }
    } catch (error) {
      // Show user-friendly error message
      const errorMessage = parseErrorMessage(error.message);
      Alert.alert('Unable to Create Profile', errorMessage);
      console.error('Create baby profile error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Skip baby profile creation and go to dashboard
  const handleSkip = () => {
    Alert.alert(
      'Skip Baby Profile',
      'You can always add baby profiles later from the dashboard.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Skip',
          onPress: () => router.replace('/dashboard')
        }
      ]
    );  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Baby Profile</Text>
        <Text style={styles.subtitle}>Tell us about your little one</Text>

        {/* Baby Name */}
        <View style={{width: '100%'}}>
          <Text style={styles.inputLabel}>Baby's Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter name"
            value={name}
            onChangeText={setName}
            editable={!loading}
          />
        </View>

        {/* Gender Picker */}
        <View style={{width: '100%'}}>
          <Text style={styles.inputLabel}>Gender</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={styles.picker}
              mode="dropdown"
            >
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              <Picker.Item label="Other" value="Other" />
            </Picker>
          </View>
        </View>

        {/* Date of Birth */}
        <View style={{width: '100%'}}>
          <Text style={styles.inputLabel}>Date of Birth</Text>
          <TouchableOpacity style={styles.dateInput} onPress={showDatepicker}>
            <Text style={styles.dateText}>{formatDate(dob)}</Text>
          </TouchableOpacity>
          
          {showDatePicker && (
            <DateTimePicker
              value={dob}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}
        </View>

        {/* Height */}
        <View style={{width: '100%'}}>
          <Text style={styles.inputLabel}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter height"            value={height}
            onChangeText={setHeight}
            keyboardType="numeric"
            editable={!loading}
          />
        </View>        {/* Weight */}
        <View style={{width: '100%'}}>
          <Text style={styles.inputLabel}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter weight"
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            editable={!loading}
          />
        </View>

        {/* Feeding Type */}
        <View style={{width: '100%'}}>
          <Text style={styles.inputLabel}>Feeding Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={feedingType}
              onValueChange={setFeedingType}
              style={styles.picker}
              mode="dropdown"
              enabled={!loading}
            >
              <Picker.Item label="Breastfeeding" value="Breastfeeding" />
              <Picker.Item label="Formula" value="Formula" />
              <Picker.Item label="Mixed (Breast + Formula)" value="Mixed" />
              <Picker.Item label="Solid Food" value="Solid" />
            </Picker>
          </View>
        </View>

        {/* Buttons for Save Options */}
        <View style={{width: '100%', marginTop: 20}}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSaveAndAddAnother}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save & Add Another</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.buttonDisabled]}
              onPress={handleSaveAndContinue}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Save & Continue</Text>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>

        {/* Note about monitoring */}
        <View style={{marginTop: 20}}>
          <Text style={styles.noteText}>
            Angel Eyes will monitor your baby's routine, diet, and other activities
            to provide you with the best care recommendations.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#e6e6fa',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#512da8',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 16,
    color: '#673ab7',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#512da8',
    marginBottom: 8,
    marginLeft: 5,
  },
  input: {
    width: '100%',
    height: 55,
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  dateInput: {
    width: '100%',
    height: 55,
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  pickerContainer: {
    width: '100%',
    height: 55,
    borderColor: '#aaa',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  picker: {
    height: 55,
    width: '100%',
    color: '#333'
  },
  saveButton: {
    backgroundColor: '#6a1b9a',
    paddingVertical: 15,
    paddingHorizontal: 10,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginHorizontal: 20,
    fontStyle: 'italic',
  }
});
