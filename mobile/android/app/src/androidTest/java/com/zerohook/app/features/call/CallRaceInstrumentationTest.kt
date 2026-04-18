package com.zerohook.app.features.call

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.zerohook.app.data.local.TokenManager
import com.zerohook.app.services.NotificationHelper
import com.zerohook.app.services.SocketManager
import com.zerohook.app.services.WebRTCManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CallRaceInstrumentationTest {

    private lateinit var socketManager: SocketManager
    private lateinit var webRTCManager: WebRTCManager
    private lateinit var notificationHelper: NotificationHelper
    private lateinit var viewModel: CallViewModel

    @Before
    fun setUp() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext
        val tokenManager = TokenManager(appContext)
        socketManager = SocketManager(tokenManager)
        webRTCManager = WebRTCManager(appContext, socketManager)
        notificationHelper = NotificationHelper(appContext)
        viewModel = CallViewModel(socketManager, webRTCManager, notificationHelper, appContext)
        CallViewModel.setIncomingTimeoutOverrideForTesting(120L)
    }

    @After
    fun tearDown() {
        viewModel.resetState()
        CallViewModel.setIncomingTimeoutOverrideForTesting(null)
        webRTCManager.release()
        socketManager.disconnect()
    }

    @Test
    fun incomingCall_autoTimeout_movesToEnded() = runBlocking {
        viewModel.bootstrapIncomingCall(
            callerId = "caller-timeout",
            callerName = "Timeout Caller",
            callType = "audio",
            callId = "call-timeout"
        )

        assertEquals(CallViewModel.CallPhase.INCOMING, viewModel.uiState.value.phase)
        awaitPhase(CallViewModel.CallPhase.ENDED)
        assertEquals(CallViewModel.CallPhase.ENDED, viewModel.uiState.value.phase)
    }

    @Test
    fun lateCancelledAfterTimeout_keepsEndedState() = runBlocking {
        viewModel.bootstrapIncomingCall(
            callerId = "caller-race",
            callerName = "Race Caller",
            callType = "video",
            callId = "call-race"
        )

        awaitPhase(CallViewModel.CallPhase.ENDED)

        socketManager.emitCallEventForTesting(
            SocketManager.CallSignalEvent(
                type = SocketManager.CallSignalType.CANCELLED,
                callerId = "caller-race",
                callId = "call-race"
            )
        )

        delay(80)
        assertEquals(CallViewModel.CallPhase.ENDED, viewModel.uiState.value.phase)
    }

    @Test
    fun cancelledBeforeTimeout_movesToEndedImmediately() = runBlocking {
        viewModel.bootstrapIncomingCall(
            callerId = "caller-cancel",
            callerName = "Cancel Caller",
            callType = "audio",
            callId = "call-cancel"
        )

        socketManager.emitCallEventForTesting(
            SocketManager.CallSignalEvent(
                type = SocketManager.CallSignalType.CANCELLED,
                callerId = "caller-cancel",
                callId = "call-cancel"
            )
        )

        awaitPhase(CallViewModel.CallPhase.ENDED)
        assertEquals(CallViewModel.CallPhase.ENDED, viewModel.uiState.value.phase)
    }

    private suspend fun awaitPhase(expected: CallViewModel.CallPhase) {
        withTimeout(2_500L) {
            while (viewModel.uiState.value.phase != expected) {
                delay(20)
            }
        }
    }
}
