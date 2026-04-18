package com.zerohook.app.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.zerohook.app.MainActivity
import com.zerohook.app.R
import com.zerohook.app.receivers.CallNotificationActionReceiver
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Notification helper — creates channels and shows local notifications.
 *
 * ## Fix from web audit:
 * - Does NOT show a notification for "message" type events when the
 *   conversation is currently active (prevents double-notification).
 * - The caller (ChatViewModel) is responsible for checking whether the
 *   conversation is active before calling [showMessageNotification].
 */
@Singleton
class NotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        const val CHANNEL_MESSAGES = "zerohook_messages"
        const val CHANNEL_CALLS = "zerohook_calls_v2"
        private const val CHANNEL_CALLS_LEGACY = "zerohook_calls"
        const val CHANNEL_GENERAL = "zerohook_general"
        private var nextId = 2000
    }

    init {
        createChannels()
    }

    private fun createChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = context.getSystemService(NotificationManager::class.java)
            val callSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_MESSAGES, "Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Chat message notifications"
                    enableVibration(true)
                }
            )

            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_CALLS, "Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Incoming call notifications"
                    enableVibration(true)
                    setSound(
                        callSoundUri,
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                }
            )

            // Migration: old installs may already have a silent "zerohook_calls" channel.
            // Delete it so new notifications always use the versioned ringing channel.
            if (manager.getNotificationChannel(CHANNEL_CALLS_LEGACY) != null) {
                manager.deleteNotificationChannel(CHANNEL_CALLS_LEGACY)
            }

            manager.createNotificationChannel(
                NotificationChannel(CHANNEL_GENERAL, "General", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "General notifications"
                }
            )
        }
    }

    /**
     * Show a notification for an incoming chat message.
     * The caller should NOT call this if the conversation is currently active
     * (to prevent double-notification — matching the web audit fix).
     */
    fun showMessageNotification(senderName: String, messagePreview: String, conversationId: String) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("conversationId", conversationId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, conversationId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_MESSAGES)
            .setSmallIcon(android.R.drawable.ic_dialog_email)
            .setContentTitle(senderName)
            .setContentText(messagePreview)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(nextId++, notification)
        } catch (_: SecurityException) {
            // Permission not granted — silently skip
        }
    }

    /**
     * Show a high-priority notification for an incoming call.
     */
    fun showIncomingCallNotification(
        callerName: String,
        callType: String,
        callerId: String? = null,
        callId: String? = null
    ) {
        val requestCodeBase = (callId ?: callerName).hashCode()

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("incomingCall", true)
            putExtra("callerName", callerName)
            putExtra("callType", callType)
            if (!callerId.isNullOrBlank()) putExtra("callerId", callerId)
            if (!callId.isNullOrBlank()) putExtra("callId", callId)
        }
        val pendingIntent = PendingIntent.getActivity(
            context, (callId ?: callerName).hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val answerIntent = Intent(context, CallNotificationActionReceiver::class.java).apply {
            action = CallNotificationActionReceiver.ACTION_ANSWER_CALL
            putExtra(CallNotificationActionReceiver.EXTRA_CALL_ID, callId)
            putExtra(CallNotificationActionReceiver.EXTRA_CALLER_ID, callerId)
            putExtra(CallNotificationActionReceiver.EXTRA_CALLER_NAME, callerName)
            putExtra(CallNotificationActionReceiver.EXTRA_CALL_TYPE, callType)
        }
        val answerPendingIntent = PendingIntent.getBroadcast(
            context,
            requestCodeBase,
            answerIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val declineIntent = Intent(context, CallNotificationActionReceiver::class.java).apply {
            action = CallNotificationActionReceiver.ACTION_DECLINE_CALL
            putExtra(CallNotificationActionReceiver.EXTRA_CALL_ID, callId)
            putExtra(CallNotificationActionReceiver.EXTRA_CALLER_ID, callerId)
            putExtra(CallNotificationActionReceiver.EXTRA_CALLER_NAME, callerName)
            putExtra(CallNotificationActionReceiver.EXTRA_CALL_TYPE, callType)
        }
        val declinePendingIntent = PendingIntent.getBroadcast(
            context,
            requestCodeBase + 1,
            declineIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_CALLS)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("Incoming ${callType.replaceFirstChar { it.uppercase() }} Call")
            .setContentText("$callerName is calling...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(false)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(pendingIntent, true)
            .addAction(android.R.drawable.ic_menu_call, "Answer", answerPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(1000, notification)
        } catch (_: SecurityException) {}
    }

    fun cancelCallNotification() {
        NotificationManagerCompat.from(context).cancel(1000)
    }

    fun showGeneralNotification(title: String, message: String) {
        val notification = NotificationCompat.Builder(context, CHANNEL_GENERAL)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(nextId++, notification)
        } catch (_: SecurityException) {}
    }
}
