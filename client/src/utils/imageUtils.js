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
      // If it's already a full URL (Unsplash, pravatar, etc), use it directly
      if (photo.startsWith('http://') || photo.startsWith('https://')) {
        return photo;
      }
      // Otherwise, treat it as an upload path
      return getUploadUrl(photo);
    }
  }
  
  // 2. Check for profile_picture object (actual upload format)
  if (profileData.profile_picture && typeof profileData.profile_picture === 'object') {
    const url = profileData.profile_picture.url;
    if (url && typeof url === 'string') {
      // If it's already a full URL, use it directly
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }
      // Otherwise, treat it as an upload path
      return getUploadUrl(url);
    }
  }
  
  // 3. Check for profilePicture string (legacy/test data)
  if (profileData.profilePicture && typeof profileData.profilePicture === 'string') {
    const pic = profileData.profilePicture;
    // If it's already a full URL, use it directly
    if (pic.startsWith('http://') || pic.startsWith('https://')) {
      return pic;
    }
    // Otherwise, treat it as an upload path
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
  
  // Check profile_picture object
  if (profileData.profile_picture && typeof profileData.profile_picture === 'object' && profileData.profile_picture.url) {
    return profileData.profile_picture.url;
  }
  
  // Check profilePicture string
  if (profileData.profilePicture) {
    return profileData.profilePicture;
  }
  
  return null;
};
