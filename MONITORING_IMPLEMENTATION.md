# Live Monitoring Implementation

## ✅ Features Implemented

### **1. Camera Integration**
- ✅ Uses Expo Camera (expo-camera) for accessing device camera
- ✅ Opens back camera for monitoring
- ✅ Handles camera permissions automatically
- ✅ Shows permission dialog if not granted
- ✅ Full-screen camera preview with overlay

### **2. Monitoring Session Management**
- ✅ Creates monitoring session in backend when starting
- ✅ Stores session ID and start time
- ✅ Ends session properly when stopping
- ✅ Automatic cleanup on component unmount

### **3. Live Status Indicators**
- ✅ **LIVE** indicator badge on camera feed (red badge with blinking dot)
- ✅ Connection status (Connected/Disconnected)
- ✅ Real-time session duration timer (HH:MM:SS format)
- ✅ AI Detection status (Active/Inactive)

### **4. User Interface**
- ✅ Clean, modern design with purple theme
- ✅ Large Start/Stop monitoring buttons
- ✅ Camera placeholder when not monitoring
- ✅ Baby name displayed in header
- ✅ Back button to return to dashboard
- ✅ Rounded corners and shadows for depth

### **5. User Experience**
- ✅ Confirmation dialog before stopping
- ✅ Loading state while connecting
- ✅ Success/Error alerts with clear messages
- ✅ Graceful error handling
- ✅ Session persists until explicitly stopped

## 📱 How It Works

### **Starting Monitoring:**
1. User taps "Start Monitoring" button
2. App checks camera permission
3. If not granted, shows permission dialog
4. Creates monitoring session in backend via API
5. Opens back camera with live preview
6. Shows "LIVE" indicator and starts duration timer
7. Updates status indicators to "Connected" and "Active"

### **During Monitoring:**
- Camera feed displays in real-time
- Duration timer updates every second
- LIVE badge visible at top-left
- All status indicators show active state
- Backend tracks the monitoring session

### **Stopping Monitoring:**
1. User taps "Stop Monitoring" button
2. Shows confirmation dialog
3. If confirmed, sends end session request to backend
4. Closes camera
5. Resets all states
6. Shows "Stopped" success message

### **Auto-Cleanup:**
- If user navigates away while monitoring is active
- Component automatically ends the backend session
- Prevents orphaned sessions in database

## 🔧 Technical Details

### **Dependencies:**
- `expo-camera`: ^16.x.x (Camera access and control)
- `@expo/vector-icons`: Icons for UI
- `expo-router`: Navigation
- `@react-native-async-storage/async-storage`: Baby selection

### **API Endpoints Used:**
- `POST /monitoring/sessions` - Create new monitoring session
- `PATCH /monitoring/sessions/:id` - Update session status (end)
- `GET /babies` - Fetch baby details for name display

### **State Management:**
- `isMonitoring`: Boolean flag for active monitoring
- `isConnecting`: Loading state during session creation
- `sessionId`: Backend session identifier
- `sessionStartTime`: Timestamp for duration calculation
- `sessionDuration`: Formatted duration string (HH:MM:SS)
- `permission`: Camera permission status from Expo
- `selectedBabyId`: Currently selected baby
- `babyName`: Display name for header

### **Camera Configuration:**
```javascript
<CameraView
  ref={cameraRef}
  style={styles.camera}
  facing="back"        // Use back camera
  mode="video"         // Video mode for continuous feed
/>
```

### **Duration Calculation:**
- Updates every 1 second using setInterval
- Calculates difference from sessionStartTime
- Formats as HH:MM:SS with zero padding
- Clears interval on monitoring stop

## 🎨 UI Components

### **Camera Overlay:**
- LIVE indicator badge (red background, white text)
- Pulsing dot animation effect
- Positioned at top-left corner
- Semi-transparent background

### **Status Bar:**
- Connection status with WiFi icon
- Duration display with clock icon
- AI Detection status with shield icon
- Color-coded (green=active, gray=inactive)

### **Control Button:**
- Start: Purple background with play icon
- Stop: Red background with stop icon
- Loading state shows spinner
- Disabled during connection

## 🚀 Demo Instructions

### **For Your 60% Evaluation:**

1. **Navigate to Live Monitoring:**
   - Open app → Dashboard → Tap "Live Monitoring" card
   - Or use monitoring icon in navigation

2. **Demonstrate Permission Flow:**
   - First time: Show camera permission dialog
   - Explain why permission is needed
   - Grant permission

3. **Start Monitoring:**
   - Tap "Start Monitoring" button
   - Show loading state
   - Point out "LIVE" badge appears
   - Show duration timer counting up

4. **Show Active Features:**
   - Point camera at baby/doll
   - Show real-time camera feed
   - Highlight status indicators
   - Explain AI detection (ready for future integration)

5. **Stop Monitoring:**
   - Tap "Stop Monitoring"
   - Show confirmation dialog
   - Confirm stop
   - Show how camera closes

6. **Explain Backend Integration:**
   - Session created in database
   - Can track monitoring history
   - Duration recorded for analytics

## 🔮 Future Enhancements

### **Phase 2 (Post-Evaluation):**
- [ ] AI object detection integration (crying, sleeping, awake)
- [ ] Real-time alerts for detected events
- [ ] Video recording capability
- [ ] Snapshot capture feature
- [ ] Multiple camera support
- [ ] Night vision mode toggle
- [ ] Audio monitoring with volume indicators
- [ ] Push notifications for detected events
- [ ] Historical session playback
- [ ] Analytics dashboard with detection statistics

### **Phase 3 (Advanced):**
- [ ] Cloud streaming for remote monitoring
- [ ] Multiple device simultaneous monitoring
- [ ] WebRTC for low-latency streaming
- [ ] Gesture detection (baby movement)
- [ ] Temperature/humidity sensor integration
- [ ] Two-way audio communication
- [ ] Scheduled monitoring (auto-start/stop)
- [ ] Smart alerts based on patterns

## 📊 Backend Schema

### **MonitoringSession Model:**
```javascript
{
  babyId: ObjectId,
  deviceType: String,
  deviceName: String,
  status: 'active' | 'ended',
  startTime: Date,
  endTime: Date,
  duration: Number,
  detectionCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## ✅ Testing Checklist

- [x] Camera opens on start
- [x] Permission dialog shows if needed
- [x] LIVE indicator visible
- [x] Duration timer updates correctly
- [x] Stop confirmation works
- [x] Session ends in backend
- [x] Cleanup on navigation away
- [x] Baby name displays correctly
- [x] Status indicators update properly
- [x] Error handling works gracefully

## 🎓 Evaluation Demo Script

**"This is our Live Monitoring feature. Let me demonstrate:**

1. **Start:** "When I tap Start Monitoring, it requests camera permission and creates a monitoring session in our database."

2. **Camera:** "The back camera opens automatically, giving us a live feed of the baby's crib area."

3. **Status:** "You can see the LIVE indicator here, showing we're actively monitoring. The duration timer tracks how long the session has been running."

4. **AI Ready:** "The AI Detection indicator shows the system is ready. In the next phase, this will detect crying, sleeping, and other baby states in real-time."

5. **Backend:** "Every session is logged in our MongoDB database, including start time, duration, and device information for analytics."

6. **Stop:** "When we stop, it properly ends the session and updates the database. If I navigate away, it automatically cleans up the session."

**Key Points to Emphasize:**
- ✅ Real-time camera feed working
- ✅ Backend integration complete
- ✅ Database session tracking
- ✅ Clean UI/UX with status indicators
- ✅ Proper error handling and cleanup
- ✅ Ready for AI detection integration
