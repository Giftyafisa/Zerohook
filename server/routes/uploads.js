const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
const router = express.Router();

// Configure multer for file uploads with enhanced support
const storage = multer.diskStorage({
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

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: fileFilter
});

// Profile picture upload endpoint
router.post('/profile-picture', authMiddleware, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.userId;
    const filePath = req.file.path;
    const fileName = req.file.filename;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;
    
    // Create public URL for the uploaded file
    const publicUrl = `/uploads/${fileName}`;
    
    // Determine file type
    const isVideo = mimeType.startsWith('video/');
    const fileType = isVideo ? 'video' : 'image';
    
    // Update user's profile_data with new profile picture
    const updateResult = await query(`
      UPDATE users 
      SET profile_data = jsonb_set(
        COALESCE(profile_data, '{}'::jsonb), 
        '{profile_picture}', 
        $1::jsonb
      )
      WHERE id = $2
      RETURNING profile_data
    `, [JSON.stringify({ 
      url: publicUrl, 
      filename: fileName, 
      fileSize, 
      mimeType, 
      fileType 
    }), userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log file upload to file_uploads table
    await query(`
      INSERT INTO file_uploads (user_id, file_name, file_path, file_size, mime_type, upload_type)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, fileName, filePath, fileSize, mimeType, 'profile_picture']);

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: {
        url: publicUrl,
        filename: fileName,
        fileSize,
        mimeType,
        fileType
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

// Service media upload endpoint (multiple files)
router.post('/service-media', authMiddleware, upload.array('media', 10), async (req, res) => {
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
      const isVideo = mimeType.startsWith('video/');
      const fileType = isVideo ? 'video' : 'image';
      
      const publicUrl = `/uploads/${fileName}`;
      
      // Log file upload to file_uploads table
      await query(`
        INSERT INTO file_uploads (user_id, service_id, file_name, file_path, file_size, mime_type, upload_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [userId, serviceId, fileName, filePath, fileSize, mimeType, 'service_media']);
      
      uploadedFiles.push({
        id: fileName, // Using filename as ID for now
        fileName,
        url: publicUrl,
        fileSize,
        mimeType,
        fileType
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

// Video upload endpoint for user videos
router.post('/user-video', authMiddleware, upload.single('video'), async (req, res) => {
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
