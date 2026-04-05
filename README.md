<p align="center">
  <img src="frontend/assets/logo/7.png" alt="Angel Eyes Logo" width="180"/>
</p>

<h1 align="center">👼 Angel Eyes</h1>

<p align="center">
  <strong>AI-Powered Baby Safety Monitoring System</strong>
</p>

<p align="center">
  <em>Keeping your little ones safe with the power of Computer Vision and Machine Learning</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React Native"/>
  <img src="https://img.shields.io/badge/Expo-1B1F23?style=for-the-badge&logo=expo&logoColor=white" alt="Expo"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/TensorFlow-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white" alt="TensorFlow"/>
  <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Production_Ready-success?style=flat-square" alt="Status"/>
  <img src="https://img.shields.io/badge/AI_Models-3_Integrated-blueviolet?style=flat-square" alt="AI Models"/>
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/PRs-Welcome-brightgreen?style=flat-square" alt="PRs Welcome"/>
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [Features](#-features)
- [AI Models](#-ai-models)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Screenshots](#-screenshots)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Contributing](#-contributing)
- [Team](#-team)
- [License](#-license)

---

## 🌟 Overview

**Angel Eyes** is a comprehensive AI-powered baby monitoring application designed to give parents peace of mind. Using advanced computer vision and machine learning, it provides real-time safety monitoring, intelligent alerts, and a complete suite of baby care tracking features.

<p align="center">
  <img src="frontend/live-monitoring.png" alt="Live Monitoring" width="200"/>
  <img src="frontend/detections.png" alt="Detections" width="200"/>
  <img src="frontend/track-routine.png" alt="Routines" width="200"/>
  <img src="frontend/community.png" alt="Community" width="200"/>
</p>

### 🎯 Key Highlights

| Feature | Description |
|---------|-------------|
| 🎥 **Real-time Monitoring** | Continuous video analysis with 2-second detection intervals |
| 🤖 **3 AI Models** | Sleep position, awake/asleep state, and cry detection |
| 🔔 **Instant Alerts** | Push notifications for critical safety events |
| 📊 **Smart Analytics** | Track routines, patterns, and milestones |
| 👥 **Parent Community** | Connect and share with other parents |

---

## 🚨 The Problem

<table>
<tr>
<td width="50%">

### SIDS Risk
Sudden Infant Death Syndrome (SIDS) is a leading cause of death in infants. Unsafe sleeping positions significantly increase this risk.

### Parent Exhaustion
New parents cannot monitor their baby 24/7, leading to anxiety and severe sleep deprivation.

### Understanding Cries
Decoding why a baby is crying is challenging, especially for first-time parents.

</td>
<td width="50%">

### 💡 Angel Eyes Solution

✅ **AI-powered position detection** identifies unsafe sleeping postures in real-time

✅ **Automated monitoring** so parents can rest while staying informed

✅ **Cry analysis** that explains why your baby is crying with actionable recommendations

✅ **Push notifications** for critical safety events

</td>
</tr>
</table>

---

## ✨ Features

### 🎥 Live Safety Monitoring
Real-time video feed analysis using computer vision to continuously assess your baby's safety status.

- **Pose Detection** — MediaPipe-powered body landmark tracking
- **Safety Classification** — Back (safe) vs Stomach/Side (unsafe)
- **Confidence Scores** — AI certainty levels for each detection
- **Session Logging** — Complete history of monitoring sessions

### 🧠 Intelligent Detection Alerts
Multi-level alert system with smart severity classification.

```
┌─────────────────────────────────────────────┐
│  SEVERITY LEVELS                            │
├─────────────────────────────────────────────┤
│  🟢 Normal    — Baby is safe, back position │
│  🟡 Warning   — Potential risk detected     │
│  🔴 Critical  — Immediate attention needed  │
└─────────────────────────────────────────────┘
```

### 📅 Routine Tracking
Comprehensive daily activity management with reminders.

| Activity | Color | Description |
|----------|-------|-------------|
| 🍼 Feeding | Red | Breast/bottle feeding times |
| 😴 Sleep | Blue | Nap and nighttime sleep |
| 🧷 Diaper | Yellow | Diaper changes |
| 💊 Medicine | Green | Medication schedules |
| 🎮 Activity | Purple | Tummy time, play, etc. |

### 👥 Parent Community
Connect with other parents through discussion forums.

- **8 Categories** — General, Sleep, Feeding, Health, Development, Safety, Products, Tips
- **Engagement** — Like posts, comment threads, share experiences
- **Real-time** — Instant updates with WebSocket integration

### 👶 Baby Profile Management
- Multiple baby profiles per account
- Health records and medical information
- Milestone tracking
- Caregiver relationship management

### 🔐 Security
- JWT-based authentication with token refresh
- Role-based access control
- Password hashing with bcrypt
- Input validation with Joi schemas
- Rate limiting and CORS protection

---

## 🤖 AI Models

Angel Eyes integrates **3 specialized machine learning models** working together to provide comprehensive safety monitoring.

<table>
<tr>
<td align="center" width="33%">
<img src="https://img.icons8.com/color/96/baby.png" width="60"/>
<h3>Sleep Position Detector</h3>
</td>
<td align="center" width="33%">
<img src="https://img.icons8.com/color/96/visible.png" width="60"/>
<h3>Awake/Sleep Detector</h3>
</td>
<td align="center" width="33%">
<img src="https://img.icons8.com/color/96/audio-wave.png" width="60"/>
<h3>Cry Detection System</h3>
</td>
</tr>
<tr>
<td valign="top">

**Model:** RandomForest Classifier

**Input:** 142 engineered features from MediaPipe pose landmarks

**Output:** 
- Back (Safe) ✅
- Stomach/Side (Unsafe) ⚠️

**Tech:** scikit-learn + MediaPipe

</td>
<td valign="top">

**Model:** MobileNetV2 CNN

**Input:** 64×64×3 eye region images

**Output:**
- Awake 👀
- Asleep 😴

**Tech:** TensorFlow + Keras 3.x

</td>
<td valign="top">

**Stage 1:** Binary cry detection (CNN)

**Stage 2:** 6-class reason classification:
- Belly pain
- Burping needed
- Cold/Hot
- Discomfort
- Hungry
- Tired

**Tech:** librosa + TensorFlow

</td>
</tr>
</table>

### 🔬 Detection Pipeline

```
┌──────────────┐    ┌───────────────┐    ┌──────────────┐    ┌─────────────┐
│   Camera     │───▶│  Frame        │───▶│  MediaPipe   │───▶│  Feature    │
│   Capture    │    │  Extraction   │    │  Pose        │    │  Engineering│
└──────────────┘    └───────────────┘    └──────────────┘    └──────┬──────┘
                                                                    │
                    ┌───────────────┐    ┌──────────────┐           │
                    │  Push         │◀───│  ML Model    │◀──────────┘
                    │  Notification │    │  Inference   │
                    └───────────────┘    └──────────────┘
```

---

## 🛠 Tech Stack

<table>
<tr>
<td valign="top" width="25%">

### 📱 Frontend
- React Native
- Expo SDK 54
- Expo Router
- Socket.IO Client
- AsyncStorage
- React Native Reanimated

</td>
<td valign="top" width="25%">

### ⚙️ Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.IO
- Firebase Admin SDK
- Cloudinary

</td>
<td valign="top" width="25%">

### 🧠 AI/ML
- Python + Flask
- TensorFlow 2.20+
- Keras 3.x
- MediaPipe
- scikit-learn
- OpenCV
- librosa

</td>
<td valign="top" width="25%">

### 🔒 Security
- JWT Authentication
- bcrypt.js
- Helmet
- CORS
- Rate Limiting
- Joi Validation

</td>
</tr>
</table>

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ANGEL EYES ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                          📱 MOBILE APPLICATION                           │
│                         (React Native + Expo)                            │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│  │ Dashboard  │ │ Monitoring │ │  Routines  │ │ Community  │            │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘            │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTP / WebSocket
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       ⚙️ EXPRESS.JS API SERVER                           │
│                            (Port 5000)                                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │    Auth     │ │   Babies    │ │  Sessions   │ │  Community  │        │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐        │
│  │  Routines   │ │ Detections  │ │      Socket.IO Server       │        │
│  └─────────────┘ └─────────────┘ └─────────────────────────────┘        │
└─────────────┬────────────────────────────────────────┬───────────────────┘
              │                                        │
              ▼                                        ▼
┌─────────────────────────────┐          ┌─────────────────────────────────┐
│      🗄️ MONGODB DATABASE     │          │      🧠 FLASK AI SERVICE         │
│                             │          │          (Port 5001)            │
│  • Users                    │          │  ┌───────────────────────────┐  │
│  • Babies                   │          │  │   Sleep Position Model    │  │
│  • MonitoringSessions       │          │  ├───────────────────────────┤  │
│  • Detections               │          │  │   Eye State Model         │  │
│  • Routines                 │          │  ├───────────────────────────┤  │
│  • RoutineEntries           │          │  │   Cry Detection Model     │  │
│  • CommunityPosts           │          │  └───────────────────────────┘  │
│                             │          │                                 │
└─────────────────────────────┘          └─────────────────────────────────┘
```

### Real-time Processing Flow

```
Every 2 Seconds:
    1. 📷 Capture frame from camera
    2. 🔄 Convert to Base64
    3. 📤 POST to Flask AI service
    4. 🧠 AI processes frame:
        ├── MediaPipe extracts 33 pose landmarks
        ├── Engineer 142 features
        └── RandomForest predicts position
    5. 📊 Return JSON with prediction + confidence
    6. 📱 Update React Native UI
    7. 🔔 If critical → Firebase push notification
```

---

## 📸 Screenshots

<p align="center">
<table>
<tr>
<td align="center">
<img src="frontend/live-monitoring.png" width="150"/>
<br/>
<b>Live Monitoring</b>
<br/>
<sub>Real-time safety checks</sub>
</td>
<td align="center">
<img src="frontend/detections.png" width="150"/>
<br/>
<b>Detections</b>
<br/>
<sub>AI-powered alerts</sub>
</td>
<td align="center">
<img src="frontend/track-routine.png" width="150"/>
<br/>
<b>Routines</b>
<br/>
<sub>Daily tracking</sub>
</td>
<td align="center">
<img src="frontend/community.png" width="150"/>
<br/>
<b>Community</b>
<br/>
<sub>Parent forums</sub>
</td>
</tr>
</table>
</p>

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- Python 3.10+
- MongoDB (local or Atlas)
- Expo CLI
- Android/iOS device or emulator

### Installation

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/talhasiddik/angel-eyes.git
cd angel-eyes
```

#### 2️⃣ Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, etc.

# Start the server
npm start
```

#### 3️⃣ AI Service Setup

```bash
cd backend/ai-service
pip install -r requirements.txt

# Start Flask server
python app.py
```

#### 4️⃣ Frontend Setup

```bash
cd frontend
npm install

# Update API endpoint in config
# Edit app.config.js or .env with your backend URL

# Start Expo
npx expo start
```

#### 5️⃣ Quick Start (Windows)

```bash
# Start all services at once
./start-all-services.bat
```

### Environment Variables

```env
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/angeleyes
JWT_SECRET=your-secret-key
JWT_EXPIRE=7d
PORT=5000

# Firebase (for push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# Cloudinary (for image storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

---

## 📚 API Documentation

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |

### Baby Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/babies` | Get all babies |
| POST | `/api/babies` | Create baby profile |
| GET | `/api/babies/:id` | Get baby by ID |
| PUT | `/api/babies/:id` | Update baby |
| DELETE | `/api/babies/:id` | Delete baby |

### Monitoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/monitoring/start` | Start monitoring session |
| POST | `/api/monitoring/stop` | Stop monitoring session |
| GET | `/api/monitoring/sessions` | Get all sessions |
| POST | `/api/monitoring/detection` | Log detection event |

### AI Service

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze-frame` | Analyze video frame |
| POST | `/analyze-cry` | Analyze audio for cry detection |
| GET | `/health` | Health check |

### Community

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/community/posts` | Get all posts |
| POST | `/api/community/posts` | Create post |
| POST | `/api/community/posts/:id/like` | Like/unlike post |
| POST | `/api/community/posts/:id/comments` | Add comment |

### Routines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/routines` | Get routines |
| POST | `/api/routines` | Create routine |
| POST | `/api/routines/log` | Log routine entry |
| GET | `/api/routines/stats` | Get statistics |

---

## 📁 Project Structure

```
angel-eyes/
├── 📱 frontend/                 # React Native mobile app
│   ├── app/                     # Expo Router screens
│   │   ├── (tabs)/              # Tab navigation
│   │   │   ├── index.js         # Dashboard
│   │   │   ├── monitor.js       # Live monitoring
│   │   │   ├── routines.js      # Routine tracking
│   │   │   └── community.js     # Parent community
│   │   └── _layout.js           # Root layout
│   ├── components/              # Reusable components
│   ├── services/                # API services
│   ├── assets/                  # Images, fonts, icons
│   │   └── logo/                # App logos
│   └── package.json
│
├── ⚙️ backend/                   # Node.js API server
│   ├── controllers/             # Route controllers
│   ├── models/                  # Mongoose schemas
│   ├── routes/                  # API routes
│   ├── middleware/              # Auth, validation, etc.
│   ├── utils/                   # Helper functions
│   ├── ai-service/              # Flask ML service
│   │   ├── models/              # Trained ML models
│   │   │   ├── sleep_position_model.pkl
│   │   │   ├── eye_state_model.h5
│   │   │   └── cry_detection_model.h5
│   │   ├── app.py               # Flask application
│   │   └── requirements.txt
│   └── package.json
│
├── 📖 docs/                      # Documentation
│   ├── index.html               # Portfolio page
│   ├── AI_INTEGRATION_GUIDE.md
│   ├── DEMO_PREPARATION_GUIDE.md
│   └── ...
│
├── start-all-services.bat       # Windows quick start
├── stop-all-services.bat        # Stop all services
└── README.md                    # You are here!
```

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Write meaningful commit messages
- Update documentation for new features
- Add tests where applicable
- Ensure all existing tests pass

---

## 👥 Team

<p align="center">
  <img src="1766143759234.jpg" alt="Angel Eyes Team" width="600" style="border-radius: 12px;"/>
</p>

<table>
<tr>
<td align="center" width="33%">
<h3>M. Talha Siddique</h3>
<sub><b>21I-0462</b></sub>
<br/><br/>
<b>🗄️ Data, Backend & AI Lead</b>
<br/><br/>
• Backend Development & Optimization<br/>
• AI Integration & Model Deployment<br/>
• Privacy & Security
</td>
<td align="center" width="33%">
<h3>Abdul Moiz</h3>
<sub><b>21I-0457</b></sub>
<br/><br/>
<b>📱 Frontend & Security Lead</b>
<br/><br/>
• Health & Routine Tracking<br/>
• Frontend Development<br/>
• Deployment & Testing
</td>
<td align="center" width="33%">
<h3>Talha Muazzam</h3>
<sub><b>21I-2536</b></sub>
<br/><br/>
<b>🤖 AI & Community Lead</b>
<br/><br/>
• Parental Support & Community<br/>
• AI Processing & Integration<br/>
• AI Monitoring
</td>
</tr>
</table>

**Final Year Project**  
FAST National University of Computer and Emerging Sciences

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for pose detection
- [TensorFlow](https://tensorflow.org/) for deep learning framework
- [Expo](https://expo.dev/) for React Native development
- [MongoDB](https://mongodb.com/) for database
- All the parents who inspired this project

---

<p align="center">
  <img src="frontend/assets/logo/7.png" alt="Angel Eyes" width="80"/>
  <br/>
  <strong>Angel Eyes</strong>
  <br/>
  <em>Because every baby deserves a guardian angel</em>
  <br/><br/>
  Made with ❤️ for parents everywhere
</p>

<p align="center">
  <a href="#-angel-eyes">⬆️ Back to Top</a>
</p>
