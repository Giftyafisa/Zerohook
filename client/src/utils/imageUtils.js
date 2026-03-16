import { getUploadUrl } from '../config/constants';

/**
 * Resolves profile image from multiple possible storage formats
 * Handles: photos[], profile_picture{}, profilePicture string
 * @param {Object} profileData - User's profile_data object
 * @returns {string|null} - Image URL or null if no image
 */
export const resolveProfileImage = (profileData) => {
  if (!profileData) return null;

  // 1. Check for photos array (test data format)
  if (profileData.photos && Array.isArray(profileData.photos) && profileData.photos.length > 0) {
    const photo = profileData.photos[0];
    if (typeof photo === 'string') {
      // Always normalize via getUploadUrl to handle legacy upload hosts too.
      return getUploadUrl(photo);
    }
  }
  
  // 2. Check for profile_picture (can be object or string)
  if (profileData.profile_picture) {
    if (typeof profileData.profile_picture === 'object') {
      // Object format: { url: '...', fileSize: ..., mimeType: ... }
      const url = profileData.profile_picture.url;
      if (url && typeof url === 'string') {
        // Always normalize via getUploadUrl to handle legacy upload hosts too.
        return getUploadUrl(url);
      }
    } else if (typeof profileData.profile_picture === 'string') {
      // String format: '/uploads/profile-xxx.jpg'
      const pic = profileData.profile_picture;
      // Always normalize via getUploadUrl to handle legacy upload hosts too.
      return getUploadUrl(pic);
    }
  }
  
  // 3. Check for profilePicture string (legacy/test data)
  if (profileData.profilePicture && typeof profileData.profilePicture === 'string') {
    const pic = profileData.profilePicture;
    // Always normalize via getUploadUrl to handle legacy upload hosts too.
    return getUploadUrl(pic);
  }
  
  // No image available
  return null;
};

/**
 * Extract first profile image path for mapping/processing
 * Returns raw path/URL without calling getUploadUrl
 * @param {Object} profileData - User's profile_data object
 * @returns {string|null} - Image path/URL or null
 */
export const extractProfileImagePath = (profileData) => {
  if (!profileData) return null;

  // Check photos array first
  if (profileData.photos && Array.isArray(profileData.photos) && profileData.photos.length > 0) {
    return profileData.photos[0];
  }
  
  // Check profile_picture (can be object or string)
  if (profileData.profile_picture) {
    if (typeof profileData.profile_picture === 'object' && profileData.profile_picture.url) {
      return profileData.profile_picture.url;
    } else if (typeof profileData.profile_picture === 'string') {
      return profileData.profile_picture;
    }
  }
  
  // Check profilePicture string
  if (profileData.profilePicture) {
    return profileData.profilePicture;
  }
  
  return null;
};

/**
 * Check if URL is a Cloudinary URL
 * @param {string} url - Image URL
 * @returns {boolean}
 */
export const isCloudinaryUrl = (url) => {
  return url && typeof url === 'string' && url.includes('cloudinary.com');
};

/**
 * Get optimized Cloudinary URL with transformations
 * @param {string} url - Original Cloudinary URL
 * @param {Object} options - Transformation options
 * @returns {string} - Optimized URL
 */
export const getOptimizedCloudinaryUrl = (url, options = {}) => {
  if (!isCloudinaryUrl(url)) return url;
  
  const { width = 400, height = 400, crop = 'fill', quality = 'auto', format = 'auto' } = options;
  
  // Insert transformations into Cloudinary URL
  // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123/folder/image.jpg
  // Transformed: https://res.cloudinary.com/cloud_name/image/upload/c_fill,w_400,h_400,q_auto,f_auto/v123/folder/image.jpg
  
  const transformations = `c_${crop},w_${width},h_${height},q_${quality},f_${format}`;
  
  return url.replace('/upload/', `/upload/${transformations}/`);
};

/**
 * Get thumbnail URL (150x150 optimized)
 * @param {string} url - Original image URL
 * @returns {string} - Thumbnail URL
 */
export const getThumbnailUrl = (url) => {
  if (!url) return null;
  
  if (isCloudinaryUrl(url)) {
    return getOptimizedCloudinaryUrl(url, { width: 150, height: 150, crop: 'fill' });
  }
  
  return url;
};

/**
 * Get profile image URL optimized for display
 * @param {string} url - Original image URL
 * @param {string} size - Size preset: 'small' (100), 'medium' (300), 'large' (600)
 * @returns {string} - Optimized URL
 */
export const getProfileImageOptimized = (url, size = 'medium') => {
  if (!url) return null;
  
  const sizes = {
    small: { width: 100, height: 100 },
    medium: { width: 300, height: 300 },
    large: { width: 600, height: 600 }
  };
  
  const dimensions = sizes[size] || sizes.medium;
  
  if (isCloudinaryUrl(url)) {
    return getOptimizedCloudinaryUrl(url, { 
      ...dimensions, 
      crop: 'fill',
      // Use face detection for profile pictures
      gravity: 'face'
    });
  }
  
  return url;
};
