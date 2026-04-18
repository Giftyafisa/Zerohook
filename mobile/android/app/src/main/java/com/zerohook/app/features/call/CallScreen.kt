package com.zerohook.app.features.call

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.core.content.ContextCompat
import com.zerohook.app.util.AppPermissions
import com.zerohook.app.util.rememberPermissionRequest
import org.webrtc.RendererCommon
import org.webrtc.SurfaceViewRenderer

/**
 * Call screen — handles incoming, outgoing, and active call states.
 *
 * ## Fixes applied:
 * - TURN servers configured in WebRTCManager
 * - Audio fallback if camera denied
 * - ICE candidates queued until remote description set
 * - SurfaceViewRenderer properly cleaned up via DisposableEffect
 * - Runtime permissions requested before starting/accepting calls
 * - Audio routing: speaker for video, earpiece for audio-only
 */
@Composable
fun CallScreen(
    viewModel: CallViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val remoteVideo by viewModel.remoteVideoTrack.collectAsState()
    val localVideo by viewModel.localVideoTrack.collectAsState()
    val eglContext = viewModel.getEglContext()
    val context = LocalContext.current
    var pendingManualAccept by remember { mutableStateOf(false) }
    var pendingAutoAnswer by remember { mutableStateOf(false) }
    var autoAnswerRequested by remember { mutableStateOf(false) }

    val callPermissions = remember(uiState.callType) {
        if (uiState.callType == "audio") AppPermissions.AUDIO_CALL else AppPermissions.VIDEO_CALL
    }

    fun hasAllCallPermissions(): Boolean {
        val micGranted = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        val cameraGranted = if (uiState.callType == "video") {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

        return if (uiState.callType == "audio") micGranted else micGranted && cameraGranted
    }

    // Request camera + microphone permissions before calls
    val (hasPermissions, requestPermissions) = rememberPermissionRequest(
        permissions = callPermissions,
        onResult = {
            val allGranted = hasAllCallPermissions()

            when {
                pendingAutoAnswer && allGranted -> {
                    pendingAutoAnswer = false
                    autoAnswerRequested = false
                    viewModel.beginAcceptedIncomingCall()
                }
                pendingManualAccept && allGranted -> {
                    pendingManualAccept = false
                    viewModel.acceptCall()
                }
                pendingAutoAnswer -> {
                    pendingAutoAnswer = false
                    autoAnswerRequested = false
                    viewModel.clearAutoAccept()
                }
                else -> {
                    pendingManualAccept = false
                }
            }
        }
    )

    LaunchedEffect(uiState.phase, uiState.autoAccept) {
        if (uiState.phase != CallViewModel.CallPhase.INCOMING) {
            autoAnswerRequested = false
            return@LaunchedEffect
        }

        if (!uiState.autoAccept) {
            autoAnswerRequested = false
            return@LaunchedEffect
        }

        if (autoAnswerRequested) return@LaunchedEffect
        autoAnswerRequested = true

        if (hasAllCallPermissions()) {
            pendingAutoAnswer = false
            viewModel.beginAcceptedIncomingCall()
        } else {
            pendingAutoAnswer = true
            requestPermissions()
        }
    }

    // FIX: Audio routing — speaker for video calls, earpiece for audio
    DisposableEffect(uiState.phase, uiState.callType) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        if (uiState.phase == CallViewModel.CallPhase.ACTIVE ||
            uiState.phase == CallViewModel.CallPhase.CONNECTING
        ) {
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.isSpeakerphoneOn = uiState.callType == "video" && !uiState.isAudioOnly
        }
        onDispose {
            audioManager.mode = AudioManager.MODE_NORMAL
            audioManager.isSpeakerphoneOn = false
        }
    }

    // FIX: Keep screen on during active calls
    val view = androidx.compose.ui.platform.LocalView.current
    DisposableEffect(uiState.phase) {
        if (uiState.phase == CallViewModel.CallPhase.ACTIVE ||
            uiState.phase == CallViewModel.CallPhase.CONNECTING ||
            uiState.phase == CallViewModel.CallPhase.INCOMING ||
            uiState.phase == CallViewModel.CallPhase.OUTGOING
        ) {
            view.keepScreenOn = true
        }
        onDispose { view.keepScreenOn = false }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0A0A0F))
    ) {
        when (uiState.phase) {
            CallViewModel.CallPhase.IDLE -> {
                // Should not be visible — navigate away
            }

            CallViewModel.CallPhase.INCOMING -> IncomingCallUI(
                callerName = uiState.remoteUserName,
                callType = uiState.callType,
                onAccept = {
                    if (hasPermissions || hasAllCallPermissions()) {
                        pendingManualAccept = false
                        pendingAutoAnswer = false
                        viewModel.acceptCall()
                    } else {
                        pendingManualAccept = true
                        pendingAutoAnswer = false
                        requestPermissions()
                    }
                },
                onReject = { viewModel.rejectCall() }
            )

            CallViewModel.CallPhase.OUTGOING -> OutgoingCallUI(
                remoteName = uiState.remoteUserName,
                onCancel = { viewModel.endCall() }
            )

            CallViewModel.CallPhase.CONNECTING -> ConnectingUI(
                remoteName = uiState.remoteUserName
            )

            CallViewModel.CallPhase.ACTIVE -> ActiveCallUI(
                remoteName = uiState.remoteUserName,
                callType = uiState.callType,
                isMuted = uiState.isMuted,
                isCameraOff = uiState.isCameraOff,
                isAudioOnly = uiState.isAudioOnly,
                remoteVideo = remoteVideo,
                localVideo = localVideo,
                eglContext = eglContext,
                onToggleMute = { viewModel.toggleMute() },
                onToggleCamera = { viewModel.toggleCamera() },
                onSwitchCamera = { viewModel.switchCamera() },
                onEndCall = { viewModel.endCall() }
            )

            CallViewModel.CallPhase.ENDED -> CallEndedUI(
                onDismiss = { viewModel.resetState() }
            )
        }
    }
}

@Composable
private fun IncomingCallUI(
    callerName: String,
    callType: String,
    onAccept: () -> Unit,
    onReject: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            if (callType == "video") Icons.Default.Videocam else Icons.Default.Call,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Incoming ${callType.replaceFirstChar { it.uppercase() }} Call",
            fontSize = 18.sp,
            color = Color.White.copy(alpha = 0.7f)
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = callerName,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Spacer(modifier = Modifier.height(48.dp))
        Row(
            horizontalArrangement = Arrangement.spacedBy(48.dp)
        ) {
            // Reject
            FloatingActionButton(
                onClick = onReject,
                containerColor = Color(0xFFFF4444),
                modifier = Modifier.size(64.dp)
            ) {
                Icon(Icons.Default.CallEnd, contentDescription = "Decline", tint = Color.White)
            }
            // Accept
            FloatingActionButton(
                onClick = onAccept,
                containerColor = Color(0xFF00E676),
                modifier = Modifier.size(64.dp)
            ) {
                Icon(Icons.Default.Call, contentDescription = "Accept", tint = Color.White)
            }
        }
    }
}

@Composable
private fun OutgoingCallUI(remoteName: String, onCancel: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        Spacer(modifier = Modifier.height(24.dp))
        Text("Calling...", fontSize = 18.sp, color = Color.White.copy(alpha = 0.7f))
        Spacer(modifier = Modifier.height(8.dp))
        Text(remoteName, fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(modifier = Modifier.height(48.dp))
        FloatingActionButton(
            onClick = onCancel,
            containerColor = Color(0xFFFF4444),
            modifier = Modifier.size(64.dp)
        ) {
            Icon(Icons.Default.CallEnd, contentDescription = "Cancel", tint = Color.White)
        }
    }
}

@Composable
private fun ConnectingUI(remoteName: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Connecting to $remoteName...", color = Color.White)
    }
}

@Composable
private fun ActiveCallUI(
    remoteName: String,
    callType: String,
    isMuted: Boolean,
    isCameraOff: Boolean,
    isAudioOnly: Boolean,
    remoteVideo: org.webrtc.VideoTrack?,
    localVideo: org.webrtc.VideoTrack?,
    eglContext: org.webrtc.EglBase.Context?,
    onToggleMute: () -> Unit,
    onToggleCamera: () -> Unit,
    onSwitchCamera: () -> Unit,
    onEndCall: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        // Remote video (full screen) — with proper lifecycle management
        if (remoteVideo != null && !isAudioOnly && eglContext != null) {
            // FIX: Use key + DisposableEffect to prevent SurfaceViewRenderer leaks
            key(remoteVideo) {
                var renderer by remember { mutableStateOf<SurfaceViewRenderer?>(null) }

                AndroidView(
                    factory = { ctx ->
                        SurfaceViewRenderer(ctx).also { svr ->
                            svr.init(eglContext, null)
                            svr.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
                            remoteVideo.addSink(svr)
                            renderer = svr
                        }
                    },
                    modifier = Modifier.fillMaxSize()
                )

                DisposableEffect(remoteVideo) {
                    onDispose {
                        try {
                            renderer?.let { svr ->
                                remoteVideo.removeSink(svr)
                                svr.release()
                            }
                        } catch (_: Exception) {}
                        renderer = null
                    }
                }
            }
        } else {
            // Audio-only or no remote video — show name
            Column(
                modifier = Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(96.dp),
                    tint = Color.White.copy(alpha = 0.3f)
                )
                Spacer(modifier = Modifier.height(16.dp))
                Text(remoteName, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color.White)
                if (isAudioOnly) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Audio Only", fontSize = 14.sp, color = Color.White.copy(alpha = 0.6f))
                }
            }
        }

        // Local video (PiP — top right) — with proper lifecycle management
        if (localVideo != null && !isCameraOff && !isAudioOnly && eglContext != null) {
            key(localVideo) {
                var localRenderer by remember { mutableStateOf<SurfaceViewRenderer?>(null) }

                AndroidView(
                    factory = { ctx ->
                        SurfaceViewRenderer(ctx).also { svr ->
                            svr.init(eglContext, null)
                            svr.setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FIT)
                            svr.setMirror(true)
                            localVideo.addSink(svr)
                            localRenderer = svr
                        }
                    },
                    modifier = Modifier
                        .size(120.dp, 160.dp)
                        .padding(16.dp)
                        .clip(MaterialTheme.shapes.medium)
                        .align(Alignment.TopEnd)
                )

                DisposableEffect(localVideo) {
                    onDispose {
                        try {
                            localRenderer?.let { svr ->
                                localVideo.removeSink(svr)
                                svr.release()
                            }
                        } catch (_: Exception) {}
                        localRenderer = null
                    }
                }
            }
        }

        // Controls at bottom
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Mute
            FloatingActionButton(
                onClick = onToggleMute,
                containerColor = if (isMuted) Color(0xFFFF4444) else Color.White.copy(alpha = 0.2f),
                modifier = Modifier.size(56.dp)
            ) {
                Icon(
                    if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = "Toggle mute",
                    tint = Color.White
                )
            }

            // Camera toggle (video calls only)
            if (callType == "video" && !isAudioOnly) {
                FloatingActionButton(
                    onClick = onToggleCamera,
                    containerColor = if (isCameraOff) Color(0xFFFF4444) else Color.White.copy(alpha = 0.2f),
                    modifier = Modifier.size(56.dp)
                ) {
                    Icon(
                        if (isCameraOff) Icons.Default.VideocamOff else Icons.Default.Videocam,
                        contentDescription = "Toggle camera",
                        tint = Color.White
                    )
                }

                // Switch camera
                FloatingActionButton(
                    onClick = onSwitchCamera,
                    containerColor = Color.White.copy(alpha = 0.2f),
                    modifier = Modifier.size(56.dp)
                ) {
                    Icon(Icons.Default.Cameraswitch, contentDescription = "Switch camera", tint = Color.White)
                }
            }

            // End call
            FloatingActionButton(
                onClick = onEndCall,
                containerColor = Color(0xFFFF4444),
                modifier = Modifier.size(64.dp)
            ) {
                Icon(Icons.Default.CallEnd, contentDescription = "End call", tint = Color.White)
            }
        }
    }
}

@Composable
private fun CallEndedUI(onDismiss: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Call Ended", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = Color.White)
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onDismiss) {
            Text("Close")
        }
    }
}
