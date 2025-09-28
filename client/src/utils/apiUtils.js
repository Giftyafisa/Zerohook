/**
 * Utility functions for making authenticated API calls
 */

/**
 * Get authentication headers for API requests
 * @returns {Object} Headers object with Authorization token
 */
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No authentication token found. Please login again.');
  }
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

/**
 * Make an authenticated GET request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Additional fetch options
 * @returns {Promise} Fetch response
 */
export const authenticatedGet = async (url, options = {}) => {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(url, {
      method: 'GET',
      headers,
      ...options
    });
    
    if (response.status === 401) {
      // Token might be expired, try to refresh
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication expired. Please login again.');
    }
    
    return response;
  } catch (error) {
    console.error(`Authenticated GET request failed for ${url}:`, error);
    throw error;
  }
};

/**
 * Make an authenticated POST request
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {Object} options - Additional fetch options
 * @returns {Promise} Fetch response
 */
export const authenticatedPost = async (url, data = {}, options = {}) => {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      ...options
    });
    
    if (response.status === 401) {
      // Token might be expired, try to refresh
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication expired. Please login again.');
    }
    
    return response;
  } catch (error) {
    console.error(`Authenticated POST request failed for ${url}:`, error);
    throw error;
  }
};

/**
 * Make an authenticated PUT request
 * @param {string} url - API endpoint URL
 * @param {Object} data - Request body data
 * @param {Object} options - Additional fetch options
 * @returns {Promise} Fetch response
 */
export const authenticatedPut = async (url, data = {}, options = {}) => {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
      ...options
    });
    
    if (response.status === 401) {
      // Token might be expired, try to refresh
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication expired. Please login again.');
    }
    
    return response;
  } catch (error) {
    console.error(`Authenticated PUT request failed for ${url}:`, error);
    throw error;
  }
};

/**
 * Make an authenticated DELETE request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Additional fetch options
 * @returns {Promise} Fetch response
 */
export const authenticatedDelete = async (url, options = {}) => {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(url, {
      method: 'DELETE',
      headers,
      ...options
    });
    
    if (response.status === 401) {
      // Token might be expired, try to refresh
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication expired. Please login again.');
    }
    
    return response;
  } catch (error) {
    console.error(`Authenticated DELETE request failed for ${url}:`, error);
    throw error;
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if user has valid token
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  return !!token;
};

/**
 * Get current authentication token
 * @returns {string|null} Current token or null if not authenticated
 */
export const getAuthToken = () => {
  return localStorage.getItem('token');
};
