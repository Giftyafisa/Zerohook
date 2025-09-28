import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authAPI from '../../services/authAPI';

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/loginUser',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authAPI.login(credentials);
      localStorage.setItem('token', response.token);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Login failed' });
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/registerUser',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authAPI.register(userData);
      localStorage.setItem('token', response.token);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Registration failed' });
    }
  }
);

export const refreshToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authAPI.refresh();
      localStorage.setItem('token', response.token);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Token refresh failed' });
    }
  }
);

// Validate stored token without requiring authentication
export const validateStoredToken = createAsyncThunk(
  'auth/validateStoredToken',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }
      
      console.log('🔍 Validating stored token...');
      const response = await authAPI.validateStoredToken(token);
      
      if (!response.valid) {
        // Token is invalid, remove it
        localStorage.removeItem('token');
        throw new Error(response.error || 'Token validation failed');
      }
      
      console.log('✅ Token validation successful');
      return response;
    } catch (error) {
      console.error('❌ Token validation failed:', error.message);
      // Clear invalid token
      localStorage.removeItem('token');
      return rejectWithValue(error.message);
    }
  }
);

export const verifyTier = createAsyncThunk(
  'auth/verifyTier',
  async (verificationData, { rejectWithValue }) => {
    try {
      const response = await authAPI.verifyTier(verificationData);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Verification failed' });
    }
  }
);

// Initial state
const initialState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  isSubscribed: false,
  loading: false,
  error: null,
  verificationStatus: {
    loading: false,
    error: null,
    success: false
  },
  subscriptionStatus: {
    loading: false,
    error: null,
    success: false
  }
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem('token');
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
      state.verificationStatus.error = null;
    },
    updateUser: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    setVerificationSuccess: (state, action) => {
      state.verificationStatus.success = action.payload;
    },
    setSubscriptionStatus: (state, action) => {
      state.isSubscribed = action.payload;
    },
    clearSubscriptionError: (state) => {
      state.subscriptionStatus.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login cases
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.isSubscribed = action.payload.user.is_subscribed || false;
        state.error = null;
        // Set token in localStorage
        localStorage.setItem('token', action.payload.token);
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Login failed';
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
      })
      
      // Register cases
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.isSubscribed = action.payload.user.is_subscribed || false;
        state.error = null;
        // Set token in localStorage
        localStorage.setItem('token', action.payload.token);
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Registration failed';
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
      })
      
      // Token refresh cases
      .addCase(refreshToken.pending, (state) => {
        state.loading = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        if (action.payload.user) {
          state.user = { ...state.user, ...action.payload.user };
          state.isSubscribed = action.payload.user.is_subscribed || false;
        }
        state.error = null;
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Token refresh failed';
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        localStorage.removeItem('token');
      })
      
      // Tier verification cases
      .addCase(verifyTier.pending, (state) => {
        state.verificationStatus.loading = true;
        state.verificationStatus.error = null;
        state.verificationStatus.success = false;
      })
      .addCase(verifyTier.fulfilled, (state, action) => {
        state.verificationStatus.loading = false;
        state.verificationStatus.success = true;
        if (state.user) {
          state.user.verificationTier = action.payload.newTier;
        }
      })
      .addCase(verifyTier.rejected, (state, action) => {
        state.verificationStatus.loading = false;
        state.verificationStatus.error = action.payload?.error || 'Verification failed';
        state.verificationStatus.success = false;
      })
      
      // Token validation cases
      .addCase(validateStoredToken.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(validateStoredToken.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = localStorage.getItem('token');
        state.isAuthenticated = true;
        state.isSubscribed = action.payload.user.is_subscribed || false;
        state.error = null;
      })
      .addCase(validateStoredToken.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Token validation failed';
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
        localStorage.removeItem('token');
      });
  },
});

export const { logout, clearError, updateUser, setVerificationSuccess, setSubscriptionStatus, clearSubscriptionError } = authSlice.actions;

// Selectors
export const selectAuth = (state) => state.auth;
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsSubscribed = (state) => state.auth.isSubscribed;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
export const selectVerificationStatus = (state) => state.auth.verificationStatus;

export default authSlice.reducer;