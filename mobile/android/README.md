# Zerohook Android App

A native Android implementation of the Zerohook adult services marketplace platform.

## Tech Stack

- **Language**: Kotlin 1.9.21
- **UI**: Jetpack Compose 1.5.4
- **Architecture**: MVVM + Clean Architecture
- **Dependency Injection**: Hilt 2.48.1
- **Networking**: Retrofit 2.9.0 + OkHttp 4.12.0
- **Database**: Room 2.6.1
- **Preferences**: DataStore
- **Image Loading**: Coil 2.5.0
- **Real-time**: Socket.IO 2.1.0
- **Background Work**: WorkManager 2.9.0
- **Navigation**: Navigation Compose 2.7.5

## Project Structure

```
app/src/main/java/com/zerohook/app/
├── ZerohookApplication.kt     # Application class with Hilt, Coil setup
├── MainActivity.kt            # Single activity entry point
├── data/
│   ├── local/
│   │   ├── ZerohookDatabase.kt    # Room database
│   │   ├── PreferencesManager.kt  # DataStore preferences
│   │   ├── entity/                # Room entities
│   │   └── dao/                   # Data Access Objects
│   ├── remote/
│   │   ├── ZerohookApiService.kt  # Retrofit API interface
│   │   └── SocketManager.kt       # Socket.IO manager
│   ├── repository/
│   │   ├── AuthRepository.kt      # Authentication logic
│   │   ├── ProfileRepository.kt   # Profile/browse logic
│   │   └── ChatRepository.kt      # Chat/messaging logic
│   ├── model/
│   │   ├── User.kt               # User models (DTO, Entity, Domain)
│   │   ├── Profile.kt            # Profile models
│   │   └── Chat.kt               # Chat/message models
│   └── worker/
│       ├── MessageSyncWorker.kt   # Sync pending messages
│       └── ProfileSyncWorker.kt   # Cache profiles for offline
├── di/
│   └── AppModule.kt              # Hilt dependency modules
├── features/
│   ├── auth/
│   │   ├── WelcomeScreen.kt
│   │   ├── LoginScreen.kt
│   │   ├── RegisterScreen.kt
│   │   └── *ViewModel.kt
│   ├── feed/
│   │   ├── FeedScreen.kt         # TikTok-style profile feed
│   │   └── FeedViewModel.kt
│   ├── chat/
│   │   ├── ChatListScreen.kt     # Conversation list
│   │   ├── ConversationScreen.kt # Individual chat
│   │   └── *ViewModel.kt
│   ├── wallet/
│   │   ├── WalletScreen.kt       # Balance, transactions
│   │   └── WalletViewModel.kt
│   ├── profile/
│   │   ├── ProfileScreen.kt      # My profile
│   │   ├── ProfileDetailScreen.kt # View other profiles
│   │   └── *ViewModel.kt
│   └── subscription/
│       ├── SubscriptionScreen.kt # Premium plans
│       └── SubscriptionViewModel.kt
├── navigation/
│   ├── Screen.kt                 # Route definitions
│   └── ZerohookNavHost.kt        # Navigation graph
├── ui/
│   ├── components/
│   │   └── BottomNavBar.kt       # Bottom navigation
│   └── theme/
│       ├── Color.kt              # Color definitions
│       ├── Type.kt               # Typography
│       └── Theme.kt              # Material theme
└── util/
    ├── NetworkResult.kt          # API response wrapper
    └── Utils.kt                  # Utility functions
```

## Features

### Offline-First Architecture
- Room database caches profiles, conversations, and messages
- Messages queue locally when offline, sync via WorkManager when online
- OkHttp cache with 7-day offline max-stale
- Coil image caching (25% memory, 100MB disk)

### Real-time Communication
- Socket.IO for instant messaging
- Typing indicators
- Online/offline presence
- Video/voice call signaling

### Security
- JWT authentication with secure token storage
- HTTPS-only in production
- DataStore for encrypted preferences
- Network security config

### UI/UX
- Dark theme matching web app
- TikTok-style vertical swipe feed
- Smooth animations and transitions
- Material 3 components

## Building

### Requirements
- Android Studio Hedgehog or later
- JDK 17
- Android SDK 34
- Kotlin 1.9.21

### Setup
1. Open project in Android Studio
2. Sync Gradle files
3. Run on emulator or device (API 26+)

### Build Commands
```bash
# Debug build
./gradlew assembleDebug

# Release build
./gradlew assembleRelease

# Run tests
./gradlew test

# Lint check
./gradlew lint
```

## Configuration

### API Base URL
Set in `AppModule.kt`:
```kotlin
private const val BASE_URL = "https://zerohook-api.onrender.com/api/"
```

### Environment Variables
Create `local.properties`:
```properties
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
```

## Backend API

Points to the Zerohook backend at `zerohook-api.onrender.com`.

### Key Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/users/browse` - Browse profiles
- `GET /api/chat/conversations` - Get conversations
- `POST /api/chat/send` - Send message
- `POST /api/payments/paystack/*` - Payment operations

## License

Proprietary - Zerohook Platform
