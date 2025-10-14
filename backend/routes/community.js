const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');

const router = express.Router();

// Define Community Post Schema
const postSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  category: {
    type: String,
    enum: ['General', 'Sleep', 'Feeding', 'Health', 'Development', 'Safety', 'Products', 'Tips'],
    required: true
  },
  tags: [String],
  images: [String],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 1000
    },
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    replies: [{
      author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      content: {
        type: String,
        required: true,
        maxlength: 500
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isReported: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
postSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Indexes
postSchema.index({ author: 1 });
postSchema.index({ category: 1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ isPinned: -1, createdAt: -1 });

const Post = mongoose.model('Post', postSchema);

// Validation schemas
const createPostSchema = Joi.object({
  title: Joi.string().max(200).required(),
  content: Joi.string().max(5000).required(),
  category: Joi.string().valid('General', 'Sleep', 'Feeding', 'Health', 'Development', 'Safety', 'Products', 'Tips').required(),
  tags: Joi.array().items(Joi.string().max(30)).max(10).optional(),
  images: Joi.array().items(Joi.string()).max(5).optional()
});

const updatePostSchema = Joi.object({
  title: Joi.string().max(200).optional(),
  content: Joi.string().max(5000).optional(),
  category: Joi.string().valid('General', 'Sleep', 'Feeding', 'Health', 'Development', 'Safety', 'Products', 'Tips').optional(),
  tags: Joi.array().items(Joi.string().max(30)).max(10).optional(),
  images: Joi.array().items(Joi.string()).max(5).optional()
});

const commentSchema = Joi.object({
  content: Joi.string().max(1000).required()
});

// @route   POST /api/community/posts
// @desc    Create a new community post
// @access  Private
router.post('/posts', async (req, res) => {
  try {
    // Check if user preferences allow community interaction
    if (!req.user.preferences.privacy.allowCommunityInteraction) {
      return res.status(403).json({
        success: false,
        message: 'Community interaction is disabled in your privacy settings'
      });
    }

    // Validate request body
    const { error, value } = createPostSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { title, content, category, tags, images } = value;

    const post = new Post({
      author: req.user._id,
      title,
      content,
      category,
      tags: tags || [],
      images: images || []
    });

    await post.save();
    await post.populate('author', 'firstName lastName profilePicture');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: {
        post: {
          id: post._id,
          author: post.author,
          title: post.title,
          content: post.content,
          category: post.category,
          tags: post.tags,
          images: post.images,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          viewCount: post.viewCount,
          createdAt: post.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating post'
    });
  }
});

// @route   GET /api/community/posts
// @desc    Get community posts with filtering and pagination
// @access  Private
router.get('/posts', async (req, res) => {
  try {
    const { 
      category, 
      search, 
      sortBy = 'recent', 
      limit = 20, 
      page = 1 
    } = req.query;

    // Build query
    const query = { isActive: true };
    
    if (category && category !== 'All') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort criteria
    let sortCriteria = {};
    switch (sortBy) {
      case 'popular':
        sortCriteria = { likeCount: -1, createdAt: -1 };
        break;
      case 'discussed':
        sortCriteria = { commentCount: -1, createdAt: -1 };
        break;
      case 'recent':
      default:
        sortCriteria = { isPinned: -1, createdAt: -1 };
        break;
    }

    const skip = (page - 1) * limit;

    const posts = await Post.find(query)
      .sort(sortCriteria)
      .limit(parseInt(limit))
      .skip(skip)
      .populate('author', 'firstName lastName profilePicture')
      .populate('comments.author', 'firstName lastName profilePicture')
      .populate('likes.user', 'firstName lastName')
      .select('-comments.replies'); // Exclude replies for performance

    const total = await Post.countDocuments(query);

    // Check which posts current user has liked
    const postsWithUserLikes = posts.map(post => {
      const userLiked = post.likes.some(like => 
        like.user._id.toString() === req.user._id.toString()
      );

      return {
        id: post._id,
        author: post.author,
        title: post.title,
        content: post.content.length > 300 ? 
          post.content.substring(0, 300) + '...' : post.content,
        category: post.category,
        tags: post.tags,
        images: post.images,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        viewCount: post.viewCount,
        userLiked,
        isPinned: post.isPinned,
        createdAt: post.createdAt,
        recentComments: post.comments.slice(-3).reverse()
      };
    });

    res.json({
      success: true,
      data: {
        posts: postsWithUserLikes,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posts'
    });
  }
});

// @route   GET /api/community/posts/:id
// @desc    Get single post with full details
// @access  Private
router.get('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'firstName lastName profilePicture')
      .populate('comments.author', 'firstName lastName profilePicture')
      .populate('comments.replies.author', 'firstName lastName profilePicture')
      .populate('likes.user', 'firstName lastName');

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    // Check if user has liked the post
    const userLiked = post.likes.some(like => 
      like.user._id.toString() === req.user._id.toString()
    );

    // Process comments to include user likes
    const commentsWithUserLikes = post.comments.map(comment => {
      const userLikedComment = comment.likes.some(like => 
        like.user.toString() === req.user._id.toString()
      );

      return {
        id: comment._id,
        author: comment.author,
        content: comment.content,
        likes: comment.likes.length,
        userLiked: userLikedComment,
        replies: comment.replies,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      };
    });

    res.json({
      success: true,
      data: {
        post: {
          id: post._id,
          author: post.author,
          title: post.title,
          content: post.content,
          category: post.category,
          tags: post.tags,
          images: post.images,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          viewCount: post.viewCount,
          userLiked,
          isPinned: post.isPinned,
          comments: commentsWithUserLikes,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching post'
    });
  }
});

// @route   PUT /api/community/posts/:id/like
// @desc    Like or unlike a post
// @access  Private
router.put('/posts/:id/like', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user already liked the post
    const existingLikeIndex = post.likes.findIndex(like => 
      like.user.toString() === req.user._id.toString()
    );

    let action;
    if (existingLikeIndex > -1) {
      // Unlike the post
      post.likes.splice(existingLikeIndex, 1);
      action = 'unliked';
    } else {
      // Like the post
      post.likes.push({ user: req.user._id });
      action = 'liked';
    }

    await post.save();

    res.json({
      success: true,
      message: `Post ${action} successfully`,
      data: {
        action,
        likeCount: post.likes.length
      }
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating post like'
    });
  }
});

// @route   POST /api/community/posts/:id/comments
// @desc    Add comment to a post
// @access  Private
router.post('/posts/:id/comments', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = commentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { content } = value;

    const post = await Post.findById(req.params.id);

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comment = {
      author: req.user._id,
      content,
      likes: [],
      replies: []
    };

    post.comments.push(comment);
    await post.save();

    // Populate the new comment
    await post.populate('comments.author', 'firstName lastName profilePicture');

    const newComment = post.comments[post.comments.length - 1];

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment: {
          id: newComment._id,
          author: newComment.author,
          content: newComment.content,
          likes: newComment.likes.length,
          userLiked: false,
          replies: newComment.replies,
          createdAt: newComment.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding comment'
    });
  }
});

// @route   PUT /api/community/posts/:postId/comments/:commentId/like
// @desc    Like/unlike a comment
// @access  Private
router.put('/posts/:postId/comments/:commentId/like', async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const userLikeIndex = comment.likes.findIndex(
      like => like.user.toString() === req.user._id.toString()
    );

    let action;
    if (userLikeIndex > -1) {
      // User already liked - remove like
      comment.likes.splice(userLikeIndex, 1);
      action = 'unliked';
    } else {
      // Add like
      comment.likes.push({ user: req.user._id });
      action = 'liked';
    }

    await post.save();

    res.json({
      success: true,
      message: `Comment ${action} successfully`,
      data: {
        action,
        likeCount: comment.likes.length,
        commentId: comment._id
      }
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating like'
    });
  }
});

// @route   POST /api/community/posts/:postId/comments/:commentId/replies
// @desc    Reply to a comment
// @access  Private
router.post('/posts/:postId/comments/:commentId/replies', async (req, res) => {
  try {
    // Validate request body
    const replySchema = Joi.object({
      content: Joi.string().required().max(500).trim()
    });

    const { error, value } = replySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    const { content } = value;

    const post = await Post.findById(req.params.postId);

    if (!post || !post.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    const reply = {
      author: req.user._id,
      content,
      createdAt: new Date()
    };

    comment.replies.push(reply);
    await post.save();

    // Populate the new reply
    await post.populate('comments.replies.author', 'firstName lastName profilePicture');

    const newReply = comment.replies[comment.replies.length - 1];

    res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      data: {
        reply: {
          id: newReply._id,
          author: newReply.author,
          content: newReply.content,
          createdAt: newReply.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding reply'
    });
  }
});

// @route   GET /api/community/categories
// @desc    Get community categories with post counts
// @access  Private
router.get('/categories', async (req, res) => {
  try {
    const categories = await Post.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const categoriesWithLabels = categories.map(cat => ({
      value: cat._id,
      label: cat._id,
      count: cat.count
    }));

    // Add "All" category
    const totalPosts = await Post.countDocuments({ isActive: true });
    categoriesWithLabels.unshift({
      value: 'All',
      label: 'All Categories',
      count: totalPosts
    });

    res.json({
      success: true,
      data: {
        categories: categoriesWithLabels
      }
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories'
    });
  }
});

// @route   GET /api/community/trending-tags
// @desc    Get trending tags
// @access  Private
router.get('/trending-tags', async (req, res) => {
  try {
    const tags = await Post.aggregate([
      { $match: { isActive: true, createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        tags: tags.map(tag => ({
          name: tag._id,
          count: tag.count
        }))
      }
    });
  } catch (error) {
    console.error('Get trending tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching trending tags'
    });
  }
});

module.exports = router;
