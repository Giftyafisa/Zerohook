package com.zerohook.app.services

import android.util.Log
import androidx.annotation.VisibleForTesting
import com.zerohook.app.BuildConfig
import com.zerohook.app.data.local.TokenManager
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONObject
import java.util.Collections
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Centralised Socket.IO manager — mirrors the web SocketContext.js + ChatSystem.js
 * socket handling with ALL audit fixes baked in.
 *
 * ## Key fixes from web audit applied here:
 * 1. **Stable handlers**: Socket event listeners are registered ONCE when the socket
 *    connects and are NEVER re-registered when the selected conversation changes.
 *    The current conversation ID is read via an atomic reference, not a closure capture.
 *    (Fixes: web ChatSystem.js socket effect re-registration on every state change.)
 *
 * 2. **Message dedup**: Incoming messages are deduped via a bounded set of processed
 *    message IDs, preventing duplicates when messages arrive on both user and
 *    conversation rooms simultaneously.
 *
 * 3. **Room management**: join_conversation / leave_conversation emit only when the
 *    conversation ID (a primitive String) changes — not when the conversation object
 *    mutates (e.g. online status update).
 *
 * 4. **Read receipts**: markConversationRead calls REST only. No redundant socket
 *    emit('mark_read') to avoid the 4-event cascade found in the web app.
 *
 * 5. **Double-notification suppression**: new_notification events with type == "message"
 *    are silently skipped (the new_message handler already shows them).
 *
 * 6. **Online status**: user_status events update conversation list AND the selected
 *    conversation's participantOnline field without tearing down handlers.
 */
@Singleton
class SocketManager @Inject constructor(
    private val tokenManager: TokenManager
) {
    companion object {
        private const val TAG = "SocketManager"
        private const val DEFAULT_SOCKET_URL = "https://zerohook-api-eoyr.onrender.com"
        private const val MAX_PROCESSED_IDS = 200
        private const val TRIM_TO = 100
        private const val MAX_PROCESSED_CALL_SIGNALS = 500
        private const val TRIM_CALL_SIGNALS_TO = 250
        private const val HEARTBEAT_INTERVAL_MS = 25_000L

        // switch to true to keep verbose socket event tracing in logs
        private const val TRACE_SOCKET_EVENTS = true
    }

    private fun traceEvent(name: String, details: String) {
        if (!TRACE_SOCKET_EVENTS) return
        val text = "[TRACE] $name - $details"
        Log.d(TAG, text)
        recordTrace(text)
    }

    // ─── Connection state ───────────────────────────────────────────────

    private var socket: Socket? = null
    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    // ─── Event flows (UI observes these) ────────────────────────────────

    private val _incomingMessages = MutableSharedFlow<SocketMessage>(extraBufferCapacity = 64)
    val incomingMessages: SharedFlow<SocketMessage> = _incomingMessages.asSharedFlow()

    private val _typingEvents = MutableSharedFlow<TypingEvent>(extraBufferCapacity = 16)
    val typingEvents: SharedFlow<TypingEvent> = _typingEvents.asSharedFlow()

    private val _readReceipts = MutableSharedFlow<ReadReceiptEvent>(extraBufferCapacity = 16)
    val readReceipts: SharedFlow<ReadReceiptEvent> = _readReceipts.asSharedFlow()

    private val _userStatusEvents = MutableSharedFlow<UserStatusEvent>(extraBufferCapacity = 16)
    val userStatusEvents: SharedFlow<UserStatusEvent> = _userStatusEvents.asSharedFlow()

    private val _usersStatusSnapshot = MutableSharedFlow<List<UserStatusEvent>>(extraBufferCapacity = 4)
    val usersStatusSnapshot: SharedFlow<List<UserStatusEvent>> = _usersStatusSnapshot.asSharedFlow()

    private val _callEvents = MutableSharedFlow<CallSignalEvent>(extraBufferCapacity = 8)
    val callEvents: SharedFlow<CallSignalEvent> = _callEvents.asSharedFlow()

    private val _notifications = MutableSharedFlow<NotificationEvent>(extraBufferCapacity = 16)
    val notifications: SharedFlow<NotificationEvent> = _notifications.asSharedFlow()

    // ─── Dedup state ────────────────────────────────────────────────────

    private val processedIds: MutableSet<String> = Collections.synchronizedSet(LinkedHashSet())
    private val processedCallSignals: MutableSet<String> = Collections.synchronizedSet(LinkedHashSet())
    // ─── Audit trace (for debug / diagnostics) ───────────────────────────

    private val _eventTrace = MutableStateFlow<List<String>>(emptyList())
    val eventTrace: StateFlow<List<String>> = _eventTrace.asStateFlow()

    @Synchronized
    private fun recordTrace(line: String) {
        if (!TRACE_SOCKET_EVENTS) return
        val stamped = "${java.time.Instant.now()}: $line"
        _eventTrace.value = (_eventTrace.value + stamped).takeLast(200)
    }
    // ─── Current conversation (atomic reference — NOT a captured closure) ──

    @Volatile
    private var activeConversationId: String? = null

    @Volatile
    private var currentUserId: String? = null

    @Volatile
    private var activeCallType: String = "audio"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var heartbeatJob: Job? = null

    // ─── Public API ─────────────────────────────────────────────────────

    fun connect() {
        if (socket?.connected() == true) return
        scope.launch {
            val token = tokenManager.getToken() ?: run {
                Log.w(TAG, "No token — cannot connect socket")
                return@launch
            }
            currentUserId = tokenManager.getUserId()
            connectInternal(token)
        }
    }

    fun disconnect() {
        socket?.disconnect()
        socket?.off()
        socket = null
        stopHeartbeatLoop()
        _connectionState.value = ConnectionState.DISCONNECTED
        processedIds.clear()
        processedCallSignals.clear()
        activeConversationId = null
        activeCallType = "audio"
    }

    /**
     * Sets the active conversation the user is currently viewing.
     * Emits join/leave room events only when the ID actually changes.
     * (FIX: web audit — depends on primitive ID, not full object)
     */
    fun setActiveConversation(conversationId: String?) {
        val prev = activeConversationId
        if (prev == conversationId) return

        // Leave previous room
        if (prev != null) {
            socket?.emit("leave_conversation", prev)
            Log.d(TAG, "Left conversation room: $prev")
        }

        activeConversationId = conversationId

        // Join new room
        if (conversationId != null) {
            socket?.emit("join_conversation", conversationId)
            Log.d(TAG, "Joined conversation room: $conversationId")
        }
    }

    fun emitTypingStart(conversationId: String) {
        socket?.emit("typing_start", JSONObject().put("conversationId", conversationId))
    }

    fun emitTypingStop(conversationId: String) {
        socket?.emit("typing_stop", JSONObject().put("conversationId", conversationId))
    }

    fun requestUsersStatus(userIds: List<String>, context: String = "chat") {
        val cleaned = userIds.map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(200)
        if (cleaned.isEmpty()) return
        socket?.emit("get_users_status", JSONObject().apply {
            put("context", context)
            put("userIds", org.json.JSONArray(cleaned))
        })
    }

    /** Initiate a call via socket signaling. */
    fun emitCallRequest(targetUserId: String, callType: String) {
        val normalizedCallType = normalizeCallType(callType)
        activeCallType = normalizedCallType
        socket?.emit("call_request", JSONObject().apply {
            put("targetUserId", targetUserId)
            // FIX: Server reads `data.type` not `data.callType`
            put("type", normalizedCallType)
            put("callType", normalizedCallType)
        })
    }

    fun emitCallAccepted(callerId: String, callType: String = "video", callId: String? = null) {
        val normalizedCallType = normalizeCallType(callType)
        activeCallType = normalizedCallType
        socket?.emit("accept_call", JSONObject().apply {
            put("targetUserId", callerId)
            // FIX: Server reads `data.type` and `data.callType`
            put("type", normalizedCallType)
            put("callType", normalizedCallType)
            if (!callId.isNullOrBlank()) put("callId", callId)
        })
    }

    fun emitCallRejected(callerId: String, callId: String? = null, reason: String? = null) {
        socket?.emit("reject_call", JSONObject().apply {
            put("targetUserId", callerId)
            if (!callId.isNullOrBlank()) put("callId", callId)
            if (!reason.isNullOrBlank()) put("reason", reason)
        })
    }

    fun emitEndCall(targetUserId: String, callId: String? = null) {
        // FIX: web audit — guard against self-reference
        if (targetUserId == currentUserId) return
        socket?.emit("end_call", JSONObject().apply {
            put("targetUserId", targetUserId)
            if (!callId.isNullOrBlank()) put("callId", callId)
        })
    }

    fun emitCallTimeout(targetUserId: String, callId: String? = null) {
        socket?.emit("call_timeout", JSONObject().apply {
            put("targetUserId", targetUserId)
            if (!callId.isNullOrBlank()) put("callId", callId)
        })
    }

    fun emitOffer(targetUserId: String, sdp: String) {
        socket?.emit("webrtc_offer", JSONObject().apply {
            put("targetUserId", targetUserId)
            put("offer", JSONObject().put("type", "offer").put("sdp", sdp))
            put("callType", activeCallType)
        })
    }

    fun emitAnswer(targetUserId: String, sdp: String) {
        socket?.emit("webrtc_answer", JSONObject().apply {
            put("targetUserId", targetUserId)
            put("answer", JSONObject().put("type", "answer").put("sdp", sdp))
        })
    }

    fun emitIceCandidate(targetUserId: String, candidate: JSONObject) {
        socket?.emit("ice_candidate", JSONObject().apply {
            put("targetUserId", targetUserId)
            put("candidate", candidate)
        })
    }

    // ─── Internal ───────────────────────────────────────────────────────

    private fun connectInternal(token: String) {
        try {
            val socketUrl = resolveSocketUrl(BuildConfig.SOCKET_URL)
            val opts = IO.Options().apply {
                auth = mapOf("token" to token)
                transports = arrayOf("websocket", "polling")
                reconnection = true
                reconnectionAttempts = 10
                reconnectionDelay = 1000
                timeout = 20000
            }

            socket = IO.socket(socketUrl, opts).apply {
                registerEventHandlers(this)
                connect()
            }

            _connectionState.value = ConnectionState.CONNECTING
            Log.d(TAG, "Socket connecting to $socketUrl")
        } catch (e: Exception) {
            Log.e(TAG, "Socket connection error", e)
            _connectionState.value = ConnectionState.ERROR
        }
    }

    private fun resolveSocketUrl(rawUrl: String): String {
        val candidate = rawUrl.trim()
        if (candidate.isBlank()) return DEFAULT_SOCKET_URL

        val parsed = candidate.toHttpUrlOrNull()
        if (parsed == null) return DEFAULT_SOCKET_URL
        if (parsed.scheme != "http" && parsed.scheme != "https") return DEFAULT_SOCKET_URL

        return parsed.toString().removeSuffix("/")
    }

    /**
     * Registers ALL event handlers exactly ONCE per socket lifecycle.
     * Handlers read [activeConversationId] and [currentUserId] atomically —
     * they are never re-registered when the selected conversation changes.
     */
    private fun registerEventHandlers(s: Socket) {

        s.on(Socket.EVENT_CONNECT) {
            Log.i(TAG, "Socket connected")
            _connectionState.value = ConnectionState.CONNECTED
            s.emit("heartbeat")
            startHeartbeatLoop(s)
            activeConversationId?.let { convId ->
                s.emit("join_conversation", convId)
                Log.d(TAG, "Joined active conversation room on connect: $convId")
            }
        }

        s.on(Socket.EVENT_DISCONNECT) {
            Log.w(TAG, "Socket disconnected")
            stopHeartbeatLoop()
            _connectionState.value = ConnectionState.DISCONNECTED
        }

        s.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val err = args.firstOrNull()
            Log.e(TAG, "Socket connect error: $err")
            _connectionState.value = ConnectionState.ERROR
        }

        s.on("reconnect") {
            Log.i(TAG, "Socket reconnected")
            _connectionState.value = ConnectionState.CONNECTED
            startHeartbeatLoop(s)
            // FIX: Rejoin active conversation room after reconnect
            activeConversationId?.let { convId ->
                s.emit("join_conversation", convId)
                Log.d(TAG, "Rejoined conversation room after reconnect: $convId")
            }
        }

        // ── New message ────────────────────────────────────────────────

        s.on("new_message") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val msgId = data.optString("id", "")
            val convId = data.optString("conversationId", "")

            // Dedup — skip if already processed
            if (msgId.isNotEmpty() && processedIds.contains(msgId)) {
                traceEvent("new_message", "ignored duplicate msgId=$msgId conv=$convId")
                return@on
            }

            if (msgId.isNotEmpty()) {
                processedIds.add(msgId)
                if (processedIds.size > MAX_PROCESSED_IDS) {
                    val list = processedIds.toList()
                    processedIds.clear()
                    processedIds.addAll(list.takeLast(TRIM_TO))
                }
            }

            val isForActive = convId == activeConversationId
            traceEvent("new_message", "applied msgId=$msgId conv=$convId active=$isForActive")

            val msg = SocketMessage(
                id = msgId,
                conversationId = convId,
                senderId = data.optString("senderId", ""),
                senderName = data.optString("senderName", ""),
                content = data.optString("content", ""),
                messageType = data.optString("messageType", "text"),
                createdAt = data.optString("createdAt", data.optString("timestamp", "")),
                isForActiveConversation = isForActive,
                isOwnMessage = data.optString("senderId") == currentUserId
            )
            scope.launch { _incomingMessages.emit(msg) }
        }

        // ── Typing ─────────────────────────────────────────────────────

        s.on("typing_start") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val convId = data.optString("conversationId", "")
            traceEvent("typing_start", "conv=$convId")
            scope.launch { _typingEvents.emit(TypingEvent(convId, isTyping = true)) }
        }

        s.on("typing_stop") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val convId = data.optString("conversationId", "")
            traceEvent("typing_stop", "conv=$convId")
            scope.launch { _typingEvents.emit(TypingEvent(convId, isTyping = false)) }
        }

        // ── Read receipts ──────────────────────────────────────────────

        s.on("message_read") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val readerId = data.optString("userId", "")
            if (readerId == currentUserId) {
                traceEvent("message_read", "ignored own read")
                return@on  // Ignore our own read events
            }
            val convId = data.optString("conversationId", "")
            traceEvent("message_read", "conv=$convId reader=$readerId")
            scope.launch {
                _readReceipts.emit(
                    ReadReceiptEvent(
                        conversationId = convId,
                        readerId = readerId,
                        timestamp = data.optString("timestamp", "")
                    )
                )
            }
        }

        // ── User online/offline ────────────────────────────────────────

        s.on("user_status") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val userId = data.optString("userId", "")
            val isOnline = data.optBoolean("isOnline", false)
            traceEvent("user_status", "user=$userId online=$isOnline")
            scope.launch {
                _userStatusEvents.emit(
                    UserStatusEvent(
                        userId = userId,
                        isOnline = isOnline,
                        lastSeen = data.optString("lastSeen", "").takeIf { it.isNotBlank() },
                        lastSeenLabel = data.optString("lastSeenLabel", "").takeIf { it.isNotBlank() },
                        status = data.optString("status", "").takeIf { it.isNotBlank() }
                    )
                )
            }
        }

        s.on("users_status") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val users = data.optJSONArray("users") ?: return@on
            traceEvent("users_status", "batch=${users.length()}")
            val parsed = mutableListOf<UserStatusEvent>()
            for (i in 0 until users.length()) {
                val item = users.optJSONObject(i) ?: continue
                val userId = item.optString("userId", "")
                if (userId.isBlank()) continue
                val event = UserStatusEvent(
                    userId = userId,
                    isOnline = item.optBoolean("isOnline", false),
                    lastSeen = item.optString("lastSeen", "").takeIf { it.isNotBlank() },
                    lastSeenLabel = item.optString("lastSeenLabel", "").takeIf { it.isNotBlank() },
                    status = item.optString("status", "").takeIf { it.isNotBlank() }
                )
                parsed.add(event)
                scope.launch { _userStatusEvents.emit(event) }
            }
            if (parsed.isNotEmpty()) {
                scope.launch { _usersStatusSnapshot.emit(parsed) }
            }
        }

        // ── Notifications ──────────────────────────────────────────────

        s.on("new_notification") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val type = data.optString("type", "")
            if (type.isBlank()) {
                traceEvent("new_notification", "ignored: missing type")
                return@on
            }

            // Suppress socket-level notifications that already have dedicated flows.
            if (type == "message" || type == "call") {
                traceEvent("new_notification", "suppressed type=$type")
                return@on
            }

            traceEvent("new_notification", "type=$type")
            scope.launch {
                _notifications.emit(
                    NotificationEvent(
                        id = data.optString("id", ""),
                        type = type,
                        title = data.optString("title", ""),
                        message = data.optString("message", ""),
                        data = data
                    )
                )
            }
        }

        // ── Call signaling ─────────────────────────────────────────────

        s.on("incoming_call") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", data.optString("id", ""))
            val callerId = data.optString("callerId", "")
            val normalizedCallType = normalizeCallType(data.optString("callType", data.optString("type", "")))
            val signalKey = "incoming_call:$callId:$callerId:$normalizedCallType"
            if (!registerCallSignal(signalKey)) {
                traceEvent("incoming_call", "ignored duplicate callId=$callId caller=$callerId")
                return@on
            }
            activeCallType = normalizedCallType
            traceEvent("incoming_call", "callId=$callId caller=$callerId type=$normalizedCallType")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.INCOMING,
                        callerId = callerId,
                        callId = callId,
                        callerName = data.optString("callerName", ""),
                        callType = normalizedCallType
                    )
                )
            }
        }

        s.on("call_request_sent") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", data.optString("id", ""))
            val normalizedCallType = normalizeCallType(data.optString("callType", data.optString("type", "")))
            val signalKey = "call_request_sent:$callId:$normalizedCallType"
            if (!registerCallSignal(signalKey)) {
                traceEvent("call_request_sent", "ignored duplicate callId=$callId")
                return@on
            }
            activeCallType = normalizedCallType
            traceEvent("call_request_sent", "callId=$callId type=$normalizedCallType")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.REQUEST_SENT,
                        callerId = currentUserId ?: "",
                        callId = callId,
                        callType = normalizedCallType
                    )
                )
            }
        }

        s.on("call_accepted") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", data.optString("id", ""))
            val acceptedBy = data.optString("peerUserId", data.optString("targetUserId", data.optString("acceptedBy", "")))
            val normalizedCallType = normalizeCallType(data.optString("callType", data.optString("type", "")))
            val signalKey = "call_accepted:$callId:$acceptedBy:$normalizedCallType"
            if (!registerCallSignal(signalKey)) {
                traceEvent("call_accepted", "ignored duplicate callId=$callId acceptedBy=$acceptedBy")
                return@on
            }
            activeCallType = normalizedCallType
            traceEvent("call_accepted", "callId=$callId acceptedBy=$acceptedBy type=$normalizedCallType")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.ACCEPTED,
                        callerId = acceptedBy,
                        callId = callId,
                        callType = normalizedCallType
                    )
                )
            }
        }

        s.on("call_rejected") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", data.optString("id", ""))
            val callerId = data.optString("callerId", data.optString("targetUserId", ""))
            val signalKey = "call_rejected:$callId:$callerId"
            if (!registerCallSignal(signalKey)) {
                traceEvent("call_rejected", "ignored duplicate callId=$callId")
                return@on
            }
            activeCallType = "audio"
            traceEvent("call_rejected", "callId=$callId callerId=$callerId")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.REJECTED,
                        callerId = callerId,
                        callId = callId
                    )
                )
            }
        }

        s.on("call_ended") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", data.optString("id", ""))
            val endedBy = data.optString("endedBy", data.optString("callerId", ""))
            val signalKey = "call_ended:$callId:$endedBy"
            if (!registerCallSignal(signalKey)) {
                traceEvent("call_ended", "ignored duplicate callId=$callId")
                return@on
            }
            activeCallType = "audio"
            traceEvent("call_ended", "callId=$callId endedBy=$endedBy")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.ENDED,
                        callerId = endedBy,
                        callId = callId
                    )
                )
            }
        }

        s.on("webrtc_offer") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", "")
            val normalizedCallType = normalizeCallType(data.optString("callType", data.optString("type", "")))
            activeCallType = normalizedCallType
            val callerId = data.optString("callerId", "")
            val offerObj = data.optJSONObject("offer")
            val offerSdp = offerObj?.optString("sdp", "") ?: ""
            val signalKey = "webrtc_offer:$callId:$callerId:${offerSdp.hashCode()}"
            if (!registerCallSignal(signalKey)) {
                traceEvent("webrtc_offer", "ignored duplicate callId=$callId caller=$callerId")
                return@on
            }
            traceEvent("webrtc_offer", "callId=$callId caller=$callerId type=$normalizedCallType")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.OFFER,
                        callerId = callerId,
                        callId = callId,
                        callType = normalizedCallType,
                        sdp = offerSdp
                    )
                )
            }
        }

        s.on("webrtc_answer") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callerId = data.optString("answererId", data.optString("callerId", ""))
            val callId = data.optString("callId", "")
            val answerObj = data.optJSONObject("answer")
            val answerSdp = answerObj?.optString("sdp", "") ?: ""
            val signalKey = "webrtc_answer:$callId:$callerId:${answerSdp.hashCode()}"
            if (!registerCallSignal(signalKey)) {
                traceEvent("webrtc_answer", "ignored duplicate callId=$callId caller=$callerId")
                return@on
            }
            traceEvent("webrtc_answer", "callId=$callId caller=$callerId")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.ANSWER,
                        callerId = callerId,
                        callId = callId,
                        sdp = answerSdp
                    )
                )
            }
        }

        s.on("ice_candidate") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val sender = data.optString("senderId", data.optString("callerId", ""))
            val callId = data.optString("callId", "")
            val candidateObj = data.optJSONObject("candidate")
            val candidateValue = candidateObj?.optString("candidate", "") ?: ""
            val signalKey = "ice_candidate:$callId:$sender:${candidateValue.hashCode()}"
            if (!registerCallSignal(signalKey)) {
                traceEvent("ice_candidate", "ignored duplicate sender=$sender callId=$callId")
                return@on
            }
            traceEvent("ice_candidate", "sender=$sender")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.ICE_CANDIDATE,
                        callerId = sender,
                        callId = callId,
                        candidate = candidateObj
                    )
                )
            }
        }

        // FIX: Server emits call_cancelled (for both cancel_call and call_timeout)
        // Without this, the incoming call UI stays stuck forever
        s.on("call_cancelled") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", data.optString("id", ""))
            val callerId = data.optString("callerId", "")
            val signalKey = "call_cancelled:$callId:$callerId"
            if (!registerCallSignal(signalKey)) {
                traceEvent("call_cancelled", "ignored duplicate callId=$callId")
                return@on
            }
            activeCallType = "audio"
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.CANCELLED,
                        callerId = callerId,
                        callId = callId
                    )
                )
            }
        }

        s.on("call_timeout") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val callId = data.optString("callId", data.optString("id", ""))
            val callerId = data.optString("callerId", "")
            val signalKey = "call_timeout:$callId:$callerId"
            if (!registerCallSignal(signalKey)) {
                traceEvent("call_timeout", "ignored duplicate callId=$callId")
                return@on
            }
            activeCallType = "audio"
            traceEvent("call_timeout", "callId=$callId")
            scope.launch {
                _callEvents.emit(
                    CallSignalEvent(
                        type = CallSignalType.CANCELLED,
                        callerId = callerId,
                        callId = callId
                    )
                )
            }
        }

        s.on("debug_socket_trace_replay") { args ->
            val data = args.firstOrNull() as? JSONObject ?: return@on
            val traceId = data.optString("traceId", "")
            val lineCount = data.optJSONArray("lines")?.length() ?: 0
            traceEvent("debug_socket_trace_replay", "traceId=$traceId lines=$lineCount")
        }
    }

    // ─── Data classes ───────────────────────────────────────────────────

    enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED, ERROR }

    data class SocketMessage(
        val id: String,
        val conversationId: String,
        val senderId: String,
        val senderName: String,
        val content: String,
        val messageType: String,
        val createdAt: String,
        val isForActiveConversation: Boolean,
        val isOwnMessage: Boolean
    )

    data class TypingEvent(val conversationId: String, val isTyping: Boolean)

    data class ReadReceiptEvent(val conversationId: String, val readerId: String, val timestamp: String)

    data class UserStatusEvent(
        val userId: String,
        val isOnline: Boolean,
        val lastSeen: String? = null,
        val lastSeenLabel: String? = null,
        val status: String? = null
    )

    data class NotificationEvent(
        val id: String,
        val type: String,
        val title: String,
        val message: String,
        val data: JSONObject? = null
    )

    enum class CallSignalType {
        REQUEST_SENT, INCOMING, ACCEPTED, REJECTED, ENDED, CANCELLED, OFFER, ANSWER, ICE_CANDIDATE
    }

    data class CallSignalEvent(
        val type: CallSignalType,
        val callerId: String = "",
        val callId: String = "",
        val callerName: String = "",
        val callType: String = "audio",
        val sdp: String = "",
        val candidate: JSONObject? = null
    )

    private fun startHeartbeatLoop(socket: Socket) {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive && socket.connected()) {
                try {
                    socket.emit("heartbeat")
                } catch (e: Exception) {
                    Log.w(TAG, "Heartbeat emit failed", e)
                }
                delay(HEARTBEAT_INTERVAL_MS)
            }
        }
    }

    private fun stopHeartbeatLoop() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private fun normalizeCallType(rawType: String?): String {
        return if (rawType.equals("audio", ignoreCase = true)) "audio" else "video"
    }

    private fun registerCallSignal(key: String): Boolean {
        if (key.isBlank()) return true
        synchronized(processedCallSignals) {
            if (processedCallSignals.contains(key)) {
                return false
            }

            processedCallSignals.add(key)
            if (processedCallSignals.size > MAX_PROCESSED_CALL_SIGNALS) {
                val keep = processedCallSignals.toList().takeLast(TRIM_CALL_SIGNALS_TO)
                processedCallSignals.clear()
                processedCallSignals.addAll(keep)
            }
            return true
        }
    }

    @VisibleForTesting
    suspend fun emitCallEventForTesting(event: CallSignalEvent) {
        _callEvents.emit(event)
    }
}
