# 🧪 Routines Page - Testing Guide

## Quick Start Testing

### Prerequisites:
1. Backend server running on port 5000
2. MongoDB connected
3. User logged in
4. At least one baby profile created and selected

---

## 🎯 Test Scenarios

### Test 1: Add New Routine ✅
**Steps:**
1. Open Routines page
2. Tap "+" button (top-right)
3. Enter routine name: "Morning Feeding"
4. Select type: "Feeding"
5. Enter time: "07:00"
6. (Optional) Add notes
7. Tap "Add Routine"

**Expected Result:**
- ✅ Success alert appears
- ✅ Modal closes
- ✅ New routine appears in list
- ✅ Has red feeding icon
- ✅ Shows scheduled time
- ✅ Progress updated

**Database Check:**
```javascript
// Check MongoDB
db.routines.find({ name: "Morning Feeding" })
```

---

### Test 2: Complete a Routine ✅
**Steps:**
1. Tap on any routine card (or tap circle icon)
2. Wait for completion

**Expected Result:**
- ✅ Circle changes from gray to green checkmark
- ✅ "✓ Completed today" text appears
- ✅ Progress percentage increases
- ✅ "Completed" count increases by 1
- ✅ "Pending" count decreases by 1

**Try completing again:**
- ✅ Shows "Already completed for today" message

**Database Check:**
```javascript
// Check MongoDB
db.routineentries.find({ 
  routineId: ObjectId("..."),
  completed: true 
})
```

---

### Test 3: Delete Routine ✅
**Steps:**
1. Tap trash icon on any routine (top-right of card)
2. Confirmation dialog appears
3. Tap "Delete"

**Expected Result:**
- ✅ Routine disappears from list
- ✅ Success message shows
- ✅ Progress recalculates

**Database Check:**
```javascript
// Check MongoDB - should not exist
db.routines.find({ _id: ObjectId("...") })
```

---

### Test 4: Quick Action - Feed 🍼
**Steps:**
1. Tap "Feed" button (red, bottom-left)
2. Modal opens
3. Enter amount: "120"
4. Enter notes: "Baby was hungry"
5. Tap "Log Activity"

**Expected Result:**
- ✅ Success alert: "Feed logged successfully!"
- ✅ Modal closes
- ✅ Entry saved to database

**Database Check:**
```javascript
db.routineentries.find({ 
  type: "Feeding",
  details: { amount: "120" }
})
```

---

### Test 5: Quick Action - Sleep 😴
**Steps:**
1. Tap "Sleep" button (blue, bottom-right)
2. Modal opens
3. Enter duration: "60"
4. Enter notes: "Afternoon nap"
5. Tap "Log Activity"

**Expected Result:**
- ✅ Success alert: "Sleep logged successfully!"
- ✅ Modal closes
- ✅ Entry saved to database

**Database Check:**
```javascript
db.routineentries.find({ 
  type: "Sleep",
  details: { duration: 60 }
})
```

---

### Test 6: Quick Action - Diaper 💧
**Steps:**
1. Tap "Diaper" button (yellow, bottom-center)
2. Modal opens
3. Enter notes: "Clean diaper"
4. Tap "Log Activity"

**Expected Result:**
- ✅ Success alert: "Diaper logged successfully!"
- ✅ Modal closes
- ✅ Entry saved to database

**Database Check:**
```javascript
db.routineentries.find({ 
  type: "Diaper"
})
```

---

### Test 7: Pull to Refresh 🔄
**Steps:**
1. Swipe down on the routines list
2. Loading indicator appears
3. Wait for refresh

**Expected Result:**
- ✅ Loading spinner shows
- ✅ Data refreshes from server
- ✅ Any new routines appear
- ✅ Progress updates

---

### Test 8: Empty State 📭
**Steps:**
1. Delete all routines
2. View empty list

**Expected Result:**
- ✅ Calendar icon displayed
- ✅ "No routines yet" message
- ✅ "Tap + to add your first routine" subtitle

---

### Test 9: Multiple Routine Types 🎨
**Steps:**
1. Add routines of different types:
   - Feeding (Red icon)
   - Sleep (Blue icon)
   - Diaper (Yellow icon)
   - Medicine (Green icon)
   - Activity (Purple icon)
   - Custom (Dark purple icon)

**Expected Result:**
- ✅ Each has correct color
- ✅ Each has correct icon
- ✅ All display properly

---

### Test 10: Progress Calculation 📊
**Steps:**
1. Add 4 routines
2. Complete 1 routine
3. Check progress

**Expected Result:**
- ✅ Completed: 1
- ✅ Pending: 3
- ✅ Progress: 25%

**Complete 2 more:**
- ✅ Completed: 3
- ✅ Pending: 1
- ✅ Progress: 75%

---

## 🐛 Error Scenarios to Test

### Test 11: No Baby Selected
**Steps:**
1. Clear AsyncStorage: `selectedBabyId`
2. Open Routines page

**Expected Result:**
- ✅ Alert: "No Baby Selected"
- ✅ "Go to Dashboard" button
- ✅ Returns to dashboard

---

### Test 12: Network Error
**Steps:**
1. Stop backend server
2. Try to add routine

**Expected Result:**
- ✅ Error alert: "Failed to add routine"
- ✅ Modal stays open
- ✅ Form data preserved

---

### Test 13: Empty Routine Name
**Steps:**
1. Tap "+" to add routine
2. Leave name empty
3. Tap "Add Routine"

**Expected Result:**
- ✅ Alert: "Please enter a routine name"
- ✅ Modal stays open
- ✅ No API call made

---

### Test 14: Invalid Time Format
**Steps:**
1. Enter time: "25:00" (invalid)
2. Try to save

**Expected Result:**
- ✅ Backend validates
- ✅ Error message shows
- ✅ Modal stays open

---

## 📱 UI/UX Tests

### Test 15: Modal Interactions
**Steps:**
1. Open add routine modal
2. Tap outside modal (overlay)
3. Tap X button

**Expected Result:**
- ✅ Modal closes
- ✅ Form resets
- ✅ No data saved

---

### Test 16: Type Selector
**Steps:**
1. Open add routine modal
2. Tap different type buttons

**Expected Result:**
- ✅ Selected type highlighted (purple)
- ✅ Other types remain gray
- ✅ Only one selected at a time

---

### Test 17: Loading States
**Steps:**
1. Observe loading states during:
   - Initial load
   - Refresh
   - Adding routine
   - Deleting routine

**Expected Result:**
- ✅ Loading spinner displays
- ✅ Buttons disabled during operations
- ✅ No duplicate requests

---

## 🔍 Console Testing

### Check Console Logs:
```javascript
// Should see:
📱 API Request: GET http://...5000/api/routines?babyId=...
📱 API Response: 200 { success: true, data: {...} }

📱 API Request: POST http://...5000/api/routines
📱 API Response: 200 { success: true, data: {...} }

📱 API Request: DELETE http://...5000/api/routines/...
📱 API Response: 200 { success: true, message: "..." }
```

### Should NOT see:
- ❌ Unhandled promise rejections
- ❌ Undefined errors
- ❌ Network failures (unless testing error scenarios)

---

## 💾 Database Verification

### MongoDB Queries to Verify:

**1. Check Routines Created:**
```javascript
db.routines.find({ babyId: ObjectId("...") }).pretty()
```

**2. Check Entries Logged:**
```javascript
db.routineentries.find({ 
  babyId: ObjectId("..."),
  createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
}).pretty()
```

**3. Count Today's Completions:**
```javascript
db.routineentries.countDocuments({
  babyId: ObjectId("..."),
  completed: true,
  createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
})
```

**4. Verify Deletion:**
```javascript
// Should return 0
db.routines.countDocuments({ _id: ObjectId("deleted_id") })
```

---

## ✅ Evaluation Demo Checklist

### Before Demo:
- [ ] Backend server running
- [ ] MongoDB connected
- [ ] Test user created
- [ ] Test baby profile created
- [ ] Baby selected on dashboard
- [ ] Clear all test routines (start fresh)

### During Demo:
- [ ] Show empty state
- [ ] Add 2-3 different routine types
- [ ] Complete one routine
- [ ] Show progress calculation
- [ ] Use Feed quick action
- [ ] Use Sleep quick action  
- [ ] Use Diaper quick action
- [ ] Delete a routine
- [ ] Pull to refresh
- [ ] Explain database integration

### Talking Points:
1. "Everything is saved to MongoDB database"
2. "Notice the real-time progress updates"
3. "Quick action buttons for common activities"
4. "Type-specific colors and icons for clarity"
5. "Pull to refresh syncs with server"
6. "Confirmation dialogs prevent accidents"
7. "Can only complete routines once per day"
8. "All operations are immediate and persistent"

---

## 🎬 Demo Script

**Start:** 
"Let me show you the Routines feature. Currently, we have no routines."

**Add Routines:**
"I'll add a few common baby routines. First, Morning Feeding at 7 AM. Notice it gets a red feeding icon and appears immediately."

**Complete Routine:**
"Now when I tap this routine, it marks it as complete. See the green checkmark and the progress updates from 0% to 25%."

**Quick Actions:**
"For quick logging, we have these three buttons at the bottom. Let me log a feeding event - I enter the amount, 120ml, and it's saved to the database immediately."

**Delete:**
"If we don't need a routine anymore, tap this trash icon, confirm, and it's removed from the database."

**Database:**
"All of this is persisted in MongoDB. If I close the app and reopen, everything is still here because it's server-side."

---

## 🚨 Known Issues / Limitations

**Current Limitations:**
1. Can only complete routines once per day (by design)
2. Time format must be HH:MM (24-hour)
3. No edit routine feature (delete and re-add)
4. No weekly history view yet (can be added)

**These are not bugs, just scope decisions for 60% evaluation.**

---

## 📈 Performance Benchmarks

**Expected Load Times:**
- Initial load: < 2 seconds
- Add routine: < 1 second
- Delete routine: < 1 second
- Complete routine: < 1 second
- Quick action: < 1 second
- Refresh: < 2 seconds

**If slower:**
- Check network connection
- Check backend server performance
- Check MongoDB connection

---

**Testing Status:** ✅ **READY FOR EVALUATION**

All features tested and working with database integration!
