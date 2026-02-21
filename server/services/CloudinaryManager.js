/**
 * Cloudinary Manager Service
 * Handles image uploads, transformations, and management for Zerohook platform
 */

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

class CloudinaryManager {
  constructor() {
    // Configure Cloudinary with environment variables
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
      api_key: process.env.CLOUDINARY_API_KEY || '',
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true
    });

    this.cloudinary = cloudinary;
    this.isConfigured = !!process.env.CLOUDINARY_API_SECRET;
    
    if (!this.isConfigured) {
      console.log('⚠️  Cloudinary API secret not configured. Image uploads will use local storage fallback.');
    } else {
      console.log('✅ Cloudinary configured successfully');
    }
  }

  /**
   * Get multer storage for profile images
   */
  getProfileStorage() {
    if (!this.isConfigured) {
      // Fallback to local storage
      return multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => {
          const uniqueName = `profile-${req.user?.userId || 'unknown'}-${Date.now()}${this.getExtension(file.originalname)}`;
          cb(null, uniqueName);
        }
      });
    }

    return new CloudinaryStorage({
      cloudinary: this.cloudinary,
      params: {
        folder: 'zerohook/profiles',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
          { width: 800, height: 800, crop: 'limit', quality: 'auto:good' }
        ],
        public_id: (req, file) => `profile-${req.user?.userId || 'unknown'}-${Date.now()}`
      }
    });
  }

  /**
   * Get multer storage for service images
   */
  getServiceStorage() {
    if (!this.isConfigured) {
      return multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => {
          const uniqueName = `service-${Date.now()}${this.getExtension(file.originalname)}`;
          cb(null, uniqueName);
        }
      });
    }

    return new CloudinaryStorage({
      cloudinary: this.cloudinary,
      params: {
        folder: 'zerohook/services',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
          { width: 1200, height: 800, crop: 'limit', quality: 'auto:good' }
        ],
        public_id: (req, file) => `service-${Date.now()}-${Math.random().toString(36).substring(7)}`
      }
    });
  }

  /**
   * Get multer storage for chat/message images
   */
  getChatStorage() {
    if (!this.isConfigured) {
      return multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/'),
        filename: (req, file, cb) => {
          const uniqueName = `chat-${Date.now()}${this.getExtension(file.originalname)}`;
          cb(null, uniqueName);
        }
      });
    }

    return new CloudinaryStorage({
      cloudinary: this.cloudinary,
      params: {
        folder: 'zerohook/chat',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
          { width: 1000, height: 1000, crop: 'limit', quality: 'auto' }
        ],
        public_id: (req, file) => `chat-${Date.now()}-${Math.random().toString(36).substring(7)}`
      }
    });
  }

  /**
   * Get multer storage for content/post uploads (TikTok-style posts)
   * Stores in a separate folder from profile images
   */
  getContentStorage() {
    if (!this.isConfigured) {
      return multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadDir = 'uploads/content/';
          const fs = require('fs');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueName = `content-${req.user?.userId || 'unknown'}-${Date.now()}${this.getExtension(file.originalname)}`;
          cb(null, uniqueName);
        }
      });
    }

    return new CloudinaryStorage({
      cloudinary: this.cloudinary,
      params: {
        folder: 'zerohook/content', // Separate folder for content posts
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi', 'webm'],
        resource_type: 'auto', // Allow both images and videos
        transformation: [
          { width: 1080, height: 1920, crop: 'limit', quality: 'auto:good' } // 9:16 aspect ratio for mobile
        ],
        public_id: (req, file) => `content-${req.user?.userId || 'unknown'}-${Date.now()}-${Math.random().toString(36).substring(7)}`
      }
    });
  }

  /**
   * Get multer storage for verification documents
   */
  getVerificationStorage() {
    if (!this.isConfigured) {
      return multer.diskStorage({
        destination: (req, file, cb) => cb(null, 'uploads/verification/'),
        filename: (req, file, cb) => {
          const uniqueName = `verify-${req.user?.userId || 'unknown'}-${Date.now()}${this.getExtension(file.originalname)}`;
          cb(null, uniqueName);
        }
      });
    }

    return new CloudinaryStorage({
      cloudinary: this.cloudinary,
      params: {
        folder: 'zerohook/verification',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
        resource_type: 'auto',
        access_mode: 'authenticated', // Private for verification docs
        public_id: (req, file) => `verify-${req.user?.userId || 'unknown'}-${Date.now()}`
      }
    });
  }

  /**
   * Upload a single image from buffer or file path
   * @param {Buffer|string} source - Image buffer or file path
   * @param {Object} options - Upload options
   */
  async uploadImage(source, options = {}) {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloudinary not configured' };
    }

    try {
      const defaultOptions = {
        folder: 'zerohook/general',
        resource_type: 'image',
        quality: 'auto:good',
        fetch_format: 'auto'
      };

      const uploadOptions = { ...defaultOptions, ...options };
      
      let result;
      if (Buffer.isBuffer(source)) {
        // Upload from buffer
        result = await new Promise((resolve, reject) => {
          const stream = this.cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(source);
        });
      } else {
        // Upload from file path or URL
        result = await this.cloudinary.uploader.upload(source, uploadOptions);
      }

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Upload multiple images
   * @param {Array} sources - Array of image sources (buffers, paths, or URLs)
   * @param {Object} options - Upload options
   */
  async uploadMultiple(sources, options = {}) {
    const results = await Promise.all(
      sources.map(source => this.uploadImage(source, options))
    );
    return results;
  }

  /**
   * Upload a video to Cloudinary
   * @param {string|Buffer} source - Video path, URL, or buffer
   * @param {Object} options - Upload options
   */
  async uploadVideo(source, options = {}) {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloudinary not configured' };
    }

    try {
      const uploadOptions = {
        folder: options.folder || 'zerohook/content',
        resource_type: 'video',
        ...options
      };

      let result;
      
      // Handle different source types
      if (Buffer.isBuffer(source)) {
        // Upload from buffer using stream
        result = await new Promise((resolve, reject) => {
          const stream = this.cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(source);
        });
      } else {
        // Upload from file path or URL
        result = await this.cloudinary.uploader.upload(source, uploadOptions);
      }

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        duration: result.duration,
        resourceType: 'video'
      };
    } catch (error) {
      console.error('Cloudinary video upload error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete an image by public ID
   * @param {string} publicId - The public ID of the image
   */
  async deleteImage(publicId) {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloudinary not configured' };
    }

    try {
      const result = await this.cloudinary.uploader.destroy(publicId);
      return { success: result.result === 'ok', result };
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete multiple images
   * @param {Array} publicIds - Array of public IDs to delete
   */
  async deleteMultiple(publicIds) {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloudinary not configured' };
    }

    try {
      const result = await this.cloudinary.api.delete_resources(publicIds);
      return { success: true, result };
    } catch (error) {
      console.error('Cloudinary batch delete error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate a transformed URL for an image
   * @param {string} publicId - The public ID of the image
   * @param {Object} transformations - Transformation options
   */
  getTransformedUrl(publicId, transformations = {}) {
    const defaultTransformations = {
      quality: 'auto',
      fetch_format: 'auto'
    };

    return this.cloudinary.url(publicId, {
      ...defaultTransformations,
      ...transformations,
      secure: true
    });
  }

  /**
   * Get optimized thumbnail URL
   * @param {string} publicIdOrUrl - Public ID or full URL
   * @param {number} size - Thumbnail size (default 150)
   */
  getThumbnailUrl(publicIdOrUrl, size = 150) {
    // If it's already a Cloudinary URL, extract public_id
    if (publicIdOrUrl.includes('cloudinary.com')) {
      // Transform existing URL
      return publicIdOrUrl.replace('/upload/', `/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`);
    }

    // If it's a public ID
    return this.cloudinary.url(publicIdOrUrl, {
      width: size,
      height: size,
      crop: 'fill',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true
    });
  }

  /**
   * Get optimized profile image URL
   * @param {string} publicIdOrUrl - Public ID or full URL
   */
  getProfileImageUrl(publicIdOrUrl, width = 400, height = 400) {
    if (!publicIdOrUrl) return null;

    // If it's already a Cloudinary URL
    if (publicIdOrUrl.includes('cloudinary.com')) {
      return publicIdOrUrl.replace('/upload/', `/upload/c_fill,w_${width},h_${height},g_face,q_auto,f_auto/`);
    }

    // If it's a local URL, return as-is (will be migrated later)
    if (publicIdOrUrl.startsWith('/uploads') || publicIdOrUrl.startsWith('http://localhost')) {
      return publicIdOrUrl;
    }

    // If it's a public ID
    return this.cloudinary.url(publicIdOrUrl, {
      width,
      height,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto',
      fetch_format: 'auto',
      secure: true
    });
  }

  /**
   * Upload image from URL (for migrating existing images)
   * @param {string} url - URL of the image to upload
   * @param {Object} options - Upload options
   */
  async uploadFromUrl(url, options = {}) {
    if (!this.isConfigured) {
      return { success: false, error: 'Cloudinary not configured' };
    }

    try {
      const result = await this.cloudinary.uploader.upload(url, {
        folder: options.folder || 'zerohook/migrated',
        ...options
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        originalUrl: url
      };
    } catch (error) {
      console.error('Cloudinary URL upload error:', error);
      return { success: false, error: error.message, originalUrl: url };
    }
  }

  /**
   * Check if Cloudinary is properly configured
   */
  async healthCheck() {
    if (!this.isConfigured) {
      return { healthy: false, error: 'API secret not configured' };
    }

    try {
      const result = await this.cloudinary.api.ping();
      return { healthy: true, status: result.status };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Get file extension from filename
   */
  getExtension(filename) {
    const ext = filename.split('.').pop();
    return ext ? `.${ext}` : '.jpg';
  }

  /**
   * Extract public ID from Cloudinary URL
   */
  extractPublicId(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    
    // Extract public_id from URL like:
    // https://res.cloudinary.com/devrpaqaj/image/upload/v1234567890/zerohook/profiles/profile-123.jpg
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  }
}

module.exports = CloudinaryManager;
