const express = require('express');
const Joi = require('joi');
const MonitoringSession = require('../models/MonitoringSession');
const Detection = require('../models/Detection');
const Baby = require('../models/Baby');

const router = express.Router();

// Validation schemas
const startSessionSchema = Joi.object({
  babyId: Joi.string().required(),
  sessionType: Joi.string().valid('Sleep', 'Play', 'Feeding', 'General').required(),
  settings: Joi.object({
    videoQuality: Joi.string().valid('Low', 'Medium', 'High', 'HD').default('Medium'),
    audioEnabled: Joi.boolean().default(true),
    nightVision: Joi.boolean().default(false),
    motionDetection: Joi.boolean().default(true),
    soundDetection: Joi.boolean().default(true),
    safetyAlerts: Joi.boolean().default(true),
    recordingEnabled: Joi.boolean().default(false)
  }).optional()
});

// @route   POST /api/monitoring/start
// @desc    Start a new monitoring session
// @access  Private
router.post('/start', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = startSessionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { babyId, sessionType, settings } = value;

    // Verify baby exists and user has access
    const baby = await Baby.findById(babyId);
    if (!baby || !baby.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Baby not found'
      });
    }

    if (!baby.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to monitor this baby'
      });
    }

    // Check if there's already an active session for this baby
    const existingSession = await MonitoringSession.findOne({
      babyId,
      status: 'Active'
    });

    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'There is already an active monitoring session for this baby',
        data: {
          existingSessionId: existingSession._id
        }
      });
    }

    // Create new monitoring session
    const session = new MonitoringSession({
      babyId,
      startedBy: req.user._id,
      sessionType,
      settings: settings || {},
      devices: [{
        deviceId: req.headers['device-id'] || 'unknown',
        deviceType: req.headers['device-type'] || 'Mobile',
        platform: req.headers['platform'] || 'Unknown'
      }]
    });

    await session.save();

    // Populate related data
    await session.populate('babyId', 'name profilePicture');
    await session.populate('startedBy', 'firstName lastName');

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`baby-${babyId}`).emit('session-started', {
        sessionId: session._id,
        babyId,
        startedBy: session.startedBy,
        sessionType,
        startTime: session.startTime
      });
    }

    res.status(201).json({
      success: true,
      message: 'Monitoring session started successfully',
      data: {
        session: {
          id: session._id,
          baby: session.babyId,
          startedBy: session.startedBy,
          startTime: session.startTime,
          sessionType: session.sessionType,
          status: session.status,
          settings: session.settings
        }
      }
    });
  } catch (error) {
    console.error('Start monitoring session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error starting monitoring session'
    });
  }
});

// @route   PUT /api/monitoring/:sessionId/end
// @desc    End a monitoring session
// @access  Private
router.put('/:sessionId/end', async (req, res) => {
  try {
    const session = await MonitoringSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Monitoring session not found'
      });
    }

    // Verify baby access
    const baby = await Baby.findById(session.babyId);
    if (!baby || !baby.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this monitoring session'
      });
    }

    if (session.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Session is not active'
      });
    }

    // End the session
    await session.endSession();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`baby-${session.babyId}`).emit('session-ended', {
        sessionId: session._id,
        babyId: session.babyId,
        endTime: session.endTime,
        duration: session.duration
      });
    }

    res.json({
      success: true,
      message: 'Monitoring session ended successfully',
      data: {
        session: {
          id: session._id,
          endTime: session.endTime,
          duration: session.duration,
          durationFormatted: session.durationFormatted,
          status: session.status
        }
      }
    });
  } catch (error) {
    console.error('End monitoring session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error ending monitoring session'
    });
  }
});

// @route   POST /api/monitoring/sessions
// @desc    Create a new monitoring session (simplified for mobile camera)
// @access  Private
router.post('/sessions', async (req, res) => {
  try {
    const { babyId, deviceType = 'mobile', deviceName = 'Mobile Camera' } = req.body;

    if (!babyId) {
      return res.status(400).json({
        success: false,
        message: 'Baby ID is required'
      });
    }

    // Verify baby exists and user has access
    const baby = await Baby.findById(babyId);
    if (!baby || !baby.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Baby not found'
      });
    }

    if (!baby.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this baby'
      });
    }

    // Create new session
    const session = new MonitoringSession({
      babyId,
      startedBy: req.user._id,
      sessionType: 'General',
      status: 'Active',
      startTime: new Date(),
      settings: {
        videoQuality: 'Medium',
        audioEnabled: true,
        nightVision: false,
        motionDetection: true,
        soundDetection: true,
        safetyAlerts: true,
        recordingEnabled: false
      }
    });

    await session.save();

    res.status(201).json({
      success: true,
      message: 'Monitoring session created successfully',
      data: {
        session: {
          id: session._id,
          babyId: session.babyId,
          status: session.status,
          startTime: session.startTime,
          deviceType,
          deviceName
        }
      }
    });
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating monitoring session'
    });
  }
});

// @route   GET /api/monitoring/sessions
// @desc    Get monitoring sessions for user's babies
// @access  Private
router.get('/sessions', async (req, res) => {
  try {
    const { babyId, status, limit = 20, page = 1 } = req.query;

    // Get user's babies
    const babies = await Baby.find({
      $or: [
        { parents: req.user._id },
        { 'caregivers.user': req.user._id }
      ],
      isActive: true
    });

    const babyIds = babies.map(baby => baby._id);

    // Build query
    const query = { babyId: { $in: babyIds } };
    
    if (babyId) {
      // Verify access to specific baby
      if (!babyIds.some(id => id.toString() === babyId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this baby'
        });
      }
      query.babyId = babyId;
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const sessions = await MonitoringSession.find(query)
      .sort({ startTime: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('babyId', 'name profilePicture')
      .populate('startedBy', 'firstName lastName');

    const total = await MonitoringSession.countDocuments(query);

    res.json({
      success: true,
      data: {
        sessions: sessions.map(session => ({
          id: session._id,
          baby: session.babyId,
          startedBy: session.startedBy,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          durationFormatted: session.durationFormatted,
          sessionType: session.sessionType,
          status: session.status,
          settings: session.settings,
          statistics: session.statistics,
          activeAlerts: session.activeAlerts.length,
          totalDetections: session.detections.length
        })),
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get monitoring sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monitoring sessions'
    });
  }
});

// @route   GET /api/monitoring/sessions/:sessionId
// @desc    Get detailed monitoring session
// @access  Private
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await MonitoringSession.findById(req.params.sessionId)
      .populate('babyId', 'name profilePicture')
      .populate('startedBy', 'firstName lastName')
      .populate('detections')
      .populate('alerts.acknowledgedBy', 'firstName lastName');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Monitoring session not found'
      });
    }

    // Verify baby access
    const baby = await Baby.findById(session.babyId);
    if (!baby || !baby.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this monitoring session'
      });
    }

    res.json({
      success: true,
      data: {
        session: {
          id: session._id,
          baby: session.babyId,
          startedBy: session.startedBy,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          durationFormatted: session.durationFormatted,
          sessionType: session.sessionType,
          status: session.status,
          settings: session.settings,
          detections: session.detections,
          alerts: session.alerts,
          recordings: session.recordings,
          statistics: session.statistics,
          devices: session.devices,
          notes: session.notes,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get monitoring session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monitoring session'
    });
  }
});

// @route   PATCH /api/monitoring/sessions/:sessionId
// @desc    Update monitoring session (end session, update status)
// @access  Private
router.patch('/sessions/:sessionId', async (req, res) => {
  try {
    const { status } = req.body;

    const session = await MonitoringSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Monitoring session not found'
      });
    }

    // Verify baby access
    const baby = await Baby.findById(session.babyId);
    if (!baby || !baby.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this monitoring session'
      });
    }

    // Update status
    if (status === 'ended' && session.status === 'Active') {
      session.status = 'Ended';
      session.endTime = new Date();
      
      // Calculate duration in seconds
      if (session.startTime) {
        session.duration = Math.floor((session.endTime - session.startTime) / 1000);
      }
    }

    await session.save();

    res.json({
      success: true,
      message: 'Monitoring session updated successfully',
      data: {
        session: {
          id: session._id,
          status: session.status,
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration
        }
      }
    });
  } catch (error) {
    console.error('Update monitoring session error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating monitoring session'
    });
  }
});

// @route   GET /api/monitoring/active
// @desc    Get active monitoring sessions for user's babies
// @access  Private
router.get('/active', async (req, res) => {
  try {
    // Get user's babies
    const babies = await Baby.find({
      $or: [
        { parents: req.user._id },
        { 'caregivers.user': req.user._id }
      ],
      isActive: true
    });

    const babyIds = babies.map(baby => baby._id);

    const activeSessions = await MonitoringSession.find({
      babyId: { $in: babyIds },
      status: 'Active'
    })
    .populate('babyId', 'name profilePicture')
    .populate('startedBy', 'firstName lastName')
    .sort({ startTime: -1 });

    res.json({
      success: true,
      data: {
        activeSessions: activeSessions.map(session => ({
          id: session._id,
          baby: session.babyId,
          startedBy: session.startedBy,
          startTime: session.startTime,
          duration: Math.floor((new Date() - session.startTime) / 1000),
          sessionType: session.sessionType,
          settings: session.settings,
          activeAlerts: session.activeAlerts.length,
          recentDetections: session.detections.slice(-5)
        })),
        count: activeSessions.length
      }
    });
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active monitoring sessions'
    });
  }
});

// @route   PUT /api/monitoring/:sessionId/settings
// @desc    Update monitoring session settings
// @access  Private
router.put('/:sessionId/settings', async (req, res) => {
  try {
    const session = await MonitoringSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Monitoring session not found'
      });
    }

    // Verify baby access
    const baby = await Baby.findById(session.babyId);
    if (!baby || !baby.hasAccess(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this monitoring session'
      });
    }

    // Update settings
    Object.assign(session.settings, req.body);
    await session.save();

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.to(`baby-${session.babyId}`).emit('settings-updated', {
        sessionId: session._id,
        settings: session.settings
      });
    }

    res.json({
      success: true,
      message: 'Session settings updated successfully',
      data: {
        settings: session.settings
      }
    });
  } catch (error) {
    console.error('Update session settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating session settings'
    });
  }
});

module.exports = router;
