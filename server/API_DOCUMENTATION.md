# 🚀 Zerohook Platform API Documentation

## Overview
This document provides comprehensive API documentation for the Zerohook platform, including all endpoints for authentication, chat, payments, file uploads, user connections, and verification.

---

## 🔐 **Authentication Endpoints**

### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "phone": "string (optional)",
  "referralCode": "string (optional)"
}
```

**Response:**
```json
{
  "message": "Registration successful",
  "token": "JWT_TOKEN",
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "verificationTier": 1,
    "reputationScore": 100.0,
    "trustScore": 0.0,
    "createdAt": "timestamp"
  }
}
```

### POST `/api/auth/login`
Authenticate existing user.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "JWT_TOKEN",
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "verificationTier": 1,
    "reputationScore": 100.0,
    "trustScore": 0.0,
    "status": "active"
  }
}
```

---

## 💬 **Chat Endpoints**

### GET `/api/chat/conversations`
Get user's chat conversations.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "otherUser": {
        "id": "uuid",
        "username": "string",
        "verificationTier": 1,
        "profilePicture": "string"
      },
      "lastMessage": "string",
      "lastMessageTime": "timestamp",
      "createdAt": "timestamp",
      "status": "active"
    }
  ]
}
```

### GET `/api/chat/messages/:conversationId`
Get messages for a specific conversation.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "senderId": "uuid",
      "senderName": "string",
      "senderTier": 1,
      "content": "string",
      "messageType": "text|image|video|file|location|contact|service_inquiry",
      "metadata": {},
      "createdAt": "timestamp",
      "readAt": "timestamp",
      "isOwn": true
    }
  ]
}
```

### POST `/api/chat/send`
Send a message in a conversation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "conversationId": "uuid",
  "content": "string",
  "messageType": "text|image|video|file|location|contact|service_inquiry",
  "metadata": {}
}
```

### POST `/api/chat/conversation`
Create or get existing conversation with another user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "otherUserId": "uuid"
}
```

### POST `/api/chat/video-call`
Initiate or join video call.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "conversationId": "uuid",
  "action": "initiate|join|leave",
  "roomId": "string (optional)"
}
```

### POST `/api/chat/block-user`
Block a user from messaging.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "uuid"
}
```

---

## 🔗 **User Connection Endpoints**

### POST `/api/connections/contact-request`
Send a contact request to another user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "toUserId": "uuid",
  "message": "string (optional)",
  "connectionType": "contact_request|service_inquiry|video_call"
}
```

**Response:**
```json
{
  "success": true,
  "connectionId": "uuid",
  "message": "Contact request sent successfully"
}
```

### POST `/api/connections/respond`
Accept or reject a contact request.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "connectionId": "uuid",
  "action": "accept|reject"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Contact request accepted successfully",
  "status": "accepted"
}
```

### GET `/api/connections/user-connections`
Get user's connections and pending requests.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "connections": [
    {
      "id": "uuid",
      "connectionType": "contact_request",
      "message": "string",
      "status": "pending|accepted|rejected",
      "createdAt": "timestamp",
      "otherUser": {
        "id": "uuid",
        "username": "string",
        "verificationTier": 1,
        "profilePicture": "string"
      }
    }
  ]
}
```

### POST `/api/connections/service-inquiry`
Send a service inquiry message.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "toUserId": "uuid",
  "serviceId": "uuid",
  "message": "string"
}
```

**Response:**
```json
{
  "success": true,
  "conversationId": "uuid",
  "message": "Service inquiry sent successfully"
}
```

### GET `/api/connections/pending-requests`
Get user's pending contact requests.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "requests": [
    {
      "id": "uuid",
      "connectionType": "contact_request",
      "message": "string",
      "createdAt": "timestamp",
      "fromUser": {
        "username": "string",
        "verificationTier": 1,
        "profilePicture": "string"
      }
    }
  ]
}
```

### POST `/api/connections/block-user`
Block a user.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "uuid"
}
```

---

## 💳 **Payment Endpoints**

### POST `/api/payments/create-payment-intent`
Create Stripe payment intent for service booking.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "amount": 100.00,
  "currency": "usd|ngn|eur",
  "serviceId": "uuid",
  "description": "string"
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "transactionId": "uuid",
  "paymentIntentId": "pi_xxx"
}
```

### POST `/api/payments/confirm`
Confirm payment and update transaction status.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "paymentIntentId": "string",
  "transactionId": "uuid"
}
```

### GET `/api/payments/transactions`
Get user's payment transactions.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "transactions": [
    {
      "id": "uuid",
      "amount": 100.00,
      "status": "paid|pending|refunded",
      "serviceTitle": "string",
      "providerName": "string",
      "providerTier": 1,
      "createdAt": "timestamp"
    }
  ]
}
```

### POST `/api/payments/refund`
Request refund for a transaction.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "transactionId": "uuid",
  "reason": "string"
}
```

---

## 📸 **Enhanced File Upload Endpoints**

### POST `/api/uploads/profile-picture`
Upload profile picture (supports images and videos).

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data`
- `profilePicture`: File (max 50MB, images and videos)

**Response:**
```json
{
  "success": true,
  "message": "Profile picture updated successfully",
  "profilePicture": {
    "url": "string",
    "filename": "string",
    "fileSize": 12345,
    "mimeType": "video/mp4",
    "fileType": "video"
  }
}
```

### POST `/api/uploads/service-media`
Upload media for services (multiple files).

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data`
- `media`: Files array (max 10 files, 50MB each)
- `serviceId`: string

**Response:**
```json
{
  "success": true,
  "message": "Service media uploaded successfully",
  "files": [
    {
      "id": "string",
      "fileName": "string",
      "url": "string",
      "fileSize": 12345,
      "mimeType": "video/mp4",
      "fileType": "video"
    }
  ],
  "totalUploaded": 3
}
```

### POST `/api/uploads/user-video`
Upload user video content.

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data`
- `video`: File (max 50MB, video files only)

**Response:**
```json
{
  "success": true,
  "message": "Video uploaded successfully",
  "video": {
    "url": "string",
    "filename": "string",
    "fileSize": 12345,
    "mimeType": "video/mp4"
  }
}
```

### GET `/api/uploads/user-files`
Get user's uploaded files.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "id": "uuid",
      "fileName": "string",
      "url": "string",
      "fileSize": 12345,
      "mimeType": "video/mp4",
      "uploadType": "user_video",
      "createdAt": "timestamp"
    }
  ]
}
```

### DELETE `/api/uploads/:fileId`
Delete uploaded file.

**Headers:** `Authorization: Bearer <token>`

---

## 🔍 **Verification Endpoints**

### POST `/api/verification/submit-documents`
Submit verification documents.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "documentType": "passport|national_id|drivers_license|utility_bill",
  "documentNumber": "string",
  "documentImages": ["url1", "url2"],
  "verificationTier": 2
}
```

### POST `/api/verification/verify-phone`
Verify phone number with OTP.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otp": "123456"
}
```

### POST `/api/verification/verify-email`
Verify email address with OTP.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

---

## 📱 **Video System Features**

The platform now supports comprehensive video functionality:

### Video Upload
- **Profile Videos**: Users can upload video introductions
- **Service Media**: Service providers can upload video demonstrations
- **Video Messages**: Send video messages in conversations
- **File Support**: MP4, AVI, MOV, WMV, FLV, WebM, MKV formats
- **Size Limit**: Up to 50MB per video file

### Video Calls
- **One-on-One Calls**: Direct video calls between users
- **Screen Sharing**: Share screen during calls
- **Call Controls**: Mute/unmute, video on/off
- **Call Duration**: Track call length
- **Call History**: Maintain call logs

### Video Messaging
- **Video Replies**: Respond with video messages
- **Video Chat**: Enhanced conversation experience
- **Video Storage**: Secure video storage and retrieval
- **Video Playback**: Built-in video player with controls

---

## 🚀 **Getting Started**

### 1. Environment Setup
```bash
# Copy environment file
cp env.example env.local

# Configure your environment variables
DATABASE_URL=postgresql://username:password@localhost:5432/hkup_db
JWT_SECRET=your_jwt_secret_key_here
```

### 2. Database Setup
```bash
# Run database setup
node setup-database.js
```

### 3. Start Server
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Test API
```bash
# Test authentication
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

---

## 📊 **Response Codes**

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## 🔒 **Security Features**

- JWT-based authentication
- Rate limiting
- Input validation
- SQL injection prevention
- File type validation
- File size limits
- Secure file storage

---

## 📈 **Performance Features**

- Database indexing
- File compression
- CDN-ready file URLs
- Efficient queries
- Connection pooling
- Redis caching

---

For more information, contact the development team or refer to the source code documentation.
