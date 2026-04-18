package com.zerohook.app.services

import android.util.Log
import com.zerohook.app.ZerohookApplication
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.dto.RegisterDeviceTokenRequest
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Firebase Cloud Messaging service — handles push notifications when app is killed/background.
 *
 * Uses the free Firebase Spark plan (no credit card required).
 * FCM delivers data messages silently; this service shows local notifications
 * using NotificationHelper to keep the UX consistent with socket-driven notifications.
 *
 * ## Setup required:
 * 1. Create a free Firebase project at https://console.firebase.google.com
 * 2. Download google-services.json → place in app/ directory
 * 3. The server needs the Firebase Admin SDK to send pushes
 */
@AndroidEntryPoint
class ZerohookFirebaseMessaging : FirebaseMessagingService() {

    @Inject lateinit var notificationHelper: NotificationHelper
    @Inject lateinit var tokenManager: com.zerohook.app.data.local.TokenManager
    @Inject lateinit var apiService: ApiService

    companion object {
        private const val TAG = "ZerohookFCM"
    }

    /**
     * Called when a new FCM token is generated (first launch, token rotation, etc).
     * Sends the token to our server so it can target this device for push notifications.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token generated")
        CoroutineScope(Dispatchers.IO).launch {
            tokenManager.saveFcmToken(token)
            try {
                val res = apiService.registerDeviceToken(
                    RegisterDeviceTokenRequest(token = token)
                )
                if (!res.isSuccessful) {
                    Log.w(TAG, "Failed to register device token: ${res.code()}")
                }
            } catch (e: Exception) {
                Log.w(TAG, "Device token registration failed (will retry later)", e)
            }
        }
    }

    /**
     * Called when a data message arrives (works even when app is in background/killed).
     * We intentionally use DATA messages (not notification messages) so this handler
     * always fires — notification messages are auto-displayed by the system and bypass
     * this method when the app is backgrounded.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        val data = message.data
        val type = data["type"] ?: return

        Log.d(TAG, "Push received: type=$type")

        when (type) {
            "message" -> {
                if (ZerohookApplication.isInForeground) {
                    Log.d(TAG, "Skipping message push notification while app is foreground")
                    return
                }
                val senderName = data["senderName"]
                    ?: data["title"]?.removePrefix("New message from ")
                    ?: "Someone"
                val preview = data["preview"] ?: data["message"] ?: "New message"
                val conversationId = data["conversationId"] ?: return
                notificationHelper.showMessageNotification(senderName, preview, conversationId)
            }

            "call" -> {
                val callerName = data["callerName"] ?: "Someone"
                val callType = data["callType"] ?: "audio"
                val callerId = data["callerId"]
                val callId = data["callId"]
                notificationHelper.showIncomingCallNotification(
                    callerName = callerName,
                    callType = callType,
                    callerId = callerId,
                    callId = callId
                )
            }

            else -> {
                val title = data["title"] ?: "Zerohook"
                val body = data["body"] ?: data["message"] ?: return
                notificationHelper.showGeneralNotification(title, body)
            }
        }
    }
}
