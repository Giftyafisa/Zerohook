package com.zerohook.app.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.zerohook.app.MainActivity
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.dto.CallActionRequest
import com.zerohook.app.services.NotificationHelper
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class CallNotificationActionReceiver : BroadcastReceiver() {

    @Inject lateinit var apiService: ApiService
    @Inject lateinit var notificationHelper: NotificationHelper

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()
        val action = intent.action.orEmpty()
        val callId = intent.getStringExtra(EXTRA_CALL_ID).orEmpty()
        val callerId = intent.getStringExtra(EXTRA_CALLER_ID).orEmpty()
        val callerName = intent.getStringExtra(EXTRA_CALLER_NAME).orEmpty().ifBlank { "Someone" }
        val callType = intent.getStringExtra(EXTRA_CALL_TYPE).orEmpty().ifBlank { "audio" }

        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                when (action) {
                    ACTION_ANSWER_CALL -> handleAnswer(context, callId, callerId, callerName, callType)
                    ACTION_DECLINE_CALL -> handleDecline(callId)
                    else -> Log.w(TAG, "Ignoring unknown call notification action: $action")
                }
            } finally {
                pendingResult.finish()
            }
        }
    }

    private suspend fun handleAnswer(
        context: Context,
        callId: String,
        callerId: String,
        callerName: String,
        callType: String
    ) {
        if (callerId.isBlank()) {
            Log.w(TAG, "Missing caller metadata for answer action")
            notificationHelper.cancelCallNotification()
            launchCallUi(
                context = context,
                callerId = callerId,
                callerName = callerName,
                callType = callType,
                callId = callId,
                autoAccept = false
            )
            return
        }

        // Open the call screen immediately for responsive UX, then acknowledge server.
        notificationHelper.cancelCallNotification()
        launchCallUi(
            context = context,
            callerId = callerId,
            callerName = callerName,
            callType = callType,
            callId = callId,
            autoAccept = true
        )

        if (callId.isBlank()) {
            Log.w(TAG, "Answer action missing callId, relying on socket fallback")
            return
        }

        val response = apiService.acceptCall(CallActionRequest(callId = callId))
        if (!response.isSuccessful || response.body()?.success == false) {
            Log.w(TAG, "Background call accept failed: ${response.code()}")
        }
    }

    private suspend fun handleDecline(callId: String) {
        if (callId.isBlank()) {
            Log.w(TAG, "Missing callId for decline action")
            notificationHelper.cancelCallNotification()
            return
        }

        val response = apiService.rejectCall(CallActionRequest(callId = callId))
        if (!response.isSuccessful) {
            Log.w(TAG, "Call reject failed: ${response.code()}")
        }
        notificationHelper.cancelCallNotification()
    }

    private fun launchCallUi(
        context: Context,
        callerId: String,
        callerName: String,
        callType: String,
        callId: String,
        autoAccept: Boolean
    ) {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("incomingCall", true)
            putExtra("autoAcceptCall", autoAccept)
            putExtra("callerId", callerId)
            putExtra("callerName", callerName)
            putExtra("callType", callType)
            putExtra("callId", callId)
        }
        ContextCompat.startActivity(context, launchIntent, null)
    }

    companion object {
        private const val TAG = "CallNotifActionRecv"

        const val ACTION_ANSWER_CALL = "com.zerohook.app.action.ANSWER_CALL"
        const val ACTION_DECLINE_CALL = "com.zerohook.app.action.DECLINE_CALL"

        const val EXTRA_CALL_ID = "extra_call_id"
        const val EXTRA_CALLER_ID = "extra_caller_id"
        const val EXTRA_CALLER_NAME = "extra_caller_name"
        const val EXTRA_CALL_TYPE = "extra_call_type"
    }
}