/**
 * Shared Axios instance with centralized token refresh and 401 handling.
 * All API service modules should import this instance instead of creating their own.
 *
 * API_BASE_URL is imported from config/constants.js — the single source of truth.
 * To change the backend URL, update REACT_APP_API_URL in your .env or Render env vars.
 */
import axios from 'axios';
import { API_BASE_URL, normalizeLegacyUploadHostUrl } from '../config/constants';

let isRefreshing = false;
let failedQueue = [];

const normalizeLegacyUploadData = (input) => {
  if (input == null) return input;
  if (typeof input === 'string') return normalizeLegacyUploadHostUrl(input);
  if (Array.isArray(input)) return input.map(normalizeLegacyUploadData);
  if (typeof input !== 'object') return input;

  const output = {};
  Object.keys(input).forEach((key) => {
    output[key] = normalizeLegacyUploadData(input[key]);
  });
  return output;
};

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
  withCredentials: true
});

// Attach latest token on every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralized 401 handling with mutex-based refresh queue
apiClient.interceptors.response.use(
  (response) => {
    if (response?.data) {
      response.data = normalizeLegacyUploadData(response.data);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '').toLowerCase();
    const isAuthRoute = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/refresh')
      || requestUrl.includes('/auth/validate-token');

    // Do not attempt refresh for authentication endpoints.
    // A login/register 401 should surface directly to UI.
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Another request is already refreshing — queue this one
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({})
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.token) {
            localStorage.setItem('token', refreshData.token);
            processQueue(null, refreshData.token);
            originalRequest.headers.Authorization = `Bearer ${refreshData.token}`;
            return apiClient(originalRequest);
          }
        }

        // Refresh failed
        processQueue(new Error('Refresh failed'));
        localStorage.removeItem('token');
        // Use history-friendly redirect instead of hard reload
        window.location.href = '/login';
      } catch (refreshError) {
        processQueue(refreshError);
        localStorage.removeItem('token');
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
export { API_BASE_URL };
