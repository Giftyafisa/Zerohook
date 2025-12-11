const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
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
      await query(`
        INSERT INTO file_uploads (user_id, file_name, file_path, file_size, mime_type, upload_type, storage_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [req.user.userId, filename || req.file.public_id, publicUrl, size, mimetype, 'chat_attachment', isCloudinary ? 'cloudinary' : 'local']);
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
    
    // Update user's profile_data with new profile picture
    // Update ALL three image fields for consistency:
    // 1. profile_picture (object with metadata) - new standard
    // 2. photos (array) - used by imageUtils.js first
    // 3. profilePicture (string) - legacy field
    const updateResult = await query(`
      UPDATE users 
      SET profile_data = jsonb_set(
        jsonb_set(
          jsonb_set(
            COALESCE(profile_data, '{}'::jsonb), 
            '{profile_picture}', 
            $1::jsonb
          ),
          '{photos}',
          $2::jsonb
        ),
        '{profilePicture}',
        $3::jsonb
      )
      WHERE id = $4
      RETURNING profile_data
    `, [
      JSON.stringify({ 
        url: publicUrl, 
        filename: fileName, 
        fileSize, 
        mimeType, 
        fileType,
        storageType: isCloudinary ? 'cloudinary' : 'local',
        publicId: req.file.public_id || null
      }),
      JSON.stringify([publicUrl]), // Set as single-element array
      JSON.stringify(publicUrl), // Also update legacy string field
      userId
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log file upload to file_uploads table
    try {
      await query(`
        INSERT INTO file_uploads (user_id, file_name, file_path, file_size, mime_type, upload_type, storage_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, fileName, publicUrl, fileSize, mimeType, 'profile_picture', isCloudinary ? 'cloudinary' : 'local']);
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
      
      // Log file upload to file_uploads table
      try {
        await query(`
          INSERT INTO file_uploads (user_id, service_id, file_name, file_path, file_size, mime_type, upload_type, storage_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [userId, serviceId, fileName, publicUrl, fileSize, mimeType, 'service_media', storageType]);
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
    
    // Log video upload to file_uploads table
    await query(`
      INSERT INTO file_uploads (user_id, file_name, file_path, file_size, mime_type, upload_type)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, fileName, filePath, fileSize, mimeType, 'user_video']);
    
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
    
    const files = await query(`
      SELECT id, file_name, file_path, file_size, mime_type, upload_type, created_at
      FROM file_uploads
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `, [userId]);
    
    const processedFiles = files.rows.map(file => ({
      id: file.id,
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
    const fileResult = await query(`
      SELECT file_path, file_name FROM file_uploads 
      WHERE id = $1 AND user_id = $2 AND status = 'active'
    `, [fileId, userId]);
    
    if (fileResult.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }
    
    const filePath = fileResult.rows[0].file_path;
    
    // Delete physical file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Mark as deleted in database
    await query(`
      UPDATE file_uploads SET status = 'deleted' WHERE id = $1
    `, [fileId]);
    
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

module.exports = router;
