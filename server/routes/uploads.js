const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('./auth');
const { User, FileUpload } = require('../config/database');
const router = express.Router();

// Configure multer for local file uploads (fallback)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Enhanced file filter for images and videos
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
  
  const extname = path.extname(file.originalname).toLowerCase();
  const isImage = allowedImageTypes.test(extname);
  const isVideo = allowedVideoTypes.test(extname);
  
  if (isImage || isVideo) {
    return cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'));
  }
};

// Dynamic upload middleware that uses Cloudinary if available
const getUploadMiddleware = (type = 'profile') => {
  return (req, res, next) => {
    let storage;
    
    // Check if Cloudinary is configured
    if (req.cloudinaryManager && req.cloudinaryManager.isConfigured) {
      switch (type) {
        case 'profile':
          storage = req.cloudinaryManager.getProfileStorage();
          break;
        case 'service':
          storage = req.cloudinaryManager.getServiceStorage();
          break;
        case 'chat':
          storage = req.cloudinaryManager.getChatStorage();
          break;
        case 'verification':
          storage = req.cloudinaryManager.getVerificationStorage();
          break;
        default:
          storage = req.cloudinaryManager.getProfileStorage();
      }
    } else {
      // Fallback to local storage
      storage = localStorage;
    }
    
    const upload = multer({
      storage: storage,
      limits: {
        fileSize: type === 'chat' ? 50 * 1024 * 1024 : 10 * 1024 * 1024, // 50MB for chat, 10MB for others
      },
      fileFilter: fileFilter
    });
    
    return upload.single(type === 'profile' ? 'profilePicture' : (type === 'chat' ? 'file' : 'media'))(req, res, next);
  };
};

// Helper to get file URL (Cloudinary or local)
const getFileUrl = (file, cloudinaryManager) => {
  // Cloudinary upload returns path as the full URL
  if (file.path && file.path.includes('cloudinary.com')) {
    return file.path;
  }
  // Local upload
  return `/uploads/${file.filename}`;
};

// Chat attachment upload endpoint (image/video/file) - uses Cloudinary if available
router.post('/chat-attachment', authMiddleware, (req, res, next) => {
  getUploadMiddleware('chat')(req, res, next);
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { filename, size, mimetype } = req.file;
    const isVideo = mimetype?.startsWith('video/');
    const isImage = mimetype?.startsWith('image/');
    const fileType = isVideo ? 'video' : (isImage ? 'image' : 'file');
    
    // Get URL - Cloudinary path is the full URL, local is relative
    const publicUrl = getFileUrl(req.file, req.cloudinaryManager);
    const isCloudinary = publicUrl.includes('cloudinary.com');

    // Optional: log uploads for auditing
    try {
      await FileUpload.create({
        user_id: req.user.userId,
        file_name: filename || req.file.public_id,
        file_path: publicUrl,
        file_size: size,
        mime_type: mimetype,
        upload_type: 'chat_attachment',
        storage_type: isCloudinary ? 'cloudinary' : 'local'
      });
    } catch (logErr) {
      console.warn('Chat attachment log failed:', logErr.message);
    }

    res.json({
      success: true,
      url: publicUrl,
      fileType,
      filename: filename || req.file.public_id,
      size,
      mimeType: mimetype,
      storageType: isCloudinary ? 'cloudinary' : 'local'
    });
  } catch (error) {
    console.error('Chat attachment upload error:', error);
    res.status(500).json({
      error: 'Failed to upload attachment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Profile picture upload endpoint - uses Cloudinary if available
router.post('/profile-picture', authMiddleware, (req, res, next) => {
  getUploadMiddleware('profile')(req, res, next);
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.userId;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    
    // Get URL - Cloudinary path is the full URL, local is relative
    const publicUrl = getFileUrl(req.file, req.cloudinaryManager);
    const isCloudinary = publicUrl.includes('cloudinary.com');
    const fileName = req.file.filename || req.file.public_id || `profile-${userId}-${Date.now()}`;
    
    // Determine file type
    const isVideo = mimeType?.startsWith('video/');
    const fileType = isVideo ? 'video' : 'image';
    
    // Update user's profile_data with new profile picture using MongoDB
    const profilePictureData = { 
      url: publicUrl, 
      filename: fileName, 
      fileSize, 
      mimeType, 
      fileType,
      storageType: isCloudinary ? 'cloudinary' : 'local',
      publicId: req.file.public_id || null
    };
    
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'profile_data.profile_picture': profilePictureData,
          'profile_data.photos': [publicUrl],
          'profile_data.profilePicture': publicUrl
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log file upload to file_uploads collection
    try {
      await FileUpload.create({
        user_id: userId,
        file_name: fileName,
        file_path: publicUrl,
        file_size: fileSize,
        mime_type: mimeType,
        upload_type: 'profile_picture',
        storage_type: isCloudinary ? 'cloudinary' : 'local'
      });
    } catch (logErr) {
      console.warn('Profile picture log failed:', logErr.message);
    }

    console.log(`✅ Profile picture uploaded for user ${userId}: ${publicUrl} (${isCloudinary ? 'Cloudinary' : 'Local'})`);

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: {
        url: publicUrl,
        filename: fileName,
        fileSize,
        mimeType,
        fileType,
        storageType: isCloudinary ? 'cloudinary' : 'local'
      }
    });

  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({
      error: 'Failed to upload profile picture',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Service media upload endpoint (multiple files) - uses local storage for now
// TODO: Update to use Cloudinary for multiple file uploads
const serviceUpload = multer({
  storage: localStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: fileFilter
});

router.post('/service-media', authMiddleware, serviceUpload.array('media', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const userId = req.user.userId;
    const { serviceId } = req.body;
    
    if (!serviceId) {
      return res.status(400).json({ error: 'Service ID is required' });
    }

    const uploadedFiles = [];
    
    for (const file of req.files) {
      const fileName = file.filename;
      const filePath = file.path;
      const fileSize = file.size;
      const mimeType = file.mimetype;
      const isVideo = mimeType?.startsWith('video/');
      const fileType = isVideo ? 'video' : 'image';
      
      // If Cloudinary is configured, upload there as well
      let publicUrl = `/uploads/${fileName}`;
      let storageType = 'local';
      
      if (req.cloudinaryManager && req.cloudinaryManager.isConfigured && !isVideo) {
        try {
          const cloudResult = await req.cloudinaryManager.uploadImage(filePath, {
            folder: 'zerohook/services',
            public_id: `service-${serviceId}-${Date.now()}-${Math.random().toString(36).substring(7)}`
          });
          if (cloudResult.success) {
            publicUrl = cloudResult.url;
            storageType = 'cloudinary';
          }
        } catch (cloudErr) {
          console.warn('Cloudinary upload failed, using local:', cloudErr.message);
        }
      }
      
      // Log file upload to file_uploads collection
      try {
        await FileUpload.create({
          user_id: userId,
          service_id: serviceId,
          file_name: fileName,
          file_path: publicUrl,
          file_size: fileSize,
          mime_type: mimeType,
          upload_type: 'service_media',
          storage_type: storageType
        });
      } catch (logErr) {
        console.warn('Service media log failed:', logErr.message);
      }
      
      uploadedFiles.push({
        id: fileName,
        fileName,
        url: publicUrl,
        fileSize,
        mimeType,
        fileType,
        storageType
      });
    }

    res.json({
      success: true,
      message: 'Service media uploaded successfully',
      files: uploadedFiles,
      totalUploaded: uploadedFiles.length
    });

  } catch (error) {
    console.error('Service media upload error:', error);
    res.status(500).json({
      error: 'Failed to upload service media',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Video upload endpoint for user videos - uses local storage (videos are large)
const videoUpload = multer({
  storage: localStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype?.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  }
});

router.post('/user-video', authMiddleware, videoUpload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video uploaded' });
    }

    const userId = req.user.userId;
    const fileName = req.file.filename;
    const filePath = req.file.path;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    
    if (!mimeType.startsWith('video/')) {
      return res.status(400).json({ error: 'Only video files are allowed' });
    }
    
    const publicUrl = `/uploads/${fileName}`;
    
    // Log video upload to file_uploads collection
    await FileUpload.create({
      user_id: userId,
      file_name: fileName,
      file_path: filePath,
      file_size: fileSize,
      mime_type: mimeType,
      upload_type: 'user_video'
    });
    
    res.json({
      success: true,
      message: 'Video uploaded successfully',
      video: {
        url: publicUrl,
        filename: fileName,
        fileSize,
        mimeType
      }
    });

  } catch (error) {
    console.error('Video upload error:', error);
    res.status(500).json({
      error: 'Failed to upload video',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user's uploaded files
router.get('/user-files', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const files = await FileUpload.find({
      user_id: userId,
      status: 'active'
    }).sort({ created_at: -1 });
    
    const processedFiles = files.map(file => ({
      id: file._id,
      fileName: file.file_name,
      url: `/uploads/${file.file_name}`,
      fileSize: file.file_size,
      mimeType: file.mime_type,
      uploadType: file.upload_type,
      createdAt: file.created_at
    }));
    
    res.json({
      success: true,
      files: processedFiles
    });

  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({
      error: 'Failed to fetch user files',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete uploaded file
router.delete('/:fileId', authMiddleware, async (req, res) => {
  try {
    const { fileId } = req.params;
    const userId = req.user.userId;
    
    // Get file info and verify ownership
    const file = await FileUpload.findOne({
      _id: fileId,
      user_id: userId,
      status: 'active'
    });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }
    
    const filePath = file.file_path;
    
    // Delete physical file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Mark as deleted in database
    await FileUpload.findByIdAndUpdate(fileId, { status: 'deleted' });
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      error: 'Failed to delete file',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../uploads', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// ===========================================
// CONTENT UPLOAD - TikTok-style posts
// ===========================================

// Content post upload (image/video with metadata)
const contentUpload = multer({
  storage: localStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for videos
  fileFilter: fileFilter
});

router.post('/content', authMiddleware, contentUpload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file uploaded' });
    }

    const userId = req.user.userId;
    const username = req.user.username;
    const { caption, category, price, location, contentType } = req.body;
    
    const fileName = req.file.filename;
    const filePath = req.file.path;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    const isVideo = contentType === 'video' || mimeType?.startsWith('video/');
    
    let publicUrl = `/uploads/${fileName}`;
    let storageType = 'local';
    let cloudinaryPublicId = null;

    // Try Cloudinary upload for images (and small videos)
    if (req.cloudinaryManager && req.cloudinaryManager.isConfigured) {
      try {
        if (!isVideo || fileSize < 20 * 1024 * 1024) { // Upload to Cloudinary if image or video < 20MB
          const uploadOptions = {
            folder: 'zerohook/content',
            public_id: `content-${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            resource_type: isVideo ? 'video' : 'image'
          };
          
          const cloudResult = isVideo
            ? await req.cloudinaryManager.uploadVideo(filePath, uploadOptions)
            : await req.cloudinaryManager.uploadImage(filePath, uploadOptions);
            
          if (cloudResult.success) {
            publicUrl = cloudResult.url;
            storageType = 'cloudinary';
            cloudinaryPublicId = cloudResult.publicId;
            
            // Delete local file after successful Cloudinary upload
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
        }
      } catch (cloudErr) {
        console.warn('Cloudinary upload failed, using local storage:', cloudErr.message);
      }
    }

    // Create content record with full metadata
    const contentData = {
      user_id: userId,
      username: username,
      file_name: fileName,
      file_path: publicUrl,
      file_size: fileSize,
      mime_type: mimeType,
      upload_type: 'content_post',
      storage_type: storageType,
      cloudinary_public_id: cloudinaryPublicId,
      metadata: {
        caption: caption || '',
        category: category || 'showcase',
        price: parseFloat(price) || 0,
        location: location || '',
        contentType: isVideo ? 'video' : 'image',
        views: 0,
        likes: 0,
        shares: 0
      }
    };

    const fileRecord = await FileUpload.create(contentData);

    console.log(`✅ Content post uploaded by ${username}: ${publicUrl} (${storageType})`);

    res.json({
      success: true,
      message: 'Content uploaded successfully',
      content: {
        id: fileRecord._id,
        url: publicUrl,
        filename: fileName,
        fileSize,
        mimeType,
        contentType: isVideo ? 'video' : 'image',
        storageType,
        caption: caption || '',
        category: category || 'showcase',
        price: parseFloat(price) || 0,
        location: location || '',
        userId,
        username,
        createdAt: fileRecord.created_at
      }
    });

  } catch (error) {
    console.error('Content upload error:', error);
    res.status(500).json({
      error: 'Failed to upload content',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get content feed (public posts)
router.get('/content/feed', async (req, res) => {
  try {
    const { page = 1, limit = 10, category } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      upload_type: 'content_post',
      status: 'active'
    };

    if (category && category !== 'all') {
      query['metadata.category'] = category;
    }

    const content = await FileUpload.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FileUpload.countDocuments(query);

    // Get user info for each post
    const contentWithUsers = await Promise.all(
      content.map(async (post) => {
        try {
          const user = await User.findById(post.user_id).select('username profile_data');
          return {
            id: post._id,
            url: post.file_path,
            contentType: post.metadata?.contentType || 'image',
            caption: post.metadata?.caption || '',
            category: post.metadata?.category || 'showcase',
            price: post.metadata?.price || 0,
            location: post.metadata?.location || '',
            views: post.metadata?.views || 0,
            likes: post.metadata?.likes || 0,
            shares: post.metadata?.shares || 0,
            userId: post.user_id,
            username: post.username || user?.username || 'Anonymous',
            userAvatar: user?.profile_data?.profilePicture || user?.profile_data?.photos?.[0] || null,
            createdAt: post.created_at,
            storageType: post.storage_type
          };
        } catch (err) {
          return {
            id: post._id,
            url: post.file_path,
            contentType: post.metadata?.contentType || 'image',
            caption: post.metadata?.caption || '',
            category: post.metadata?.category || 'showcase',
            price: post.metadata?.price || 0,
            location: post.metadata?.location || '',
            views: post.metadata?.views || 0,
            likes: post.metadata?.likes || 0,
            shares: post.metadata?.shares || 0,
            userId: post.user_id,
            username: post.username || 'Anonymous',
            userAvatar: null,
            createdAt: post.created_at,
            storageType: post.storage_type
          };
        }
      })
    );

    res.json({
      success: true,
      content: contentWithUsers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Content feed error:', error);
    res.status(500).json({
      error: 'Failed to fetch content feed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user's own content
router.get('/content/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const content = await FileUpload.find({
      user_id: userId,
      upload_type: 'content_post',
      status: 'active'
    })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await FileUpload.countDocuments({
      user_id: userId,
      upload_type: 'content_post',
      status: 'active'
    });

    const contentList = content.map(post => ({
      id: post._id,
      url: post.file_path,
      contentType: post.metadata?.contentType || 'image',
      caption: post.metadata?.caption || '',
      category: post.metadata?.category || 'showcase',
      price: post.metadata?.price || 0,
      location: post.metadata?.location || '',
      views: post.metadata?.views || 0,
      likes: post.metadata?.likes || 0,
      shares: post.metadata?.shares || 0,
      createdAt: post.created_at,
      storageType: post.storage_type
    }));

    res.json({
      success: true,
      content: contentList,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('My content error:', error);
    res.status(500).json({
      error: 'Failed to fetch your content',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Like/unlike content
router.post('/content/:contentId/like', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.userId;

    const content = await FileUpload.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Toggle like (simple implementation - in production use a separate likes collection)
    const currentLikes = content.metadata?.likes || 0;
    const newLikes = currentLikes + 1; // For simplicity, just increment

    await FileUpload.findByIdAndUpdate(contentId, {
      'metadata.likes': newLikes
    });

    res.json({
      success: true,
      likes: newLikes
    });

  } catch (error) {
    console.error('Like content error:', error);
    res.status(500).json({
      error: 'Failed to like content',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Increment view count
router.post('/content/:contentId/view', async (req, res) => {
  try {
    const { contentId } = req.params;

    const content = await FileUpload.findById(contentId);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const currentViews = content.metadata?.views || 0;
    await FileUpload.findByIdAndUpdate(contentId, {
      'metadata.views': currentViews + 1
    });

    res.json({
      success: true,
      views: currentViews + 1
    });

  } catch (error) {
    console.error('View content error:', error);
    res.status(500).json({ error: 'Failed to record view' });
  }
});

module.exports = router;
