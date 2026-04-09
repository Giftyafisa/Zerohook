const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('./auth');
const { ContentPost, Comment, Follow, Bookmark, User, AdultService, Notification } = require('../config/database');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Validate ObjectId params — returns 400 early if invalid
const validateObjectId = (id, label = 'ID') => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return { valid: false, label };
  }
  return { valid: true };
};

const safePagination = (page, limit, maxLimit = 100) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 20));
  return { page: p, limit: l, skip: (p - 1) * l };
};

// Rate limiters
const postLimiter = new RateLimiterMemory({ points: 10, duration: 900 }); // 10 posts per 15 min
const commentLimiter = new RateLimiterMemory({ points: 30, duration: 900 }); // 30 comments per 15 min
const likeLimiter = new RateLimiterMemory({ points: 60, duration: 60 }); // 60 likes per minute

const rateLimit = (limiter) => async (req, res, next) => {
  try {
    await limiter.consume(req.user?.userId || req.ip);
    next();
  } catch {
    res.status(429).json({ success: false, error: 'Rate limit exceeded. Please try again later.' });
  }
};

// Sanitize text input
const sanitizeText = (text) => {
  if (!text) return '';
  return String(text).replace(/<[^>]*>/g, '').trim();
};

const getProfileImage = (entity) => {
  if (!entity) return null;

  const profileData = entity.profile_data || entity.profileData || entity;
  const sources = [
    entity.profile_image,
    entity.profile_image_url,
    entity.profilePicture,
    entity.profile_picture,
    entity.avatar,
    profileData.profile_image,
    profileData.profile_image_url,
    profileData.profilePicture,
    profileData.profile_picture,
    profileData.avatar,
    Array.isArray(profileData.photos) && profileData.photos.length > 0 ? profileData.photos[0] : null
  ];

  for (const source of sources) {
    if (typeof source === 'string' && source.trim()) {
      return source.trim();
    }
    if (source && typeof source === 'object' && typeof source.url === 'string' && source.url.trim()) {
      return source.url.trim();
    }
  }

  return null;
};

// ========================================
// UNIFIED FEED - Merges content posts + service listings
// ========================================
router.get('/feed', async (req, res) => {
  try {
    const { category, type = 'all' } = req.query;
    const pg = safePagination(req.query.page, req.query.limit, 50);

    // Optional auth for personalization
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const jwt = require('jsonwebtoken');
      const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = payload.userId || payload.id || null;
      } catch (e) { /* ignore invalid token */ }
    }

    let feedItems = [];

    // Fetch content posts
    if (type === 'all' || type === 'posts') {
      const postQuery = { status: 'active' };
      if (category && category !== 'all') {
        postQuery.category = category;
      }

      const posts = await ContentPost.find(postQuery)
        .populate({ path: 'user_id', select: 'username profile_data verification_tier trust_score' })
        .sort({ engagement_score: -1, created_at: -1 })
        .skip(pg.skip)
        .limit(pg.limit)
        .lean();

      feedItems = posts.map(p => ({
        id: p._id,
        feedType: 'post',
        title: p.caption ? p.caption.substring(0, 50) : 'Post',
        description: p.caption || '',
        images: [p.media_url],
        media: [p.media_url],
        mediaType: p.media_type,
        category: p.category,
        price: p.price,
        tags: p.tags,
        location: p.location,
        likes_count: p.likes_count || 0,
        comments_count: p.comments_count || 0,
        views_count: p.views_count || 0,
        shares_count: p.shares_count || 0,
        bookmarks_count: p.bookmarks_count || 0,
        isLiked: currentUserId ? (p.liked_by || []).some(id => id.toString() === currentUserId) : false,
        isBookmarked: currentUserId ? (p.bookmarked_by || []).some(id => id.toString() === currentUserId) : false,
        provider: {
          id: p.user_id?._id,
          username: p.user_id?.username || p.username,
          profile_image: getProfileImage(p.user_id),
          verification_tier: p.user_id?.verification_tier || 0,
          trust_score: p.user_id?.trust_score || 0,
        },
        user_id: p.user_id?._id,
        linked_service_id: p.linked_service_id,
        created_at: p.created_at,
      }));
    }

    // Also fetch service listings for "all" or "services" type
    if (type === 'all' || type === 'services') {
      const svcQuery = { is_active: true };
      if (category && category !== 'all' && ['long-term', 'short-term', 'oral-services', 'special-services'].includes(category)) {
        svcQuery.category = category;
      }

      const services = await AdultService.find(svcQuery)
        .populate({ path: 'provider_id', select: 'username profile_data verification_tier trust_score' })
        .sort({ created_at: -1 })
        .skip(pg.skip)
        .limit(Math.ceil(pg.limit / 3)) // Mix ratio: ~70% posts, ~30% services
        .lean();

      const svcItems = services
        .filter(s => s.provider_id)
        .map(s => ({
          id: s._id,
          feedType: 'service',
          title: s.title || 'Service',
          description: s.description || '',
          images: s.images || [],
          media: s.images || [],
          mediaType: (s.images?.[0] && /\.(mp4|mov|webm)$/i.test(s.images[0])) ? 'video' : 'image',
          category: s.category,
          price: s.price,
          duration_minutes: s.duration_minutes,
          location: s.location_data?.city || s.location_data?.address || '',
          likes_count: 0,
          comments_count: 0,
          views_count: s.views || 0,
          shares_count: 0,
          bookmarks_count: 0,
          isLiked: false,
          isBookmarked: false,
          provider: {
            id: s.provider_id?._id,
            username: s.provider_id?.username,
            profile_image: getProfileImage(s.provider_id),
            verification_tier: s.provider_id?.verification_tier || 0,
            trust_score: s.provider_id?.trust_score || 0,
          },
          user_id: s.provider_id?._id,
          created_at: s.created_at,
        }));

      // Interleave services into posts
      if (type === 'all') {
        const merged = [];
        let pi = 0, si = 0;
        while (pi < feedItems.length || si < svcItems.length) {
          // Insert a service every 3 posts
          if (pi < feedItems.length) merged.push(feedItems[pi++]);
          if (pi < feedItems.length) merged.push(feedItems[pi++]);
          if (pi < feedItems.length) merged.push(feedItems[pi++]);
          if (si < svcItems.length) merged.push(svcItems[si++]);
        }
        feedItems = merged;
      } else {
        feedItems = svcItems;
      }
    }

    // Filter out current user's own content
    if (currentUserId) {
      feedItems = feedItems.filter(item => {
        const uid = item.user_id?.toString() || item.provider?.id?.toString();
        return uid !== currentUserId;
      });
    }

    res.json({
      success: true,
      services: feedItems, // Keep backward compat with old key name
      feed: feedItems,
      pagination: {
        page: pg.page,
        limit: pg.limit,
        hasMore: feedItems.length >= pg.limit
      }
    });
  } catch (error) {
    console.error('Unified feed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load feed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ========================================
// CREATE POST
// ========================================
const localStorage2 = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'content-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const ALLOWED_IMAGE_EXTS = /^\.(jpeg|jpg|png|gif|webp)$/;
const ALLOWED_VIDEO_EXTS = /^\.(mp4|avi|mov|wmv|flv|webm|mkv)$/;
const ALLOWED_IMAGE_MIMES = /^image\/(jpeg|png|gif|webp)$/;
const ALLOWED_VIDEO_MIMES = /^video\/(mp4|x-msvideo|quicktime|x-ms-wmv|x-flv|webm|x-matroska)$/;

const postUpload = multer({
  storage: localStorage2,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase();
    const mimetype = (file.mimetype || '').toLowerCase();
    const extImage = ALLOWED_IMAGE_EXTS.test(extname);
    const extVideo = ALLOWED_VIDEO_EXTS.test(extname);
    const mimeImage = ALLOWED_IMAGE_MIMES.test(mimetype);
    const mimeVideo = ALLOWED_VIDEO_MIMES.test(mimetype);
    if ((extImage && mimeImage) || (extVideo && mimeVideo)) return cb(null, true);
    cb(new Error('Only image and video files are allowed'));
  }
});

router.post('/posts', authMiddleware, rateLimit(postLimiter), postUpload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No media file uploaded' });
    }

    const userId = req.user.userId;
    const username = req.user.username;
    const { caption, category, price, location, tags } = req.body;

    const sanitizedCaption = sanitizeText(caption).substring(0, 2000);
    const sanitizedLocation = sanitizeText(location).substring(0, 200);
    const validCategories = ['showcase', 'promo', 'lifestyle', 'behind-scenes', 'announcement', 'long-term', 'short-term', 'oral-services', 'special-services'];
    const validCategory = validCategories.includes(category) ? category : 'showcase';
    const validPrice = Math.max(0, parseFloat(price) || 0);
    const parsedTags = tags ? (typeof tags === 'string' ? tags.split(',').map(t => sanitizeText(t).substring(0, 50)).filter(Boolean).slice(0, 10) : []) : [];

    const mimeType = req.file.mimetype;
    const isVideo = mimeType.startsWith('video/');
    let publicUrl = `/uploads/${req.file.filename}`;
    let storageType = 'local';
    let cloudinaryPublicId = null;

    // Try Cloudinary
    if (req.cloudinaryManager && req.cloudinaryManager.isConfigured) {
      try {
        const uploadOpts = {
          folder: 'zerohook/content',
          public_id: `post-${userId}-${Date.now()}`,
          resource_type: isVideo ? 'video' : 'image'
        };
        const result = isVideo
          ? await req.cloudinaryManager.uploadVideo(req.file.path, uploadOpts)
          : await req.cloudinaryManager.uploadImage(req.file.path, uploadOpts);
        if (result.success) {
          publicUrl = result.url;
          storageType = 'cloudinary';
          cloudinaryPublicId = result.publicId;
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        }
      } catch (e) {
        console.warn('Cloudinary upload failed, using local:', e.message);
      }
    }

    const post = await ContentPost.create({
      user_id: userId,
      username,
      media_url: publicUrl,
      media_type: isVideo ? 'video' : 'image',
      caption: sanitizedCaption,
      category: validCategory,
      price: validPrice,
      location: sanitizedLocation,
      tags: parsedTags,
      storage_type: storageType,
      cloudinary_public_id: cloudinaryPublicId,
      file_size: req.file.size
    });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      content: {
        id: post._id,
        url: publicUrl,
        mediaType: post.media_type,
        caption: post.caption,
        category: post.category,
        price: post.price,
        location: post.location,
        tags: post.tags,
        userId,
        username,
        createdAt: post.created_at
      }
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create post',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ========================================
// GET SINGLE POST
// ========================================
router.get('/posts/:postId', async (req, res) => {
  try {
    const v = validateObjectId(req.params.postId, 'Post ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });

    const post = await ContentPost.findById(req.params.postId)
      .populate({ path: 'user_id', select: 'username profile_data verification_tier trust_score' })
      .lean();
    if (!post || post.status === 'removed') {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch post' });
  }
});

// ========================================
// DELETE POST (owner only)
// ========================================
router.delete('/posts/:postId', authMiddleware, async (req, res) => {
  try {
    const v = validateObjectId(req.params.postId, 'Post ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });

    const post = await ContentPost.findOneAndUpdate(
      { _id: req.params.postId, user_id: req.user.userId },
      { $set: { status: 'removed' } },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, error: 'Post not found or access denied' });
    // Clean up comments
    await Comment.updateMany({ post_id: post._id }, { $set: { status: 'removed' } });
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

// ========================================
// LIKE / UNLIKE POST
// ========================================
router.post('/posts/:postId/like', authMiddleware, rateLimit(likeLimiter), async (req, res) => {
  try {
    const { postId } = req.params;
    const v = validateObjectId(postId, 'Post ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const userId = req.user.userId;

    // Try to add like
    const addResult = await ContentPost.findOneAndUpdate(
      { _id: postId, status: 'active', liked_by: { $ne: userId } },
      { $addToSet: { liked_by: userId }, $inc: { likes_count: 1 } },
      { new: true }
    );

    if (addResult) {
      // Update engagement score
      await ContentPost.findByIdAndUpdate(postId, {
        $set: { engagement_score: (addResult.likes_count * 3) + (addResult.comments_count * 5) + (addResult.shares_count * 7) + addResult.views_count }
      });
      // Send notification (non-blocking)
      if (addResult.user_id.toString() !== userId) {
        Notification.create({
          user_id: addResult.user_id,
          type: 'like',
          title: 'New Like',
          message: `${req.user.username || 'Someone'} liked your post`,
          data: { postId, likerId: userId }
        }).catch(() => {});
      }
      return res.json({ success: true, liked: true, likes_count: addResult.likes_count });
    }

    // Already liked -> unlike
    const removeResult = await ContentPost.findOneAndUpdate(
      { _id: postId, liked_by: userId },
      { $pull: { liked_by: userId }, $inc: { likes_count: -1 } },
      { new: true }
    );

    if (!removeResult) return res.status(404).json({ success: false, error: 'Post not found' });

    await ContentPost.findByIdAndUpdate(postId, {
      $set: { engagement_score: Math.max(0, (removeResult.likes_count * 3) + (removeResult.comments_count * 5) + (removeResult.shares_count * 7) + removeResult.views_count) }
    });

    res.json({ success: true, liked: false, likes_count: removeResult.likes_count });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to like post' });
  }
});

// ========================================
// BOOKMARK / UNBOOKMARK
// ========================================
router.post('/posts/:postId/bookmark', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params;
    const v = validateObjectId(postId, 'Post ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const userId = req.user.userId;

    const existing = await Bookmark.findOne({ user_id: userId, post_id: postId });
    if (existing) {
      await Bookmark.deleteOne({ _id: existing._id });
      await ContentPost.findByIdAndUpdate(postId, {
        $pull: { bookmarked_by: userId },
        $inc: { bookmarks_count: -1 }
      });
      return res.json({ success: true, bookmarked: false });
    }

    await Bookmark.create({ user_id: userId, post_id: postId });
    await ContentPost.findByIdAndUpdate(postId, {
      $addToSet: { bookmarked_by: userId },
      $inc: { bookmarks_count: 1 }
    });
    res.json({ success: true, bookmarked: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to bookmark' });
  }
});

// GET BOOKMARKS
router.get('/bookmarks', authMiddleware, async (req, res) => {
  try {
    const pg = safePagination(req.query.page, req.query.limit);
    const bookmarks = await Bookmark.find({ user_id: req.user.userId })
      .sort({ created_at: -1 })
      .skip(pg.skip)
      .limit(pg.limit)
      .populate({
        path: 'post_id',
        populate: { path: 'user_id', select: 'username profile_data verification_tier' }
      })
      .lean();

    const posts = bookmarks
      .filter(b => b.post_id && b.post_id.status === 'active')
      .map(b => b.post_id);

    res.json({ success: true, posts, pagination: { page: pg.page, limit: pg.limit } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch bookmarks' });
  }
});

// ========================================
// VIEW COUNT
// ========================================
router.post('/posts/:postId/view', async (req, res) => {
  try {
    const v = validateObjectId(req.params.postId, 'Post ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });

    const result = await ContentPost.findByIdAndUpdate(
      req.params.postId,
      { $inc: { views_count: 1 } },
      { new: true }
    );
    if (!result) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, views_count: result.views_count });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record view' });
  }
});

// ========================================
// COMMENTS
// ========================================
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const v = validateObjectId(req.params.postId, 'Post ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const pg = safePagination(req.query.page, req.query.limit);

    const comments = await Comment.find({ post_id: req.params.postId, status: 'active', parent_id: null })
      .populate({ path: 'user_id', select: 'username profile_data verification_tier' })
      .sort({ created_at: -1 })
      .skip(pg.skip)
      .limit(pg.limit)
      .lean();

    const total = await Comment.countDocuments({ post_id: req.params.postId, status: 'active', parent_id: null });

    // Get reply counts
    const commentIds = comments.map(c => c._id);
    const replyCounts = await Comment.aggregate([
      { $match: { parent_id: { $in: commentIds }, status: 'active' } },
      { $group: { _id: '$parent_id', count: { $sum: 1 } } }
    ]);
    const replyMap = {};
    replyCounts.forEach(r => { replyMap[r._id.toString()] = r.count; });

    const enrichedComments = comments.map(c => ({
      ...c,
      reply_count: replyMap[c._id.toString()] || 0,
      user_avatar: getProfileImage(c.user_id)
    }));

    res.json({ success: true, comments: enrichedComments, total, pagination: { page: pg.page, limit: pg.limit } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch comments' });
  }
});

// GET REPLIES
router.get('/comments/:commentId/replies', async (req, res) => {
  try {
    const v = validateObjectId(req.params.commentId, 'Comment ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });

    const replies = await Comment.find({ parent_id: req.params.commentId, status: 'active' })
      .populate({ path: 'user_id', select: 'username profile_data verification_tier' })
      .sort({ created_at: 1 })
      .limit(50)
      .lean();
    res.json({ success: true, replies });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch replies' });
  }
});

// CREATE COMMENT
router.post('/posts/:postId/comments', authMiddleware, rateLimit(commentLimiter), async (req, res) => {
  try {
    const v = validateObjectId(req.params.postId, 'Post ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });

    const { text, parentId } = req.body;
    const sanitizedText = sanitizeText(text);
    if (!sanitizedText || sanitizedText.length === 0) {
      return res.status(400).json({ success: false, error: 'Comment text is required' });
    }
    if (sanitizedText.length > 1000) {
      return res.status(400).json({ success: false, error: 'Comment too long (max 1000 chars)' });
    }

    const post = await ContentPost.findById(req.params.postId);
    if (!post || post.status !== 'active') {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Validate parent comment if replying
    if (parentId) {
      const parent = await Comment.findById(parentId);
      if (!parent || parent.post_id.toString() !== req.params.postId) {
        return res.status(400).json({ success: false, error: 'Invalid parent comment' });
      }
    }

    const comment = await Comment.create({
      post_id: req.params.postId,
      user_id: req.user.userId,
      username: req.user.username,
      text: sanitizedText,
      parent_id: parentId || null
    });

    // Increment comment count
    await ContentPost.findByIdAndUpdate(req.params.postId, { $inc: { comments_count: 1 } });

    // Notification
    if (post.user_id.toString() !== req.user.userId) {
      Notification.create({
        user_id: post.user_id,
        type: 'comment',
        title: 'New Comment',
        message: `${req.user.username || 'Someone'} commented: "${sanitizedText.substring(0, 50)}"`,
        data: { postId: req.params.postId, commentId: comment._id }
      }).catch(() => {});
    }

    // Populate user info for response
    const populated = await Comment.findById(comment._id)
      .populate({ path: 'user_id', select: 'username profile_data verification_tier' })
      .lean();

    res.status(201).json({ success: true, comment: populated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
});

// DELETE COMMENT (owner only)
router.delete('/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const v = validateObjectId(req.params.commentId, 'Comment ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });

    const comment = await Comment.findOneAndUpdate(
      { _id: req.params.commentId, user_id: req.user.userId },
      { $set: { status: 'removed' } },
      { new: true }
    );
    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });
    await ContentPost.findByIdAndUpdate(comment.post_id, { $inc: { comments_count: -1 } });
    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

// LIKE COMMENT
router.post('/comments/:commentId/like', authMiddleware, rateLimit(likeLimiter), async (req, res) => {
  try {
    const { commentId } = req.params;
    const v = validateObjectId(commentId, 'Comment ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const userId = req.user.userId;
    const added = await Comment.findOneAndUpdate(
      { _id: commentId, liked_by: { $ne: userId } },
      { $addToSet: { liked_by: userId }, $inc: { likes_count: 1 } },
      { new: true }
    );
    if (added) return res.json({ success: true, liked: true, likes_count: added.likes_count });

    const removed = await Comment.findOneAndUpdate(
      { _id: commentId, liked_by: userId },
      { $pull: { liked_by: userId }, $inc: { likes_count: -1 } },
      { new: true }
    );
    if (!removed) return res.status(404).json({ success: false, error: 'Comment not found' });
    res.json({ success: true, liked: false, likes_count: removed.likes_count });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to like comment' });
  }
});

// ========================================
// FOLLOW SYSTEM
// ========================================
router.post('/follow/:userId', authMiddleware, async (req, res) => {
  try {
    const v = validateObjectId(req.params.userId, 'User ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const followingId = req.params.userId;
    const followerId = req.user.userId;
    if (followerId === followingId) {
      return res.status(400).json({ success: false, error: 'Cannot follow yourself' });
    }

    const existing = await Follow.findOne({ follower_id: followerId, following_id: followingId });
    if (existing) {
      await Follow.deleteOne({ _id: existing._id });
      return res.json({ success: true, following: false });
    }

    await Follow.create({ follower_id: followerId, following_id: followingId });

    // Notification
    Notification.create({
      user_id: followingId,
      type: 'follow',
      title: 'New Follower',
      message: `${req.user.username || 'Someone'} started following you`,
      data: { followerId }
    }).catch(() => {});

    res.json({ success: true, following: true });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate - already following, so unfollow
      await Follow.deleteOne({ follower_id: req.user.userId, following_id: req.params.userId });
      return res.json({ success: true, following: false });
    }
    res.status(500).json({ success: false, error: 'Failed to follow user' });
  }
});

// GET FOLLOWERS
router.get('/followers/:userId', async (req, res) => {
  try {
    const v = validateObjectId(req.params.userId, 'User ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const pg = safePagination(req.query.page, req.query.limit);
    const followers = await Follow.find({ following_id: req.params.userId, status: 'active' })
      .populate({ path: 'follower_id', select: 'username profile_data verification_tier' })
      .sort({ created_at: -1 })
      .skip(pg.skip)
      .limit(pg.limit)
      .lean();
    const total = await Follow.countDocuments({ following_id: req.params.userId, status: 'active' });
    res.json({ success: true, followers: followers.map(f => f.follower_id), total });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch followers' });
  }
});

// GET FOLLOWING
router.get('/following/:userId', async (req, res) => {
  try {
    const v = validateObjectId(req.params.userId, 'User ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const pg = safePagination(req.query.page, req.query.limit);
    const following = await Follow.find({ follower_id: req.params.userId, status: 'active' })
      .populate({ path: 'following_id', select: 'username profile_data verification_tier' })
      .sort({ created_at: -1 })
      .skip(pg.skip)
      .limit(pg.limit)
      .lean();
    const total = await Follow.countDocuments({ follower_id: req.params.userId, status: 'active' });
    res.json({ success: true, following: following.map(f => f.following_id), total });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch following' });
  }
});

// CHECK FOLLOW STATUS
router.get('/follow-status/:userId', authMiddleware, async (req, res) => {
  try {
    const v = validateObjectId(req.params.userId, 'User ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const exists = await Follow.findOne({ follower_id: req.user.userId, following_id: req.params.userId, status: 'active' });
    res.json({ success: true, following: !!exists });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check follow status' });
  }
});

// ========================================
// USER PROFILE POSTS
// ========================================
router.get('/user/:userId/posts', async (req, res) => {
  try {
    const v = validateObjectId(req.params.userId, 'User ID');
    if (!v.valid) return res.status(400).json({ success: false, error: `Invalid ${v.label}` });
    const pg = safePagination(req.query.page, req.query.limit);
    const posts = await ContentPost.find({ user_id: req.params.userId, status: 'active' })
      .sort({ created_at: -1 })
      .skip(pg.skip)
      .limit(pg.limit)
      .lean();
    const total = await ContentPost.countDocuments({ user_id: req.params.userId, status: 'active' });

    // Get follower/following counts
    const [followerCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following_id: req.params.userId, status: 'active' }),
      Follow.countDocuments({ follower_id: req.params.userId, status: 'active' })
    ]);

    res.json({
      success: true,
      posts,
      total,
      stats: { followerCount, followingCount, postCount: total },
      pagination: { page: pg.page, limit: pg.limit }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch user posts' });
  }
});

// ========================================
// REPORT POST
// ========================================
router.post('/posts/:postId/report', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.user.userId;
    const post = await ContentPost.findOneAndUpdate(
      { _id: req.params.postId, reported_by: { $ne: userId } },
      {
        $addToSet: { reported_by: userId },
        $inc: { reported_count: 1 }
      },
      { new: true }
    );
    if (!post) return res.status(404).json({ success: false, error: 'Post not found or already reported' });

    // Auto-flag if 3+ reports
    if (post.reported_count >= 3) {
      await ContentPost.findByIdAndUpdate(post._id, { $set: { status: 'flagged' } });
    }

    res.json({ success: true, message: 'Post reported. Our team will review it.' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to report post' });
  }
});

// ========================================
// SEARCH POSTS
// ========================================
router.get('/search', async (req, res) => {
  try {
    const { q, category } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Search query too short' });
    }
    const pg = safePagination(req.query.page, req.query.limit);
    const safeQuery = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const query = {
      status: 'active',
      $or: [
        { caption: { $regex: safeQuery, $options: 'i' } },
        { tags: { $regex: safeQuery, $options: 'i' } },
        { username: { $regex: safeQuery, $options: 'i' } },
        { location: { $regex: safeQuery, $options: 'i' } }
      ]
    };
    if (category && category !== 'all') query.category = category;

    const [posts, total] = await Promise.all([
      ContentPost.find(query)
        .populate({ path: 'user_id', select: 'username profile_data verification_tier' })
        .sort({ engagement_score: -1, created_at: -1 })
        .skip(pg.skip)
        .limit(pg.limit)
        .lean(),
      ContentPost.countDocuments(query)
    ]);

    res.json({ success: true, posts, total, pagination: { page: pg.page, limit: pg.limit } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

module.exports = router;
