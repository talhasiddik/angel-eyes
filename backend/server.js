const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const babyRoutes = require('./routes/babies');
const monitoringRoutes = require('./routes/monitoring');
const communityRoutes = require('./routes/community');
const detectionsRoutes = require('./routes/detections');
const routineRoutes = require('./routes/routines');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO for real-time features
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://yourdomain.com'] 
      : ['http://localhost:3000', 'http://localhost:19006'],
    methods: ['GET', 'POST']
  }
});

// Store active monitoring sessions
const monitoringSessions = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join baby monitoring room
  socket.on('join-monitoring', (babyId) => {
    socket.join(`baby-${babyId}`);
    monitoringSessions.set(socket.id, babyId);
    console.log(`Client joined monitoring room for baby: ${babyId}`);
  });

  // Handle real-time alerts
  socket.on('safety-alert', (data) => {
    io.to(`baby-${data.babyId}`).emit('safety-alert', {
      type: data.type,
      severity: data.severity,
      message: data.message,
      timestamp: new Date(),
      babyId: data.babyId
    });
  });

  // Handle video stream events
  socket.on('video-stream', (data) => {
    socket.to(`baby-${data.babyId}`).emit('video-stream', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const babyId = monitoringSessions.get(socket.id);
    if (babyId) {
      socket.leave(`baby-${babyId}`);
      monitoringSessions.delete(socket.id);
    }
    console.log('Client disconnected:', socket.id);
  });
});

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : true, // Allow all origins in development
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/babies', authMiddleware, babyRoutes);
app.use('/api/community', authMiddleware, communityRoutes);
// app.use('/api/monitoring', authMiddleware, monitoringRoutes);
// app.use('/api/detections', authMiddleware, detectionsRoutes);
// app.use('/api/routines', authMiddleware, routineRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Angel Eyes API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Test endpoint for mobile connectivity
app.get('/api/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mobile app successfully connected to backend!',
    timestamp: new Date().toISOString(),
    clientIP: req.ip || req.connection.remoteAddress
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Angel Eyes Baby Monitoring API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// Error handling middleware (should be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found'
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
})
.catch((error) => {
  console.error('MongoDB connection error:', error.message);
  console.warn('Running without database connection - some features may not work');
  // Don't exit the process, continue running for frontend testing
});

// Server startup
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Angel Eyes API server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

// Make io available to routes
app.set('io', io);

module.exports = app;
