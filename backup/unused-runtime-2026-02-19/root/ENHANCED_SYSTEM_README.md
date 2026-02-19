# 🚀 Hkup Platform - Enhanced System

## ✨ New Features Overview

This enhanced version of the Hkup platform includes:

### 🔗 User Connection System
- **Contact Requests**: Send and manage connection requests with other users
- **Service Inquiries**: Direct messaging about specific services
- **User Blocking**: Block unwanted users and manage connections
- **Connection Management**: View and manage all your connections

### 📹 Video System
- **Video Uploads**: Upload videos up to 50MB for profiles and services
- **Video Calls**: Make secure video calls with other users
- **Video Messaging**: Send video messages in conversations
- **Video Player**: Enhanced video player with controls

### 📁 Enhanced File Management
- **Multiple File Types**: Support for images and videos
- **Service Media**: Upload multiple media files for services
- **File Tracking**: Database logging for all uploads
- **File Management**: List, view, and delete uploaded files

### 💬 Enhanced Chat System
- **Rich Message Types**: Support for text, images, videos, location, and service inquiries
- **Message Metadata**: Store additional context with messages
- **Conversation Status**: Track active, blocked, and deleted conversations
- **Real-time Updates**: Socket.io integration for instant messaging

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16+ 
- PostgreSQL 12+
- Redis (optional, for caching)

### Quick Start
1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd Hookup
   npm install
   cd server && npm install
   cd ../client && npm install
   ```

2. **Environment Setup**
   ```bash
   # Copy environment files
   cp server/env.example server/env.local
   # Edit server/env.local with your database credentials
   ```

3. **Database Setup**
   ```bash
   cd server
   npm run setup-db
   ```

4. **Start the System**
   ```bash
   # Option 1: Use the startup script
   ./start-system.bat
   
   # Option 2: Manual startup
   cd server && npm start
   cd ../client && npm start
   ```

## 🔧 API Endpoints

### User Connections
- `POST /api/connections/contact-request` - Send contact request
- `POST /api/connections/respond` - Accept/reject requests
- `GET /api/connections/user-connections` - Get user connections
- `POST /api/connections/service-inquiry` - Send service inquiry
- `GET /api/connections/pending-requests` - Get pending requests
- `POST /api/connections/block-user` - Block a user

### Enhanced File Uploads
- `POST /api/uploads/profile-picture` - Upload profile picture
- `POST /api/uploads/service-media` - Upload service media
- `POST /api/uploads/user-video` - Upload user video
- `GET /api/uploads/user-files` - List user files
- `DELETE /api/uploads/:fileId` - Delete file

### Enhanced Chat
- `GET /api/chat/conversations` - Get conversations with status
- `GET /api/chat/messages/:conversationId` - Get messages with metadata
- `POST /api/chat/send` - Send message with type and metadata
- `POST /api/chat/video-call` - Handle video call signaling
- `POST /api/chat/block-user` - Block user in chat

## 🎯 Frontend Integration

### UserConnectionHub Component
The main component that integrates all new features:

```jsx
import UserConnectionHub from './components/UserConnectionHub';

// Use in your page
<UserConnectionHub currentUser={currentUser} />
```

### VideoSystem Component
Reusable video component with multiple modes:

```jsx
import VideoSystem from './components/video/VideoSystem';

// Upload mode
<VideoSystem mode="upload" onVideoUpload={handleUpload} />

// Video call mode
<VideoSystem mode="call" onCallStart={handleCallStart} />

// Video messaging mode
<VideoSystem mode="messaging" onMessageSend={handleMessage} />

// Video player mode
<VideoSystem mode="player" initialVideo={videoData} />
```

### Service Contact Integration
Add contact functionality to service browsing:

```jsx
// In AdultServiceBrowse.js
const handleContact = (service) => {
  setSelectedService(service);
  setContactDialog(true);
};

// Contact dialog with service inquiry
<Dialog open={contactDialog}>
  <DialogTitle>Contact Service Provider</DialogTitle>
  <DialogContent>
    <TextField
      label="Message"
      value={contactMessage}
      onChange={(e) => setContactMessage(e.target.value)}
      placeholder="Ask about this service..."
    />
  </DialogContent>
  <DialogActions>
    <Button onClick={handleSendMessage}>Send Message</Button>
  </DialogActions>
</Dialog>
```

## 🗄️ Database Schema

### New Tables
- `user_connections` - Store connection requests and relationships
- `blocked_users` - Track blocked user relationships
- `notifications` - Store user notifications
- `file_uploads` - Track all uploaded files

### Enhanced Tables
- `conversations` - Added status field
- `messages` - Added metadata JSONB field
- `users` - Added profile_data JSONB field

## 🧪 Testing

### System Integration Test
```bash
cd server
npm run test-system
```

### Individual Tests
```bash
# Test database connection
npm run test-db

# Test API endpoints
npm run test-apis

# Test full system
npm run setup-full
```

## 🚀 Deployment

### Production Environment
1. Set `NODE_ENV=production` in environment
2. Use `env.production` configuration
3. Enable rate limiting and security features
4. Set up proper SSL certificates

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis (optional)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-secret-key
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# File Uploads
MAX_FILE_SIZE=52428800  # 50MB in bytes
UPLOAD_PATH=./uploads
```

## 🔒 Security Features

- **Rate Limiting**: Configurable request limits
- **File Validation**: Type and size validation
- **User Authentication**: JWT-based authentication
- **Input Validation**: Express-validator for all inputs
- **SQL Injection Protection**: Parameterized queries

## 📱 Mobile Considerations

- **Responsive Design**: All components are mobile-friendly
- **Touch Controls**: Video player optimized for touch
- **File Size Limits**: Optimized for mobile uploads
- **Progressive Loading**: Efficient data loading

## 🎨 Customization

### Theme Configuration
```jsx
// In theme/colors.js
export const colors = {
  primary: '#1976d2',
  secondary: '#dc004e',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336'
};
```

### Component Styling
```jsx
// Custom styling with Material-UI
<Box
  sx={{
    backgroundColor: 'background.paper',
    borderRadius: 2,
    p: 2,
    boxShadow: 1
  }}
>
  {/* Component content */}
</Box>
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL service is running
   - Verify connection credentials in env.local
   - Ensure database exists

2. **File Upload Fails**
   - Check uploads directory permissions
   - Verify file size limits
   - Check file type validation

3. **Video Calls Not Working**
   - Ensure WebRTC is supported in browser
   - Check microphone/camera permissions
   - Verify Socket.io connection

4. **Rate Limiting Issues**
   - Check rate limit configuration
   - Verify client IP detection
   - Check for proxy configurations

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Check system health
curl http://localhost:5000/api/health
```

## 📈 Performance Optimization

### Database Indexes
- Automatic index creation for common queries
- Composite indexes for user connections
- GIN indexes for JSONB fields

### File Management
- Efficient file storage with metadata
- Soft delete for file management
- Automatic cleanup of orphaned files

### Caching Strategy
- Redis integration for session data
- Database query result caching
- Static file caching

## 🔄 Updates & Maintenance

### Regular Maintenance
1. **Database Cleanup**: Remove old connections and notifications
2. **File Cleanup**: Remove orphaned uploads
3. **Log Rotation**: Manage application logs
4. **Security Updates**: Keep dependencies updated

### Monitoring
- Health check endpoint: `/api/health`
- System integration tests
- Performance metrics
- Error logging and alerting

## 📞 Support

For technical support or feature requests:
- Check the API documentation
- Review system logs
- Run integration tests
- Contact the development team

---

**🎉 Congratulations!** You now have a fully enhanced Hkup platform with advanced user connections, video capabilities, and enhanced file management.

