package com.zerohook.app.features.call.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.zerohook.app.services.SocketManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import com.zerohook.app.MainActivity

/**
 * Foreground service for keeping video/audio calls alive when the app is in background.
 *
 * Android requires a foreground service with camera|microphone type to access
 * camera and microphone in the background (Android 14+). Without this service,
 * the OS kills the call when the user switches apps.
 *
 * The manifest declares this service with ndroid:foregroundServiceType="camera|microphone".
 */
@AndroidEntryPoint
class VideoCallService : Service() {

    @Inject
    lateinit var socketManager: SocketManager

    private var currentRemoteUserId: String? = null
    private var currentCallId: String? = null
    private var currentCallType: String = "audio"
    private var currentRemoteName: String = "Unknown"

    companion object {
        const val CHANNEL_ID = "zerohook_call_service"
        const val NOTIFICATION_ID = 3000
        const val ACTION_START = "com.zerohook.app.CALL_START"
        const val ACTION_STOP = "com.zerohook.app.CALL_STOP"
        const val EXTRA_CALL_TYPE = "call_type"
        const val EXTRA_REMOTE_NAME = "remote_name"
        const val EXTRA_REMOTE_USER_ID = "remote_user_id"
        const val EXTRA_CALL_ID = "call_id"
        const val EXTRA_NOTIFY_REMOTE = "notify_remote"
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                if (intent.getBooleanExtra(EXTRA_NOTIFY_REMOTE, false)) {
                    val remoteUserId = currentRemoteUserId
                    if (!remoteUserId.isNullOrBlank()) {
                        socketManager.emitEndCall(remoteUserId, currentCallId)
                    }
                }
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_START, null -> {
                currentCallType = intent?.getStringExtra(EXTRA_CALL_TYPE) ?: currentCallType
                currentRemoteName = intent?.getStringExtra(EXTRA_REMOTE_NAME) ?: currentRemoteName
                currentRemoteUserId = intent?.getStringExtra(EXTRA_REMOTE_USER_ID) ?: currentRemoteUserId
                currentCallId = intent?.getStringExtra(EXTRA_CALL_ID) ?: currentCallId
                val notification = buildNotification(currentCallType, currentRemoteName)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val serviceType = if (currentCallType == "video") {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    } else {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    }
                    startForeground(NOTIFICATION_ID, notification, serviceType)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
            }
        }
        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Active Call",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when a call is in progress"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(callType: String, remoteName: String): Notification {
        val pendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val stopIntent = PendingIntent.getService(
            this, 1,
            Intent(this, VideoCallService::class.java).apply {
                action = ACTION_STOP
                putExtra(EXTRA_NOTIFY_REMOTE, true)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val typeLabel = callType.replaceFirstChar { it.uppercase() }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("$typeLabel Call in Progress")
            .setContentText("In call with $remoteName")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setContentIntent(pendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End Call", stopIntent)
            .build()
    }
}
