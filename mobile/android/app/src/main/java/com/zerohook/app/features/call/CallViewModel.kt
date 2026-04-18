package com.zerohook.app.features.call

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.annotation.VisibleForTesting
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zerohook.app.features.call.service.VideoCallService
import com.zerohook.app.services.NotificationHelper
import com.zerohook.app.services.SocketManager
import com.zerohook.app.services.WebRTCManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import org.webrtc.SessionDescription
import org.webrtc.VideoTrack
import javax.inject.Inject

/**
 * Call ViewModel — manages call lifecycle, WebRTC, and call UI state.
 *
 * ## Web audit fixes applied:
 * 1. TURN servers are configured in WebRTCManager (the #1 call failure cause).
 * 2. Media fallback: if video denied, proceeds with audio-only.
 * 3. ICE candidates are queued until remote description is set.
 * 4. end_call guards against self-reference.
 */
@HiltViewModel
class CallViewModel @Inject constructor(
    private val socketManager: SocketManager,
    private val webRTCManager: WebRTCManager,
    private val notificationHelper: NotificationHelper,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    companion object {
        private const val TAG = "CallViewModel"
        private const val CALL_TIMEOUT_MS = 30_000L  // 30 seconds ring timeout
        private const val DEFAULT_INCOMING_TIMEOUT_MS = 35_000L

        @Volatile
        private var incomingTimeoutOverrideMs: Long? = null

        @VisibleForTesting
        fun setIncomingTimeoutOverrideForTesting(timeoutMs: Long?) {
            incomingTimeoutOverrideMs = timeoutMs
        }

        private fun incomingTimeoutMs(): Long {
            return incomingTimeoutOverrideMs ?: DEFAULT_INCOMING_TIMEOUT_MS
        }
    }

    // ─── State ──────────────────────────────────────────────────────────

    data class CallUiState(
        val phase: CallPhase = CallPhase.IDLE,
        val callType: String = "audio",
        val remoteUserId: String = "",
        val remoteUserName: String = "",
        val isMuted: Boolean = false,
        val isCameraOff: Boolean = false,
        val isAudioOnly: Boolean = false,
        val autoAccept: Boolean = false
    )

    enum class CallPhase { IDLE, OUTGOING, INCOMING, CONNECTING, ACTIVE, ENDED }

    private val _uiState = MutableStateFlow(CallUiState())
    val uiState: StateFlow<CallUiState> = _uiState.asStateFlow()

    val remoteVideoTrack: StateFlow<VideoTrack?> = webRTCManager.remoteVideoTrack
    val localVideoTrack: StateFlow<VideoTrack?> = webRTCManager.localVideoTrackFlow

    private var callTimeoutJob: Job? = null
    private var incomingTimeoutJob: Job? = null
    private var activeCallId: String? = null

    // ─── Init ───────────────────────────────────────────────────────────

    init {
        observeCallSignals()
        observeWebRTCState()
    }

    // ─── Public API ─────────────────────────────────────────────────────

    /** Initiate an outgoing call. */
    fun startCall(targetUserId: String, targetName: String, callType: String = "audio") {
        if (_uiState.value.phase != CallPhase.IDLE) return

        activeCallId = null
        _uiState.update {
            it.copy(
                phase = CallPhase.OUTGOING,
                callType = callType,
                remoteUserId = targetUserId,
                remoteUserName = targetName
            )
        }

        // Notify remote user via socket
        socketManager.emitCallRequest(targetUserId, callType)
        startCallForegroundService(targetName, callType, targetUserId)

        // FIX: Start call timeout — if callee never answers, cancel after 30s
        callTimeoutJob?.cancel()
        callTimeoutJob = viewModelScope.launch {
            delay(CALL_TIMEOUT_MS)
            if (_uiState.value.phase == CallPhase.OUTGOING) {
                Log.d(TAG, "Call timed out after ${CALL_TIMEOUT_MS}ms")
                socketManager.emitCallTimeout(targetUserId, activeCallId)
                activeCallId = null
                webRTCManager.cleanup()
                stopCallForegroundService()
                _uiState.update { it.copy(phase = CallPhase.ENDED) }
            }
        }
    }

    /** Accept an incoming call. */
    fun acceptCall() {
        val state = _uiState.value
        if (state.phase != CallPhase.INCOMING) return

        incomingTimeoutJob?.cancel()
        prepareAcceptedIncomingCall(state)
        socketManager.emitCallAccepted(state.remoteUserId, state.callType, activeCallId)
    }

    /**
     * Start an incoming call that was already accepted through a notification action.
     * We still emit socket acceptance as a fallback when the background REST accept
     * has not reached the server yet.
     */
    fun beginAcceptedIncomingCall(notifyServer: Boolean = true) {
        val state = _uiState.value
        if (state.phase != CallPhase.INCOMING) return

        incomingTimeoutJob?.cancel()
        prepareAcceptedIncomingCall(state)
        if (notifyServer && state.remoteUserId.isNotBlank()) {
            socketManager.emitCallAccepted(state.remoteUserId, state.callType, activeCallId)
        }
    }

    /** Reject an incoming call. */
    fun rejectCall() {
        val state = _uiState.value
        if (state.phase != CallPhase.INCOMING) return

        incomingTimeoutJob?.cancel()
        socketManager.emitCallRejected(state.remoteUserId, activeCallId)
        notificationHelper.cancelCallNotification()
        stopCallForegroundService()
        resetState()
    }

    /** End the current call. */
    fun endCall() {
        callTimeoutJob?.cancel()
        incomingTimeoutJob?.cancel()
        val remoteId = _uiState.value.remoteUserId
        if (remoteId.isNotEmpty()) {
            socketManager.emitEndCall(remoteId, activeCallId)
        }
        webRTCManager.cleanup()
        notificationHelper.cancelCallNotification()
        stopCallForegroundService()
        _uiState.update { it.copy(phase = CallPhase.ENDED) }
    }

    fun toggleMute() {
        val muted = webRTCManager.toggleMute()
        _uiState.update { it.copy(isMuted = muted) }
    }

    fun toggleCamera() {
        val camOff = webRTCManager.toggleCamera()
        _uiState.update { it.copy(isCameraOff = camOff) }
    }

    fun switchCamera() {
        webRTCManager.switchCamera()
    }

    fun getEglContext() = webRTCManager.getEglContext()

    fun bootstrapIncomingCall(
        callerId: String,
        callerName: String,
        callType: String,
        callId: String? = null,
        autoAccept: Boolean = false
    ) {
        if (callerId.isBlank()) return

        val currentState = _uiState.value
        if (currentState.phase != CallPhase.IDLE &&
            !(currentState.phase == CallPhase.INCOMING && currentState.remoteUserId == callerId)
        ) {
            return
        }

        activeCallId = callId ?: activeCallId
        _uiState.update {
            it.copy(
                phase = CallPhase.INCOMING,
                callType = if (callType == "audio") "audio" else "video",
                remoteUserId = callerId,
                remoteUserName = callerName,
                autoAccept = it.autoAccept || autoAccept
            )
        }
        scheduleIncomingTimeout()
    }

    fun clearAutoAccept() {
        _uiState.update { state ->
            if (state.autoAccept) state.copy(autoAccept = false) else state
        }
    }

    /** Reset to idle state. */
    fun resetState() {
        callTimeoutJob?.cancel()
        incomingTimeoutJob?.cancel()
        activeCallId = null
        webRTCManager.cleanup()
        stopCallForegroundService()
        _uiState.value = CallUiState()
    }

    // ─── Socket signal observers ────────────────────────────────────────

    private fun observeCallSignals() {
        viewModelScope.launch {
            socketManager.callEvents.collect { event ->
                when (event.type) {
                    SocketManager.CallSignalType.REQUEST_SENT -> {
                        if (event.callId.isNotBlank()) {
                            activeCallId = event.callId
                            Log.d(TAG, "Outgoing call id assigned: ${event.callId}")
                            val state = _uiState.value
                            if (state.phase == CallPhase.OUTGOING) {
                                startCallForegroundService(
                                    state.remoteUserName,
                                    state.callType,
                                    state.remoteUserId,
                                    event.callId
                                )
                            }
                        }
                    }

                    SocketManager.CallSignalType.INCOMING -> {
                        if (_uiState.value.phase != CallPhase.IDLE) {
                            if (event.callerId.isNotBlank()) {
                                socketManager.emitCallRejected(
                                    callerId = event.callerId,
                                    callId = event.callId.ifBlank { null },
                                    reason = "busy"
                                )
                            }
                            return@collect
                        }
                        activeCallId = event.callId.ifBlank { null }
                        _uiState.update {
                            it.copy(
                                phase = CallPhase.INCOMING,
                                callType = event.callType,
                                remoteUserId = event.callerId,
                                remoteUserName = event.callerName
                            )
                        }
                        scheduleIncomingTimeout()
                        notificationHelper.showIncomingCallNotification(
                            callerName = event.callerName,
                            callType = event.callType,
                            callerId = event.callerId,
                            callId = event.callId
                        )
                    }

                    SocketManager.CallSignalType.ACCEPTED -> {
                        if (_uiState.value.phase != CallPhase.OUTGOING) {
                            Log.d(TAG, "Ignoring call_accepted while phase=${_uiState.value.phase}")
                            return@collect
                        }
                        callTimeoutJob?.cancel()  // Callee answered — cancel timeout
                        incomingTimeoutJob?.cancel()
                        if (event.callId.isNotBlank()) {
                            activeCallId = event.callId
                        }
                        _uiState.update { it.copy(phase = CallPhase.CONNECTING) }

                        val remoteId = _uiState.value.remoteUserId
                        val videoEnabled = _uiState.value.callType == "video"
                        webRTCManager.initialize()
                        webRTCManager.startLocalMedia(videoEnabled)
                        if (webRTCManager.isAudioOnly.value && videoEnabled) {
                            _uiState.update { it.copy(isAudioOnly = true) }
                            Log.w(TAG, "Camera unavailable — proceeding as audio-only")
                        }
                        if (remoteId.isNotBlank()) {
                            webRTCManager.createPeerConnection(remoteId)
                        }

                        // FIX: NOW create and send the offer — callee has a PeerConnection
                        webRTCManager.createOffer()
                        startCallForegroundService(
                            _uiState.value.remoteUserName,
                            _uiState.value.callType,
                            remoteId,
                            activeCallId
                        )
                    }

                    SocketManager.CallSignalType.REJECTED -> {
                        Log.d(TAG, "Call rejected by remote")
                        incomingTimeoutJob?.cancel()
                        activeCallId = null
                        webRTCManager.cleanup()
                        notificationHelper.cancelCallNotification()
                        stopCallForegroundService()
                        _uiState.update { it.copy(phase = CallPhase.ENDED) }
                    }

                    SocketManager.CallSignalType.ENDED -> {
                        Log.d(TAG, "Call ended by remote")
                        incomingTimeoutJob?.cancel()
                        activeCallId = null
                        webRTCManager.cleanup()
                        notificationHelper.cancelCallNotification()
                        stopCallForegroundService()
                        _uiState.update { it.copy(phase = CallPhase.ENDED) }
                    }

                    SocketManager.CallSignalType.CANCELLED -> {
                        Log.d(TAG, "Call cancelled/timed out by remote")
                        incomingTimeoutJob?.cancel()
                        activeCallId = null
                        webRTCManager.cleanup()
                        notificationHelper.cancelCallNotification()
                        stopCallForegroundService()
                        _uiState.update { it.copy(phase = CallPhase.ENDED) }
                    }

                    SocketManager.CallSignalType.OFFER -> {
                        if (_uiState.value.phase != CallPhase.CONNECTING &&
                            _uiState.value.phase != CallPhase.ACTIVE
                        ) {
                            Log.d(TAG, "Ignoring offer while phase=${_uiState.value.phase}")
                            return@collect
                        }
                        if (event.sdp.isBlank()) {
                            Log.w(TAG, "Ignoring empty WebRTC offer")
                            return@collect
                        }
                        // Set remote offer description then create answer
                        webRTCManager.setRemoteDescription(event.sdp, SessionDescription.Type.OFFER)
                        webRTCManager.createAnswer()
                    }

                    SocketManager.CallSignalType.ANSWER -> {
                        if (_uiState.value.phase != CallPhase.CONNECTING &&
                            _uiState.value.phase != CallPhase.ACTIVE
                        ) {
                            Log.d(TAG, "Ignoring answer while phase=${_uiState.value.phase}")
                            return@collect
                        }
                        if (event.sdp.isBlank()) {
                            Log.w(TAG, "Ignoring empty WebRTC answer")
                            return@collect
                        }
                        webRTCManager.setRemoteDescription(event.sdp, SessionDescription.Type.ANSWER)
                    }

                    SocketManager.CallSignalType.ICE_CANDIDATE -> {
                        // FIX: ICE candidates are queued in WebRTCManager if
                        // remote description hasn't been set yet
                        event.candidate?.let { webRTCManager.addIceCandidate(it) }
                    }
                }
            }
        }
    }

    private fun observeWebRTCState() {
        viewModelScope.launch {
            webRTCManager.callState.collect { state ->
                when (state) {
                    WebRTCManager.CallState.CONNECTED -> {
                        _uiState.update { it.copy(phase = CallPhase.ACTIVE) }
                    }
                    WebRTCManager.CallState.ENDED -> {
                        _uiState.update { it.copy(phase = CallPhase.ENDED) }
                    }
                    else -> {}
                }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        if (_uiState.value.phase != CallPhase.IDLE) {
            endCall()
        }
    }

    private fun scheduleIncomingTimeout() {
        incomingTimeoutJob?.cancel()
        incomingTimeoutJob = viewModelScope.launch {
            delay(incomingTimeoutMs())
            if (_uiState.value.phase == CallPhase.INCOMING) {
                Log.d(TAG, "Incoming call timed out locally")
                activeCallId = null
                notificationHelper.cancelCallNotification()
                webRTCManager.cleanup()
                stopCallForegroundService()
                _uiState.update { it.copy(phase = CallPhase.ENDED, autoAccept = false) }
            }
        }
    }

    private fun startCallForegroundService(
        remoteName: String,
        callType: String,
        remoteUserId: String,
        callId: String? = null
    ) {
        val intent = Intent(appContext, VideoCallService::class.java).apply {
            action = VideoCallService.ACTION_START
            putExtra(VideoCallService.EXTRA_REMOTE_NAME, remoteName)
            putExtra(VideoCallService.EXTRA_CALL_TYPE, callType)
            putExtra(VideoCallService.EXTRA_REMOTE_USER_ID, remoteUserId)
            putExtra(VideoCallService.EXTRA_CALL_ID, callId)
        }
        ContextCompat.startForegroundService(appContext, intent)
    }

    private fun stopCallForegroundService(notifyRemote: Boolean = false) {
        val intent = Intent(appContext, VideoCallService::class.java).apply {
            action = VideoCallService.ACTION_STOP
            putExtra(VideoCallService.EXTRA_NOTIFY_REMOTE, notifyRemote)
        }
        appContext.startService(intent)
    }

    private fun prepareAcceptedIncomingCall(state: CallUiState) {
        _uiState.update { it.copy(phase = CallPhase.CONNECTING, autoAccept = false) }
        notificationHelper.cancelCallNotification()

        // Initialize media
        webRTCManager.initialize()
        val videoEnabled = state.callType == "video"
        webRTCManager.startLocalMedia(videoEnabled)

        if (webRTCManager.isAudioOnly.value && state.callType == "video") {
            _uiState.update { it.copy(isAudioOnly = true) }
            Log.w(TAG, "Camera unavailable — proceeding as audio-only")
        }

        // Create PeerConnection — answer will be created when offer arrives
        webRTCManager.createPeerConnection(state.remoteUserId)
        startCallForegroundService(state.remoteUserName, state.callType, state.remoteUserId, activeCallId)
    }
}
