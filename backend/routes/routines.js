const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const Baby = require('../models/Baby');

const router = express.Router();

// Define Routine Schema
const routineSchema = new mongoose.Schema({
  babyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Baby',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 100
  },
  type: {
    type: String,
    enum: ['Sleep', 'Feeding', 'Diaper', 'Medicine', 'Activity', 'Custom'],
    required: true
  },
  schedule: [{
    time: {
      type: String, // HH:MM format
      required: true
    },
    duration: {
      type: Number, // in minutes
      default: 0
    },
    notes: String,
    reminderEnabled: {
      type: Boolean,
      default: true
    },
    reminderMinutesBefore: {
      type: Number,
      default: 15
    }
  }],
  daysOfWeek: [{
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: Date,
  settings: {
    autoComplete: {
      type: Boolean,
      default: false
    },
    allowManualEntry: {
      type: Boolean,
      default: true
    },
    trackVariations: {
      type: Boolean,
      default: true
    }
  },
  statistics: {
    totalEntries: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    },
    averageDuration: {
      type: Number,
      default: 0
    },
    lastCompleted: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for next scheduled time
routineSchema.virtual('nextScheduledTime').get(function() {
  if (!this.schedule || !this.schedule.length) return null;
  if (!this.daysOfWeek || !this.daysOfWeek.length) return null;
  
  const now = new Date();
  const today = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Check if routine runs today
  if (!this.daysOfWeek.includes(dayNames[today])) {
    return null;
  }
  
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  // Find next time slot for today
  for (const slot of this.schedule) {
    if (slot.time > currentTime) {
      return slot.time;
    }
  }
  
  return null;
});

const Routine = mongoose.model('Routine', routineSchema);

// Define Routine Entry Schema (for tracking actual events)
const routineEntrySchema = new mongoose.Schema({
  routineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Routine',
    required: false  // Changed to false to allow manual entries without routineId
  },
  babyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Baby',
    required: true
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['Sleep', 'Feeding', 'Diaper', 'Medicine', 'Activity', 'Custom'],
    required: true
  },
  scheduledTime: String, // HH:MM format
  actualTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  duration: Number, // in minutes
  details: {
    // For feeding
    feedingType: {
      type: String,
      enum: ['Breastfeeding', 'Formula', 'Solid', 'Water']
    },
    amount: Number, // in ml
    breast: {
      type: String,
      enum: ['Left', 'Right', 'Both']
    },
    
    // For sleep
    sleepQuality: {
      type: String,
      enum: ['Excellent', 'Good', 'Fair', 'Poor']
    },
    location: String, // crib, bed, etc.
    
    // For diaper
    diaperType: {
      type: String,
      enum: ['Wet', 'Soiled', 'Both', 'Clean']
    },
    
    // For medicine
    medicationName: String,
    dosage: String,
    
    // For activity
    activityType: String,
    
    // General
    temperature: Number,
    mood: {
      type: String,
      enum: ['Happy', 'Fussy', 'Sleepy', 'Alert', 'Crying']
    },
    notes: String
  },
  isCompleted: {
    type: Boolean,
    default: true
  },
  wasScheduled: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const RoutineEntry = mongoose.model('RoutineEntry', routineEntrySchema);

// Validation schemas
const createRoutineSchema = Joi.object({
  babyId: Joi.string().required(),
  name: Joi.string().max(100).required(),
  type: Joi.string().valid('Sleep', 'Feeding', 'Diaper', 'Medicine', 'Activity', 'Custom').required(),
  schedule: Joi.array().items(Joi.object({
    time: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    duration: Joi.number().min(0).max(1440).default(0),
    notes: Joi.string().max(500).optional(),
    reminderEnabled: Joi.boolean().default(true),
    reminderMinutesBefore: Joi.number().min(0).max(120).default(15)
  })).min(1).required(),
  daysOfWeek: Joi.array().items(
    Joi.string().valid('Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday')
  ).min(1).required(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  settings: Joi.object({
    autoComplete: Joi.boolean().default(false),
    allowManualEntry: Joi.boolean().default(true),
    trackVariations: Joi.boolean().default(true)
  }).optional()
});

const createEntrySchema = Joi.object({
  routineId: Joi.string().optional(),
  babyId: Joi.string().required(),
  type: Joi.string().valid('Sleep', 'Feeding', 'Diaper', 'Medicine', 'Activity', 'Custom').required(),
  actualTime: Joi.date().optional(),
  duration: Joi.number().min(0).max(1440).optional(),
  details: Joi.object().optional(),
  notes: Joi.string().max(1000).optional()
});

// @route   POST /api/routines
// @desc    Create a new routine
// @access  Private
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createRoutineSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { babyId, name, type, schedule, daysOfWeek, startDate, endDate, settings } = value;

    // Verify baby exists and user has access
    const baby = await Baby.findById(babyId);
    if (!baby || !baby.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Baby not found'
      });
    }

    const permissions = baby.getUserPermissions(req.user._id);
    if (!permissions.editRoutines) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to create routines for this baby'
      });
    }

    // Create routine
    const routine = new Routine({
      babyId,
      createdBy: req.user._id,
      name,
      type,
      schedule,
      daysOfWeek,
      startDate: startDate || new Date(),
      endDate,
      settings: settings || {}
    });

    await routine.save();
    await routine.populate('babyId', 'name');
    await routine.populate('createdBy', 'firstName lastName');

    res.status(201).json({
      success: true,
      message: 'Routine created successfully',
      data: {
        routine: {
          id: routine._id,
          baby: routine.babyId,
          createdBy: routine.createdBy,
          name: routine.name,
          type: routine.type,
          schedule: routine.schedule,
          daysOfWeek: routine.daysOfWeek,
          nextScheduledTime: routine.nextScheduledTime,
          startDate: routine.startDate,
          endDate: routine.endDate,
          settings: routine.settings,
          statistics: routine.statistics,
          createdAt: routine.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create routine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating routine'
    });
  }
});

// @route   GET /api/routines
// @desc    Get routines for user's babies
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { babyId, type, isActive } = req.query;

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

    if (type) query.type = type;
    // Only filter by isActive if explicitly provided
    if (isActive !== undefined) {
      query.isActive = isActive === 'true' || isActive === true;
    }

    const routines = await Routine.find(query)
      .sort({ createdAt: -1 })
      .populate('babyId', 'name profilePicture')
      .populate('createdBy', 'firstName lastName');

    res.json({
      success: true,
      data: {
        routines: routines.map(routine => ({
          id: routine._id,
          baby: routine.babyId,
          createdBy: routine.createdBy,
          name: routine.name,
          type: routine.type,
          schedule: routine.schedule,
          daysOfWeek: routine.daysOfWeek,
          nextScheduledTime: routine.nextScheduledTime,
          isActive: routine.isActive,
          startDate: routine.startDate,
          endDate: routine.endDate,
          settings: routine.settings,
          statistics: routine.statistics,
          createdAt: routine.createdAt
        })),
        count: routines.length
      }
    });
  } catch (error) {
    console.error('Get routines error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching routines'
    });
  }
});

// @route   POST /api/routines/entries
// @desc    Log a routine entry
// @access  Private
router.post('/entries', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = createEntrySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { routineId, babyId, type, actualTime, duration, details } = value;

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

    // If routineId provided, verify it exists and belongs to the baby
    let routine = null;
    if (routineId) {
      routine = await Routine.findOne({ _id: routineId, babyId });
      if (!routine) {
        return res.status(404).json({
          success: false,
          message: 'Routine not found or does not belong to this baby'
        });
      }
    }

    // Create routine entry
    const entry = new RoutineEntry({
      routineId,
      babyId,
      recordedBy: req.user._id,
      type,
      actualTime: actualTime || new Date(),
      duration,
      details: details || {},
      wasScheduled: !!routineId
    });

    await entry.save();

    // Update routine statistics if this was a scheduled entry
    if (routine) {
      routine.statistics.totalEntries += 1;
      routine.statistics.lastCompleted = entry.actualTime;

      if (duration) {
        const totalDuration = routine.statistics.averageDuration * (routine.statistics.totalEntries - 1) + duration;
        routine.statistics.averageDuration = totalDuration / routine.statistics.totalEntries;
      }

      await routine.save();
    }

    await entry.populate('babyId', 'name');
    await entry.populate('recordedBy', 'firstName lastName');
    if (routineId) {
      await entry.populate('routineId', 'name type');
    }

    res.status(201).json({
      success: true,
      message: 'Routine entry logged successfully',
      data: {
        entry: {
          id: entry._id,
          routine: entry.routineId,
          baby: entry.babyId,
          recordedBy: entry.recordedBy,
          type: entry.type,
          actualTime: entry.actualTime,
          duration: entry.duration,
          details: entry.details,
          wasScheduled: entry.wasScheduled,
          createdAt: entry.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create routine entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging routine entry'
    });
  }
});

// @route   GET /api/routines/entries
// @desc    Get routine entries with filtering
// @access  Private
router.get('/entries', async (req, res) => {
  try {
    const { 
      babyId, 
      routineId, 
      type, 
      startDate, 
      endDate, 
      limit = 50, 
      page = 1 
    } = req.query;

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

    if (routineId) query.routineId = routineId;
    if (type) query.type = type;

    // Date range filter
    if (startDate || endDate) {
      query.actualTime = {};
      if (startDate) query.actualTime.$gte = new Date(startDate);
      if (endDate) query.actualTime.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const entries = await RoutineEntry.find(query)
      .sort({ actualTime: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('babyId', 'name profilePicture')
      .populate('routineId', 'name type')
      .populate('recordedBy', 'firstName lastName');

    const total = await RoutineEntry.countDocuments(query);

    res.json({
      success: true,
      data: {
        entries: entries.map(entry => ({
          id: entry._id,
          routine: entry.routineId,
          baby: entry.babyId,
          recordedBy: entry.recordedBy,
          type: entry.type,
          actualTime: entry.actualTime,
          duration: entry.duration,
          details: entry.details,
          wasScheduled: entry.wasScheduled,
          createdAt: entry.createdAt
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
    console.error('Get routine entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching routine entries'
    });
  }
});

// @route   GET /api/routines/today/:babyId
// @desc    Get today's routine schedule for a baby
// @access  Private
router.get('/today/:babyId', async (req, res) => {
  try {
    // Verify baby access
    const baby = await Baby.findById(req.params.babyId);
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

    const today = new Date();
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Get active routines for today
    const routines = await Routine.find({
      babyId: req.params.babyId,
      isActive: true,
      daysOfWeek: dayName,
      startDate: { $lte: today }
    }).populate('createdBy', 'firstName lastName');

    // Get today's entries
    const entries = await RoutineEntry.find({
      babyId: req.params.babyId,
      actualTime: { $gte: startOfDay, $lte: endOfDay }
    }).populate('routineId', 'name type');

    // Build today's schedule
    const schedule = [];
    for (const routine of routines) {
      for (const slot of routine.schedule) {
        const existing = entries.find(entry => 
          entry.routineId && 
          entry.routineId._id.toString() === routine._id.toString() &&
          entry.scheduledTime === slot.time
        );

        schedule.push({
          routineId: routine._id,
          routineName: routine.name,
          type: routine.type,
          scheduledTime: slot.time,
          duration: slot.duration,
          notes: slot.notes,
          reminderEnabled: slot.reminderEnabled,
          reminderMinutesBefore: slot.reminderMinutesBefore,
          isCompleted: !!existing,
          entry: existing ? {
            id: existing._id,
            actualTime: existing.actualTime,
            duration: existing.duration,
            details: existing.details
          } : null
        });
      }
    }

    // Sort by scheduled time
    schedule.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    // Get manual entries (not linked to routines)
    const manualEntries = entries.filter(entry => !entry.routineId);

    res.json({
      success: true,
      data: {
        date: startOfDay,
        dayName,
        schedule,
        manualEntries: manualEntries.map(entry => ({
          id: entry._id,
          type: entry.type,
          actualTime: entry.actualTime,
          duration: entry.duration,
          details: entry.details
        })),
        statistics: {
          totalScheduled: schedule.length,
          completed: schedule.filter(item => item.isCompleted).length,
          completionRate: schedule.length > 0 ? 
            (schedule.filter(item => item.isCompleted).length / schedule.length * 100).toFixed(1) : 0
        }
      }
    });
  } catch (error) {
    console.error('Get today schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s schedule'
    });
  }
});

// DELETE /routines/:id - Delete a routine
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Find the routine
    const routine = await Routine.findById(id);

    if (!routine) {
      return res.status(404).json({
        success: false,
        message: 'Routine not found'
      });
    }

    // Verify the user has permission to delete this routine
    const baby = await Baby.findById(routine.babyId);
    if (!baby) {
      return res.status(404).json({
        success: false,
        message: 'Baby not found'
      });
    }

    const isParent = baby.parents.some(p => p.toString() === req.user._id.toString());
    if (!isParent && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this routine'
      });
    }

    // Delete the routine
    await Routine.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Routine deleted successfully'
    });
  } catch (error) {
    console.error('Delete routine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting routine'
    });
  }
});

module.exports = router;
