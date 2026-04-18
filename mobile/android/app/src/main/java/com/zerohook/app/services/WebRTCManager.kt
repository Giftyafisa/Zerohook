package com.zerohook.app.services

import android.content.Context
import android.util.Log
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import org.webrtc.*
    import org.webrtc.audio.JavaAudioDeviceModule
import java.util.LinkedList
import javax.inject.Inject
import javax.inject.Singleton

/**
 * WebRTC manager — handles PeerConnection lifecycle, media streams, and ICE.
 *
 * ## Key fixes from web audit (CallSystem.js) baked in:
 * 1. **TURN servers configured** — uses free openrelay.metered.ca TURN on ports
 *    80/UDP, 443/UDP, and 443/TCP. Without TURN, calls fail behind symmetric
 *    NAT / mobile carriers. This was the #1 reason calls didn't work on web.
 *
 * 2. **Media fallback** — if camera access is denied, falls back to audio-only
 *    instead of failing entirely.
 *
 * 3. **ICE candidate queuing** — candidates received before the remote
 *    description is set are queued and applied once setRemoteDescription succeeds.
 *
 * 4. **Explicit play()** — on Android the equivalent is ensuring tracks are
 *    properly added to SurfaceViewRenderer (handled by the UI layer).
 */
@Singleton
class WebRTCManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val socketManager: SocketManager
) {
    companion object {
        private const val TAG = "WebRTCManager"

        /**
         * FIX: CRITICAL — TURN servers.
         * Without TURN, WebRTC only works on the same LAN or when both peers
         * have public IPs. Mobile carriers use symmetric NAT which blocks STUN-only.
         * These free servers work for dev; production should use paid TURN (Twilio/Xirsys).
         */
        private val ICE_SERVERS = listOf(
            // STUN
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer(),
            // TURN — UDP on port 80
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:80")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer(),
            // TURN — UDP on port 443
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:443")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer(),
            // TURN — TCP on port 443 (works through most corporate firewalls)
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:443?transport=tcp")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer()
        )
    }

    // ─── State ──────────────────────────────────────────────────────────

    private var factory: PeerConnectionFactory? = null
    private var audioDeviceModule: JavaAudioDeviceModule? = null
    private var peerConnection: PeerConnection? = null
    private var localStream: MediaStream? = null
    private var eglBase: EglBase? = null
    private var localVideoTrack: VideoTrack? = null
    private var localAudioTrack: AudioTrack? = null
    private var videoCapturer: CameraVideoCapturer? = null
    private var localTracksAttached = false

    @Volatile
    private var remoteDescriptionSet = false
    private val pendingIceCandidates = LinkedList<IceCandidate>()

    @Volatile
    private var targetUserId: String? = null

    private val _callState = MutableStateFlow(CallState.IDLE)
    val callState: StateFlow<CallState> = _callState.asStateFlow()

    private val _remoteVideoTrack = MutableStateFlow<VideoTrack?>(null)
    val remoteVideoTrack: StateFlow<VideoTrack?> = _remoteVideoTrack.asStateFlow()

    private val _localVideoTrackFlow = MutableStateFlow<VideoTrack?>(null)
    val localVideoTrackFlow: StateFlow<VideoTrack?> = _localVideoTrackFlow.asStateFlow()

    private val _isAudioOnly = MutableStateFlow(false)
    val isAudioOnly: StateFlow<Boolean> = _isAudioOnly.asStateFlow()

    // ─── Initialization ─────────────────────────────────────────────────

    fun initialize() {
        if (factory != null) return
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setFieldTrials("")
            .setEnableInternalTracer(false)
            .createInitializationOptions()
        PeerConnectionFactory.initialize(options)

        eglBase = EglBase.create()

        audioDeviceModule = JavaAudioDeviceModule.builder(context)
            .setUseHardwareAcousticEchoCanceler(true)
            .setUseHardwareNoiseSuppressor(true)
            .createAudioDeviceModule()

        factory = PeerConnectionFactory.builder()
            .setAudioDeviceModule(audioDeviceModule)
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(eglBase!!.eglBaseContext))
            .setVideoEncoderFactory(
                DefaultVideoEncoderFactory(eglBase!!.eglBaseContext, true, true)
            )
            .createPeerConnectionFactory()

        Log.d(TAG, "WebRTC initialized")
    }

    fun getEglContext(): EglBase.Context? = eglBase?.eglBaseContext

    // ─── Media ──────────────────────────────────────────────────────────

    /**
     * Acquires local media (camera + audio). If camera access fails,
     * falls back to audio-only. (FIX from web audit: media fallback)
     */
    fun startLocalMedia(videoEnabled: Boolean = true): Boolean {
        if (factory == null) initialize()

        // Audio — always try
        val audioConstraints = MediaConstraints()
        val audioSource = factory!!.createAudioSource(audioConstraints)
        localAudioTrack = factory!!.createAudioTrack("audio0", audioSource)

        // Video — try, but fall back to audio-only if denied
        if (videoEnabled) {
            try {
                val enumerator = Camera2Enumerator(context)
                val frontCamera = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) }
                    ?: enumerator.deviceNames.firstOrNull()

                if (frontCamera != null) {
                    videoCapturer = enumerator.createCapturer(frontCamera, null)
                    val surfaceHelper = SurfaceTextureHelper.create("CaptureThread", eglBase!!.eglBaseContext)
                    val videoSource = factory!!.createVideoSource(videoCapturer!!.isScreencast)
                    videoCapturer!!.initialize(surfaceHelper, context, videoSource.capturerObserver)
                    videoCapturer!!.startCapture(640, 480, 30)
                    localVideoTrack = factory!!.createVideoTrack("video0", videoSource)
                    _localVideoTrackFlow.value = localVideoTrack
                    _isAudioOnly.value = false
                    Log.d(TAG, "Video + audio captured")
                } else {
                    Log.w(TAG, "No camera available — audio only")
                    _isAudioOnly.value = true
                }
            } catch (e: Exception) {
                // FIX: Fallback to audio-only if camera fails
                Log.w(TAG, "Camera access failed, falling back to audio-only", e)
                _isAudioOnly.value = true
            }
        } else {
            _isAudioOnly.value = true
        }

        attachLocalTracksToPeerConnection()

        return true
    }

    // ─── PeerConnection ─────────────────────────────────────────────────

    /**
     * Creates the PeerConnection with TURN servers and sets up callbacks.
     */
    fun createPeerConnection(remoteUserId: String) {
        targetUserId = remoteUserId
        remoteDescriptionSet = false
        pendingIceCandidates.clear()

        val rtcConfig = PeerConnection.RTCConfiguration(ICE_SERVERS).apply {
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
            // iceTransportPolicy can be set to RELAY for testing TURN-only
        }

        peerConnection = factory!!.createPeerConnection(rtcConfig, object : PeerConnection.Observer {

            override fun onIceCandidate(candidate: IceCandidate) {
                Log.d(TAG, "ICE candidate: ${candidate.sdpMid}")
                val json = JSONObject().apply {
                    put("sdpMid", candidate.sdpMid)
                    put("sdpMLineIndex", candidate.sdpMLineIndex)
                    put("candidate", candidate.sdp)
                }
                socketManager.emitIceCandidate(remoteUserId, json)
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.d(TAG, "ICE connection: $state")
                when (state) {
                    PeerConnection.IceConnectionState.CONNECTED -> _callState.value = CallState.CONNECTED
                    PeerConnection.IceConnectionState.DISCONNECTED,
                    PeerConnection.IceConnectionState.FAILED -> {
                        _callState.value = CallState.ENDED
                        cleanup()
                    }
                    else -> {}
                }
            }

            override fun onTrack(transceiver: RtpTransceiver?) {
                val track = transceiver?.receiver?.track()
                Log.d(TAG, "Remote track received: ${track?.kind()}")
                if (track is VideoTrack) {
                    _remoteVideoTrack.value = track
                }
                // Audio tracks are automatically routed to the device speaker
            }

            override fun onSignalingChange(state: PeerConnection.SignalingState?) {}
            override fun onIceConnectionReceivingChange(receiving: Boolean) {}
            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {}
            override fun onAddStream(stream: MediaStream?) {}
            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel?) {}
            override fun onRenegotiationNeeded() {}
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {}
        })

        // Add local tracks to the peer connection
        localAudioTrack?.let { peerConnection!!.addTrack(it) }
        localVideoTrack?.let { peerConnection!!.addTrack(it) }
        localTracksAttached = localAudioTrack != null || localVideoTrack != null

        if (localAudioTrack == null && localVideoTrack == null) {
            Log.w(TAG, "⚠️ No local media tracks — peer will have no media to send")
        }

        Log.d(TAG, "PeerConnection created with ${ICE_SERVERS.size} ICE servers")
    }

    // ─── Offer / Answer ─────────────────────────────────────────────────

    fun createOffer() {
        val remoteId = targetUserId
        if (remoteId.isNullOrBlank()) {
            Log.e(TAG, "Cannot create offer: targetUserId is null")
            return
        }
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }
        peerConnection?.createOffer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                if (sdp == null) {
                    Log.e(TAG, "Offer creation returned null SDP")
                    return
                }
                peerConnection?.setLocalDescription(SdpObserverAdapter(), sdp)
                socketManager.emitOffer(remoteId, sdp.description)
                _callState.value = CallState.CALLING
                Log.d(TAG, "Offer created and sent")
            }
        }, constraints)
    }

    fun createAnswer() {
        val remoteId = targetUserId
        if (remoteId.isNullOrBlank()) {
            Log.e(TAG, "Cannot create answer: targetUserId is null")
            return
        }
        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }
        peerConnection?.createAnswer(object : SdpObserverAdapter() {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                if (sdp == null) {
                    Log.e(TAG, "Answer creation returned null SDP")
                    return
                }
                peerConnection?.setLocalDescription(SdpObserverAdapter(), sdp)
                socketManager.emitAnswer(remoteId, sdp.description)
                Log.d(TAG, "Answer created and sent")
            }
        }, constraints)
    }

    fun setRemoteDescription(sdp: String, type: SessionDescription.Type) {
        val sessionDescription = SessionDescription(type, sdp)
        peerConnection?.setRemoteDescription(object : SdpObserverAdapter() {
            override fun onSetSuccess() {
                Log.d(TAG, "Remote description set ($type)")
                remoteDescriptionSet = true
                // FIX: Drain queued ICE candidates
                drainPendingCandidates()
            }
        }, sessionDescription)
    }

    /**
     * Add a remote ICE candidate. If remote description hasn't been set yet,
     * queue it. (FIX from web audit: ICE candidate queuing)
     */
    fun addIceCandidate(candidateJson: JSONObject) {
        val candidate = IceCandidate(
            candidateJson.optString("sdpMid", ""),
            candidateJson.optInt("sdpMLineIndex", 0),
            candidateJson.optString("candidate", "")
        )

        if (remoteDescriptionSet) {
            peerConnection?.addIceCandidate(candidate)
        } else {
            Log.d(TAG, "Queuing ICE candidate (remote desc not set yet)")
            synchronized(pendingIceCandidates) {
                pendingIceCandidates.add(candidate)
            }
        }
    }

    private fun drainPendingCandidates() {
        synchronized(pendingIceCandidates) {
            Log.d(TAG, "Draining ${pendingIceCandidates.size} queued ICE candidates")
            while (pendingIceCandidates.isNotEmpty()) {
                peerConnection?.addIceCandidate(pendingIceCandidates.poll())
            }
        }
    }

    // ─── Controls ───────────────────────────────────────────────────────

    fun toggleMute(): Boolean {
        val track = localAudioTrack ?: return false
        track.setEnabled(!track.enabled())
        return !track.enabled() // returns true if now muted
    }

    fun toggleCamera(): Boolean {
        val track = localVideoTrack ?: return false
        track.setEnabled(!track.enabled())
        return !track.enabled() // returns true if camera off
    }

    fun switchCamera() {
        videoCapturer?.switchCamera(null)
    }

    // ─── Cleanup ────────────────────────────────────────────────────────

    fun cleanup() {
        try {
            videoCapturer?.stopCapture()
            videoCapturer?.dispose()
        } catch (_: Exception) {}
        videoCapturer = null

        localVideoTrack?.dispose()
        localVideoTrack = null
        _localVideoTrackFlow.value = null

        localAudioTrack?.dispose()
        localAudioTrack = null

        localStream?.dispose()
        localStream = null

        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null

        _remoteVideoTrack.value = null
        remoteDescriptionSet = false
        pendingIceCandidates.clear()
        _callState.value = CallState.IDLE
        targetUserId = null
        localTracksAttached = false
        _isAudioOnly.value = false

        Log.d(TAG, "WebRTC cleaned up")
    }

    fun release() {
        cleanup()
        factory?.dispose()
        factory = null
        audioDeviceModule?.release()
        audioDeviceModule = null
        eglBase?.release()
        eglBase = null
    }

    // ─── State enum ─────────────────────────────────────────────────────

    enum class CallState { IDLE, CALLING, RINGING, CONNECTED, ENDED }

    // ─── SDP Observer adapter ───────────────────────────────────────────

    private open class SdpObserverAdapter : SdpObserver {
        override fun onCreateSuccess(sdp: SessionDescription?) {}
        override fun onSetSuccess() {}
        override fun onCreateFailure(error: String?) {
            Log.e(TAG, "SDP create failure: $error")
        }
        override fun onSetFailure(error: String?) {
            Log.e(TAG, "SDP set failure: $error")
        }
    }

    private fun attachLocalTracksToPeerConnection() {
        val connection = peerConnection ?: return
        if (localTracksAttached) return

        localAudioTrack?.let { connection.addTrack(it) }
        localVideoTrack?.let { connection.addTrack(it) }
        localTracksAttached = localAudioTrack != null || localVideoTrack != null
    }
}
