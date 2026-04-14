const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('./auth');
const { User, FileUpload } = require('../config/database');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const { safePagination } = require('../utils/routeHelpers');
const router = express.Router();

// Per-user upload rate limiters
// Profile pictures: 5 per 15 minutes per user
const profileUploadLimiter = new RateLimiterMemory({ points: 5, duration: 900 });
// Service media (multi-file): 20 files per 15 minutes per user
const serviceUploadLimiter = new RateLimiterMemory({ points: 20, duration: 900 });
// Chat attachments: 30 per 15 minutes per user
const chatUploadLimiter = new RateLimiterMemory({ points: 30, duration: 900 });
// Video uploads: 3 per 15 minutes per user
const videoUploadLimiter = new RateLimiterMemory({ points: 3, duration: 900 });

// Factory for rate limit middleware keyed by userId
const uploadRateLimit = (limiter, fileCountFromReq) => async (req, res, next) => {
  try {
    const userId = req.user?.userId || req.ip;
    const count = typeof fileCountFromReq === 'function' ? fileCountFromReq(req) : 1;
    await limiter.consume(userId, count);
    next();
  } catch {
    res.status(429).json({ success: false, error: 'Upload rate limit exceeded. Please try again later.' });
  }
};

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

// Enhanced file filter for images and videos with MIME type validation
const ALLOWED_IMAGE_EXTS = /^\.(jpeg|jpg|png|gif|webp)$/;
const ALLOWED_VIDEO_EXTS = /^\.(mp4|avi|mov|wmv|flv|webm|mkv)$/;
const ALLOWED_IMAGE_MIMES = /^image\/(jpeg|png|gif|webp)$/;
const ALLOWED_VIDEO_MIMES = /^video\/(mp4|x-msvideo|quicktime|x-ms-wmv|x-flv|webm|x-matroska)$/;

const fileFilter = (req, file, cb) => {
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();
  
  const extImage = ALLOWED_IMAGE_EXTS.test(extname);
  const extVideo = ALLOWED_VIDEO_EXTS.test(extname);
  const mimeImage = ALLOWED_IMAGE_MIMES.test(mimetype);
  const mimeVideo = ALLOWED_VIDEO_MIMES.test(mimetype);
  
  // Both extension AND MIME type must match the same category
  if ((extImage && mimeImage) || (extVideo && mimeVideo)) {
    return cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed! Extension and content type must match.'));
  }
};

// Magic-byte validation for uploaded files (post-upload verification)
// Checks actual file content signatures to prevent MIME-spoofing attacks
const MAGIC_BYTES = {
  // Images
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png':  [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/gif':  [Buffer.from('GIF87a'), Buffer.from('GIF89a')],
  'image/webp': [Buffer.from('RIFF')], // RIFF....WEBP (check first 4 bytes + offset 8)
  // Videos
  'video/mp4':           [Buffer.from([0x00, 0x00, 0x00]), Buffer.from('ftyp')], // offset 4
  'video/quicktime':     [Buffer.from([0x00, 0x00, 0x00]), Buffer.from('ftyp')],
  'video/x-msvideo':     [Buffer.from('RIFF')],
  'video/webm':          [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
  'video/x-matroska':    [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
  'video/x-flv':         [Buffer.from('FLV')],
  'video/x-ms-wmv':      [Buffer.from([0x30, 0x26, 0xB2, 0x75])],
};

/**
 * Validate file content by reading first bytes and comparing to known magic numbers.
 * @param {string} filePath - Path to the uploaded file on disk
 * @param {string} mimetype - Declared MIME type
 * @returns {Promise<boolean>} true if valid or unknown type, false if spoofed
 */
async function validateMagicBytes(filePath, mimetype) {
  try {
    const fd = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(12);
    await fd.read(buf, 0, 12, 0);
    await fd.close();

    const mime = (mimetype || '').toLowerCase();

    // JPEG: FF D8 FF
    if (mime === 'image/jpeg') {
      return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    }
    // PNG: 89 50 4E 47
    if (mime === 'image/png') {
      return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
    }
    // GIF: GIF87a or GIF89a
    if (mime === 'image/gif') {
      const sig = buf.slice(0, 6).toString('ascii');
      return sig === 'GIF87a' || sig === 'GIF89a';
    }
    // WebP: RIFF....WEBP
    if (mime === 'image/webp') {
      return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
    }
    // MP4/MOV: ....ftyp at offset 4
    if (mime === 'video/mp4' || mime === 'video/quicktime') {
      return buf.slice(4, 8).toString('ascii') === 'ftyp';
    }
    // AVI: RIFF
    if (mime === 'video/x-msvideo') {
      return buf.slice(0, 4).toString('ascii') === 'RIFF';
    }
    // WebM/MKV: 1A 45 DF A3
    if (mime === 'video/webm' || mime === 'video/x-matroska') {
      return buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3;
    }
    // FLV: FLV
    if (mime === 'video/x-flv') {
      return buf.slice(0, 3).toString('ascii') === 'FLV';
    }
    // WMV: 30 26 B2 75
    if (mime === 'video/x-ms-wmv') {
      return buf[0] === 0x30 && buf[1] === 0x26 && buf[2] === 0xB2 && buf[3] === 0x75;
    }
    // Unknown MIME — allow (the extension+MIME filter already passed)
    return true;
  } catch {
    // If we can't read the file, reject it
    return false;
  }
}

/**
 * Middleware to validate magic bytes after multer has saved the file.
 * If validation fails, the file is deleted and an error is returned.
 * Supports both single file (req.file) and multi-file (req.files) uploads.
 */
function magicByteValidation(req, res, next) {
  const filesToValidate = [];
  if (req.file) filesToValidate.push(req.file);
  if (req.files && Array.isArray(req.files)) filesToValidate.push(...req.files);
  
  if (filesToValidate.length === 0) return next();
  
  // Filter to only local files (Cloudinary handles its own validation)
  const localFiles = filesToValidate.filter(f => f.path && !f.path.includes('cloudinary.com'));
  if (localFiles.length === 0) return next();
  
  Promise.all(localFiles.map(f => validateMagicBytes(f.path, f.mimetype).then(valid => ({ file: f, valid }))))
    .then(results => {
      const spoofed = results.filter(r => !r.valid);
      if (spoofed.length > 0) {
        // Delete ALL files in this batch (both spoofed and valid) to prevent partial uploads
        for (const f of filesToValidate) {
          if (f.path && !f.path.includes('cloudinary.com')) {
            try { fs.unlinkSync(f.path); } catch {}
          }
        }
        return res.status(400).json({ success: false, error: `${spoofed.length} file(s) have content that does not match declared type. All uploads rejected.`,
          rejectedFiles: spoofed.map(r => r.file.originalname || r.file.filename)
        });
      }
      next();
    })
    .catch(() => next());
}

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

const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);
const isCloudinaryUrl = (value) => typeof value === 'string' && /cloudinary\.com/i.test(value);

// Helper to get file URL (Cloudinary or local)
const getFileUrl = (file, cloudinaryManager) => {
  const candidates = [
    file?.secure_url,
    file?.url,
    file?.path,
    file?.location
  ];

  const cloudinaryUrl = candidates.find(isCloudinaryUrl);
  if (cloudinaryUrl) {
    return cloudinaryUrl;
  }

  const absoluteUrl = candidates.find(isHttpUrl);
  if (absoluteUrl) {
    return absoluteUrl;
  }

  if (cloudinaryManager?.isConfigured) {
    const publicId = file?.public_id || file?.filename;
    if (typeof publicId === 'string' && publicId.trim()) {
      try {
        return cloudinaryManager.cloudinary.url(publicId, { secure: true });
      } catch (_) {
        // Fall back to local path below if Cloudinary URL generation fails.
      }
    }
  }

  return `/uploads/${file?.filename || `upload-${Date.now()}`}`;
};

const requireCloudinaryForProfileUpload = (req, res, next) => {
  const isProduction = (process.env.NODE_ENV || 'development') === 'production';
  if (isProduction && !(req.cloudinaryManager && req.cloudinaryManager.isConfigured)) {
    return res.status(503).json({
      success: false,
      error: 'Profile image uploads are temporarily unavailable',
      message: 'Image storage is unavailable. Please try again later.'
    });
  }

  next();
};

// Chat attachment upload endpoint (image/video/file) - uses Cloudinary if available
router.post('/chat-attachment', authMiddleware, uploadRateLimit(chatUploadLimiter), (req, res, next) => {
  getUploadMiddleware('chat')(req, res, next);
}, magicByteValidation, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
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
        storage_type: isCloudinary ? 'cloudinary' : 'local',
        cloudinary_public_id: req.file.public_id || (isCloudinary ? req.file.filename : null)
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
    res.status(500).json({ success: false, error: 'Failed to upload attachment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Profile picture upload endpoint - uses Cloudinary if available
router.post('/profile-picture', authMiddleware, requireCloudinaryForProfileUpload, uploadRateLimit(profileUploadLimiter), (req, res, next) => {
  getUploadMiddleware('profile')(req, res, next);
}, magicByteValidation, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
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
      return res.status(404).json({ success: false, error: 'User not found' });
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
        storage_type: isCloudinary ? 'cloudinary' : 'local',
        cloudinary_public_id: req.file.public_id || (isCloudinary ? req.file.filename : null)
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
    res.status(500).json({ success: false, error: 'Failed to upload profile picture',
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

router.post('/service-media', authMiddleware, uploadRateLimit(serviceUploadLimiter, (req) => req.files?.length || 1), serviceUpload.array('media', 10), magicByteValidation, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const userId = req.user.userId;
    const { serviceId } = req.body;
    
    if (!serviceId) {
      return res.status(400).json({ success: false, error: 'Service ID is required' });
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
    res.status(500).json({ success: false, error: 'Failed to upload service media',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Video upload endpoint for user videos - uses local storage (videos are large)
const videoFileFilter = (req, file, cb) => {
  const extname = path.extname(file.originalname).toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();
  if (ALLOWED_VIDEO_EXTS.test(extname) && ALLOWED_VIDEO_MIMES.test(mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Only video files are allowed! Extension and content type must match.'));
};

const videoUpload = multer({
  storage: localStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: videoFileFilter
});

router.post('/user-video', authMiddleware, uploadRateLimit(videoUploadLimiter), videoUpload.single('video'), magicByteValidation, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No video uploaded' });
    }

    const userId = req.user.userId;
    const fileName = req.file.filename;
    const filePath = req.file.path;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    
    if (!mimeType.startsWith('video/')) {
      return res.status(400).json({ success: false, error: 'Only video files are allowed' });
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
    res.status(500).json({ success: false, error: 'Failed to upload video',
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
    res.status(500).json({ success: false, error: 'Failed to fetch user files',
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
      return res.status(404).json({ success: false, error: 'File not found or access denied' });
    }
    
    const filePath = file.file_path;
    
    // Delete physical file asynchronously
    try {
      await fs.promises.access(filePath);
      await fs.promises.unlink(filePath);
    } catch (fsErr) {
      // File may not exist on disk (e.g. Cloudinary) - non-fatal
    }
    
    // Mark as deleted in database
    await FileUpload.findByIdAndUpdate(fileId, { status: 'deleted' });
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete file',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Serve uploaded files
router.get('/uploads/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // basename strips path traversal (../ etc.)
  const filePath = path.join(__dirname, '../uploads', filename);
  
  // Extra guard: resolve and verify the path stays within the uploads directory
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(uploadsDir)) {
    return res.status(400).json({ success: false, error: 'Invalid filename' });
  }

  if (fs.existsSync(resolvedPath)) {
    res.sendFile(resolvedPath);
  } else {
    res.status(404).json({ success: false, error: 'File not found' });
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

router.post('/content', authMiddleware, contentUpload.single('media'), magicByteValidation, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No media file uploaded' });
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
    res.status(500).json({ success: false, error: 'Failed to upload content',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get content feed (public posts)
router.get('/content/feed', async (req, res) => {
  try {
    const { category } = req.query;
    const pg = safePagination(req.query.page, req.query.limit);

    const query = {
      upload_type: 'content_post',
      status: 'active'
    };

    if (category && category !== 'all') {
      query['metadata.category'] = category;
    }

    // Use aggregation with $lookup to avoid N+1 user queries
    const pipeline = [
      { $match: query },
      { $sort: { created_at: -1 } },
      { $skip: pg.skip },
      { $limit: pg.limit },
      {
        $lookup: {
          from: 'users',
          localField: 'user_id',
          foreignField: '_id',
          as: '_user',
          pipeline: [{ $project: { username: 1, 'profile_data.profilePicture': 1, 'profile_data.photos': 1 } }]
        }
      },
      { $unwind: { path: '$_user', preserveNullAndEmptyArrays: true } }
    ];

    const [content, totalArr] = await Promise.all([
      FileUpload.aggregate(pipeline),
      FileUpload.aggregate([{ $match: query }, { $count: 'n' }])
    ]);
    const total = totalArr.length > 0 ? totalArr[0].n : 0;

    const contentWithUsers = content.map(post => {
      const user = post._user || null;
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
        userAvatar: user?.profile_data?.profilePicture || user?.profile_data?.profile_image || user?.profile_data?.profile_image_url || user?.profile_data?.profile_picture?.url || user?.profile_data?.photos?.[0] || null,
        createdAt: post.created_at,
        storageType: post.storage_type
      };
    });

    res.json({
      success: true,
      content: contentWithUsers,
      pagination: {
        page: pg.page,
        limit: pg.limit,
        total,
        pages: Math.ceil(total / pg.limit)
      }
    });

  } catch (error) {
    console.error('Content feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch content feed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get user's own content
router.get('/content/my', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const pg = safePagination(req.query.page, req.query.limit);

    const content = await FileUpload.find({
      user_id: userId,
      upload_type: 'content_post',
      status: 'active'
    })
      .sort({ created_at: -1 })
      .skip(pg.skip)
      .limit(pg.limit);

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
        page: pg.page,
        limit: pg.limit,
        total,
        pages: Math.ceil(total / pg.limit)
      }
    });

  } catch (error) {
    console.error('My content error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch your content',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Like/unlike content (idempotent toggle using likedBy array)
router.post('/content/:contentId/like', authMiddleware, async (req, res) => {
  try {
    const { contentId } = req.params;
    const userId = req.user.userId;

    // Atomic like toggle: try $addToSet first, check if it actually added
    const addResult = await FileUpload.findOneAndUpdate(
      { _id: contentId, 'metadata.likedBy': { $ne: userId } },
      {
        $addToSet: { 'metadata.likedBy': userId },
        $inc: { 'metadata.likes': 1 }
      },
      { new: true }
    );

    if (addResult) {
      // User was not in likedBy → like added
      return res.json({
        success: true,
        liked: true,
        likes: addResult.metadata?.likes || 0
      });
    }

    // addResult is null → either content doesn't exist or user already liked
    const removeResult = await FileUpload.findOneAndUpdate(
      { _id: contentId, 'metadata.likedBy': userId },
      {
        $pull: { 'metadata.likedBy': userId },
        $inc: { 'metadata.likes': -1 }
      },
      { new: true }
    );

    if (!removeResult) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }

    res.json({
      success: true,
      liked: false,
      likes: removeResult.metadata?.likes || 0
    });

  } catch (error) {
    console.error('Like content error:', error);
    res.status(500).json({ success: false, error: 'Failed to like content',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Increment view count (atomic)
router.post('/content/:contentId/view', async (req, res) => {
  try {
    const { contentId } = req.params;

    const result = await FileUpload.findByIdAndUpdate(
      contentId,
      { $inc: { 'metadata.views': 1 } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }

    res.json({
      success: true,
      views: result.metadata?.views || 0
    });

  } catch (error) {
    console.error('View content error:', error);
    res.status(500).json({ success: false, error: 'Failed to record view' });
  }
});

module.exports = router;
