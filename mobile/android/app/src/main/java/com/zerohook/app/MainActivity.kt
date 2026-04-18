package com.zerohook.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.zerohook.app.navigation.ZerohookNavHost
import com.zerohook.app.ui.theme.ZerohookTheme
import dagger.hilt.android.AndroidEntryPoint

/**
 * Main entry-point Activity for the Zerohook Android app.
 *
 * Uses Jetpack Compose for the UI layer, Hilt for dependency injection,
 * and a NavHost for screen navigation (auth → chat → calls).
 *
 * ## Fixes applied:
 * - Reads conversationId from notification intent → deep links to chat
 * - Handles onNewIntent for single-top mode (notification tap while running)
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    // FIX: Deep link support — notification taps pass conversationId via intent
    private val deepLinkConversationId = mutableStateOf<String?>(null)
    private val deepLinkParticipantId = mutableStateOf<String?>(null)
    private val deepLinkNonce = mutableLongStateOf(0L)
    private val incomingCallData = mutableStateOf<IncomingCallLaunchData?>(null)
    private val incomingCallNonce = mutableLongStateOf(0L)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        // Extract deep link from initial launch intent
        handleDeepLink(intent)

        setContent {
            ZerohookTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val convId by deepLinkConversationId
                    val participantId by deepLinkParticipantId
                    val nonce by deepLinkNonce
                    val pendingIncomingCall by incomingCallData
                    val pendingIncomingCallNonce by incomingCallNonce
                    ZerohookNavHost(
                        deepLinkConversationId = convId,
                        deepLinkParticipantId = participantId,
                        deepLinkNonce = nonce,
                        incomingCallLaunch = pendingIncomingCall,
                        incomingCallNonce = pendingIncomingCallNonce,
                        onDeepLinkConsumed = {
                            deepLinkConversationId.value = null
                            deepLinkParticipantId.value = null
                        },
                        onIncomingCallConsumed = {
                            incomingCallData.value = null
                        }
                    )
                }
            }
        }
    }

    // FIX: Handle notification tap when activity already exists (singleTop/clearTop)
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        if (intent == null) return

        val data = intent.data
        val conversationId =
            intent.getStringExtra("conversationId")
                ?: data?.getQueryParameter("conversationId")
                ?: data?.getQueryParameter("conversation")
                ?: data?.getQueryParameter("conversation_id")
                ?: data?.lastPathSegment?.takeIf {
                    val path = data.path.orEmpty().lowercase()
                    path.contains("messages") || path.contains("conversation")
                }

        val participant =
            intent.getStringExtra("participantId")
                ?: intent.getStringExtra("targetUserId")
                ?: intent.getStringExtra("userId")
                ?: data?.getQueryParameter("participantId")
                ?: data?.getQueryParameter("targetUserId")
                ?: data?.getQueryParameter("userId")
                ?: data?.getQueryParameter("otherUserId")
                ?: data?.getQueryParameter("recipientId")

        val incomingCall = intent.getBooleanExtra("incomingCall", false)
        if (incomingCall) {
            val callerId = intent.getStringExtra("callerId") ?: data?.getQueryParameter("callerId")
            val callerName = intent.getStringExtra("callerName") ?: data?.getQueryParameter("callerName")
            val callType = intent.getStringExtra("callType") ?: data?.getQueryParameter("callType") ?: "audio"
            val callId = intent.getStringExtra("callId") ?: data?.getQueryParameter("callId")
            val autoAccept = intent.getBooleanExtra("autoAcceptCall", false) ||
                data?.getQueryParameter("autoAcceptCall")?.equals("true", ignoreCase = true) == true
            if (!callerId.isNullOrBlank()) {
                incomingCallData.value = IncomingCallLaunchData(
                    callerId = callerId,
                    callerName = callerName ?: "Someone",
                    callType = callType,
                    callId = callId,
                    autoAccept = autoAccept
                )
                incomingCallNonce.longValue = incomingCallNonce.longValue + 1L
            }
        }

        var deepLinkFound = false
        if (!conversationId.isNullOrBlank()) {
            deepLinkConversationId.value = conversationId
            deepLinkFound = true
        }
        if (!participant.isNullOrBlank()) {
            deepLinkParticipantId.value = participant
            deepLinkFound = true
        }

        if (deepLinkFound) {
            deepLinkNonce.longValue = deepLinkNonce.longValue + 1L
        }
    }
}

data class IncomingCallLaunchData(
    val callerId: String,
    val callerName: String,
    val callType: String,
    val callId: String? = null,
    val autoAccept: Boolean = false
)
