package com.zerohook.app.features.chat

import android.content.Context
import android.net.Uri
import android.os.Build
import android.util.Log
import android.webkit.MimeTypeMap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zerohook.app.BuildConfig
import com.zerohook.app.data.local.TokenManager
import com.zerohook.app.data.local.entity.ConversationEntity
import com.zerohook.app.data.local.entity.MessageEntity
import com.zerohook.app.data.repository.ChatRepository
import com.zerohook.app.services.NotificationHelper
import com.zerohook.app.services.SocketManager
import com.zerohook.app.util.InteractionPolicy
import com.zerohook.app.util.MessageUtils
import kotlinx.coroutines.ExperimentalCoroutinesApi
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

/**
 * Chat ViewModel — manages conversation list, message thread, typing,
 * read receipts, and online status.
 *
 * ## Web audit fixes applied:
 * 1. **Stable socket handlers**: SocketManager registers handlers ONCE; this
 *    ViewModel only observes SharedFlows, never re-registers listeners.
 *
 * 2. **Room management by ID**: [selectConversation] calls
 *    SocketManager.setActiveConversation(id) which only emits join/leave
 *    when the primitive ID changes, not on every object mutation.
 *
 * 3. **Message dedup**: SocketManager deduplicates; this ViewModel uses Room
 *    @Upsert which ignores duplicates by primary key.
 *
 * 4. **Unread count**: When a message arrives for the ACTIVE conversation,
 *    we immediately mark it read (decrement unread) instead of incrementing.
 *
 * 5. **URL normalization**: Preview text uses MessageUtils.normalizePreview().
 *
 * 6. **Read receipts via REST only**: markConversationRead calls the repository
 *    which uses REST (no socket emit).
 *
 * 7. **Double-notification suppression**: Only shows a notification for messages
 *    NOT in the active conversation.
 *
 * 8. **Typing timeout**: Auto-stops typing after 3 seconds of inactivity.
 */
@HiltViewModel
@OptIn(ExperimentalCoroutinesApi::class)
class ChatViewModel @Inject constructor(
    private val chatRepository: ChatRepository,
    private val socketManager: SocketManager,
    private val tokenManager: TokenManager,
    private val notificationHelper: NotificationHelper,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    data class ChatActionFeedback(
        val message: String,
        val isAccessIssue: Boolean = false,
        val requiresSugarAccess: Boolean = false,
        val requiredAccessType: String? = null
    )

    companion object {
        private const val TAG = "ChatViewModel"
        private const val TYPING_TIMEOUT_MS = 3000L
        private const val TRACE_UPLOAD_INTERVAL_MS = 5 * 60 * 1000L
        private const val TRACE_UPLOAD_MIN_LINES = 20
    }

    // ─── State ──────────────────────────────────────────────────────────

    /** Conversation list — driven by Room (offline-first). */
    val conversations: StateFlow<List<ConversationEntity>> =
        chatRepository.observeConversations()
            .stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val _selectedConversationId = MutableStateFlow<String?>(null)
    val selectedConversationId: StateFlow<String?> = _selectedConversationId.asStateFlow()

    /** Messages for the selected conversation — driven by Room. */
    val messages: StateFlow<List<MessageEntity>> =
        _selectedConversationId.flatMapLatest { id ->
            if (id != null) chatRepository.observeMessages(id) else flowOf(emptyList())
        }.stateIn(viewModelScope, SharingStarted.Lazily, emptyList())

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _remoteTyping = MutableStateFlow(false)
    val remoteTyping: StateFlow<Boolean> = _remoteTyping.asStateFlow()

    private val _typingConversations = MutableStateFlow<Set<String>>(emptySet())
    val typingConversations: StateFlow<Set<String>> = _typingConversations.asStateFlow()

    private val _totalUnread = MutableStateFlow(0)
    val totalUnread: StateFlow<Int> = _totalUnread.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _actionFeedback = MutableStateFlow<ChatActionFeedback?>(null)
    val actionFeedback: StateFlow<ChatActionFeedback?> = _actionFeedback.asStateFlow()

    /** Pagination state — cursor-based "load older" */
    private val _hasMoreMessages = MutableStateFlow(true)
    val hasMoreMessages: StateFlow<Boolean> = _hasMoreMessages.asStateFlow()

    private val _isLoadingMore = MutableStateFlow(false)
    val isLoadingMore: StateFlow<Boolean> = _isLoadingMore.asStateFlow()

    /** Socket connection state — for UI banner */
    val connectionState: StateFlow<SocketManager.ConnectionState> = socketManager.connectionState

    /** FIX: Navigation trigger for startConversation → auto-navigate to new chat */
    private val _navigateToConversation = MutableStateFlow<String?>(null)
    val navigateToConversation: StateFlow<String?> = _navigateToConversation.asStateFlow()

    // ─── Debug / diagnostics ─────────────────────────────────────────────
    val socketTrace: StateFlow<List<String>> = socketManager.eventTrace

    private var currentUserId: String? = null
    private var currentAccountType: String? = null
    private var typingJob: Job? = null
    private var isTyping = false
    private var lastRequestedPresenceIds: Set<String> = emptySet()
    private var lastUploadedTraceCount: Int = 0
    private var lastConversationRefreshAt: Long = 0L

    // ─── Init ───────────────────────────────────────────────────────────

    init {
        viewModelScope.launch {
            currentUserId = tokenManager.getUserId()
            currentAccountType = tokenManager.accountTypeFlow.value
        }

        viewModelScope.launch {
            tokenManager.accountTypeFlow.collect { accountType ->
                currentAccountType = accountType
            }
        }

        // Observe socket events and route them to the repository / UI state
        observeIncomingMessages()
        observeTypingEvents()
        observeReadReceipts()
        observeUserStatus()
        observeUsersStatusSnapshot()
        observeNotifications()
        startPeriodicSocketTraceUpload()

        // Compute total unread from conversation list
        viewModelScope.launch {
            conversations.collect { list ->
                _totalUnread.value = list.sumOf { it.unreadCount }

                val participantIds = list.map { it.participantId }.filter { it.isNotBlank() }.toSet()
                if (participantIds.isNotEmpty() && participantIds != lastRequestedPresenceIds) {
                    lastRequestedPresenceIds = participantIds
                    socketManager.requestUsersStatus(participantIds.toList(), context = "chat")
                }
            }
        }
    }

    // ─── Public API ─────────────────────────────────────────────────────

    fun loadConversations() {
        viewModelScope.launch {
            if (connectionState.value == SocketManager.ConnectionState.DISCONNECTED ||
                connectionState.value == SocketManager.ConnectionState.ERROR
            ) {
                socketManager.connect()
            }

            _isLoading.value = true
            val refreshResult = chatRepository.refreshConversations()
            if (refreshResult.isSuccess) {
                val ids = conversations.value.mapNotNull { it.participantId.takeIf { id -> id.isNotBlank() } }
                if (ids.isNotEmpty()) {
                    // REST snapshot gives immediate presence state before socket snapshots land.
                    hydratePresenceSnapshot(ids)
                    socketManager.requestUsersStatus(ids, context = "chat")
                }
            } else {
                _error.value = refreshResult.exceptionOrNull()?.message
            }
            _isLoading.value = false
        }
    }

    private suspend fun hydratePresenceSnapshot(participantIds: List<String>) {
        chatRepository.fetchPresenceSnapshot(participantIds, context = "chat")
            .onSuccess { snapshotUsers ->
                snapshotUsers.forEach { user ->
                    if (!user.restricted && user.userId.isNotBlank()) {
                        chatRepository.updatePresence(
                            userId = user.userId,
                            online = user.isOnline,
                            lastSeen = user.lastSeen,
                            lastSeenLabel = user.lastSeenLabel
                        )
                    }
                }
            }
            .onFailure {
                Log.w(TAG, "Presence snapshot fallback failed: ${it.message}")
            }
    }

    /**
     * Select a conversation. Emits join/leave via SocketManager using the
     * primitive ID (FIX: not the full object).
     */
    fun selectConversation(conversationId: String?) {
        val prev = _selectedConversationId.value
        _selectedConversationId.value = conversationId

        // Inform SocketManager — it only emits join/leave when ID changes
        socketManager.setActiveConversation(conversationId)

        // Reset pagination state for the new conversation
        _hasMoreMessages.value = true
        _isLoadingMore.value = false

        // Load messages and mark read
        if (conversationId != null && conversationId != prev) {
            viewModelScope.launch {
                chatRepository.refreshMessages(conversationId)
                chatRepository.markConversationRead(conversationId)
            }
        }

        // Clear typing indicator when leaving a conversation
        if (conversationId != prev) {
            _remoteTyping.value = false
        }
    }

    fun sendMessage(content: String) {
        val convId = _selectedConversationId.value ?: return
        if (content.isBlank()) return

        stopTyping()

        viewModelScope.launch {
            val senderId = resolveCurrentUserId()

            // Optimistic: insert a "sending" message immediately
            val tempId = "temp_${System.currentTimeMillis()}"
            val tempMsg = MessageEntity(
                id = tempId,
                conversationId = convId,
                senderId = senderId,
                content = content,
                messageType = "text",
                createdAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                    .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
                    .format(java.util.Date()),
                status = "sending"
            )
            chatRepository.upsertMessage(tempMsg)

            chatRepository.sendMessage(convId, content)
                .onSuccess {
                    chatRepository.deleteMessageById(tempId)
                }
                .onFailure { e ->
                    // Mark temp message as failed
                    chatRepository.upsertMessage(tempMsg.copy(status = "failed"))
                    _error.value = e.message
                }
            // On success, the socket new_message event or Room upsert handles the real message
        }
    }

    /**
     * Start or get conversation with a user (e.g. from "Message" button on profile).
     * FIX: Now triggers navigation via navigateToConversation flow.
     */
    fun startConversation(participantId: String, targetAccountType: String? = null) {
        val policyResult = InteractionPolicy.evaluateConversationStart(
            initiatorAccountType = currentAccountType,
            targetAccountType = targetAccountType
        )

        if (!policyResult.allowed) {
            val message = policyResult.message ?: "Conversation not allowed"
            _error.value = message
            _actionFeedback.value = ChatActionFeedback(
                message = message,
                isAccessIssue = true
            )
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            chatRepository.startConversation(participantId)
                .onSuccess { conv ->
                    selectConversation(conv.id)
                    _navigateToConversation.value = conv.id
                }
                .onFailure { throwable ->
                    val startError = throwable as? ChatRepository.ConversationStartException
                    val message = startError?.userMessage
                        ?: throwable.message
                        ?: "Unable to start conversation"

                    _error.value = message
                    _actionFeedback.value = ChatActionFeedback(
                        message = message,
                        isAccessIssue = startError != null,
                        requiresSugarAccess = !startError?.requiredAccessType.isNullOrBlank(),
                        requiredAccessType = startError?.requiredAccessType
                    )
                }
            _isLoading.value = false
        }
    }

    fun clearNavigateToConversation() {
        _navigateToConversation.value = null
    }

    fun clearActionFeedback() {
        _actionFeedback.value = null
    }

    // ─── Retry ──────────────────────────────────────────────────────────

    /**
     * Retry a failed message. Reads the original content from Room, re-marks
     * it as "sending", and re-submits via the REST API. On success the socket
     * new_message event (or the REST response upsert) replaces the temp entry.
     */
    fun retryMessage(messageId: String) {
        viewModelScope.launch {
            val msg = chatRepository.getMessageById(messageId) ?: return@launch
            if (msg.status != "failed") return@launch

            // Mark as sending again
            chatRepository.upsertMessage(msg.copy(status = "sending"))

            chatRepository.sendMessage(msg.conversationId, msg.content, msg.messageType)
                .onSuccess {
                    // Remove failed temp entry — real message arrives via socket / REST upsert
                    chatRepository.deleteMessageById(msg.id)
                }
                .onFailure {
                    chatRepository.upsertMessage(msg.copy(status = "failed"))
                    _error.value = it.message
                }
        }
    }

    // ─── File / Image upload ────────────────────────────────────────────

    /**
     * Send a file or image picked by the user.
     *
     * 1. Copies the content:// Uri to a temp file (ContentResolver → cache dir)
     * 2. Resolves the MIME type
     * 3. Inserts an optimistic "sending" placeholder
     * 4. Calls [ChatRepository.uploadFile]
     */
    fun sendFile(uri: Uri) {
        val convId = _selectedConversationId.value ?: return

        viewModelScope.launch {
            try {
                val senderId = resolveCurrentUserId()

                // Resolve MIME type
                val mimeType = appContext.contentResolver.getType(uri) ?: "application/octet-stream"
                val extension = MimeTypeMap.getSingleton()
                    .getExtensionFromMimeType(mimeType) ?: "bin"

                // Copy content:// → temp file
                val tempFile = File(appContext.cacheDir, "upload_${System.currentTimeMillis()}.$extension")
                appContext.contentResolver.openInputStream(uri)?.use { input ->
                    tempFile.outputStream().use { output -> input.copyTo(output) }
                } ?: run {
                    _error.value = "Could not read file"
                    return@launch
                }

                // Optimistic placeholder
                val tempId = "temp_file_${System.currentTimeMillis()}"
                val messageType = if (mimeType.startsWith("image/")) "image" else "file"
                val placeholderText = when {
                    mimeType.startsWith("image/") -> "Uploading photo..."
                    mimeType.startsWith("video/") -> "Uploading video..."
                    else -> "Uploading file..."
                }
                val tempMsg = MessageEntity(
                    id = tempId,
                    conversationId = convId,
                    senderId = senderId,
                    content = placeholderText,
                    messageType = messageType,
                    createdAt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                        .apply { timeZone = java.util.TimeZone.getTimeZone("UTC") }
                        .format(java.util.Date()),
                    status = "sending"
                )
                chatRepository.upsertMessage(tempMsg)

                chatRepository.uploadFile(convId, tempFile, mimeType)
                    .onSuccess {
                        chatRepository.deleteMessageById(tempId)
                    }
                    .onFailure { e ->
                        chatRepository.upsertMessage(tempMsg.copy(status = "failed", content = "Upload failed. Please pick and resend."))
                        _error.value = e.message
                    }

                // Cleanup temp file
                tempFile.delete()
            } catch (e: Exception) {
                _error.value = "Upload failed: ${e.message}"
            }
        }
    }

    // ─── Pagination ─────────────────────────────────────────────────────

    /**
     * Load older messages via cursor-based pagination (server `before` param).
     * Called when the user scrolls near the top of the message list.
     */
    fun loadMoreMessages() {
        val convId = _selectedConversationId.value ?: return
        if (_isLoadingMore.value || !_hasMoreMessages.value) return

        viewModelScope.launch {
            _isLoadingMore.value = true
            val oldest = chatRepository.getOldestMessage(convId)
            if (oldest == null) {
                _hasMoreMessages.value = false
                _isLoadingMore.value = false
                return@launch
            }

            chatRepository.loadOlderMessages(convId, beforeId = oldest.id)
                .onSuccess { (_, hasMore) ->
                    _hasMoreMessages.value = hasMore
                }
                .onFailure { e ->
                    Log.e(TAG, "loadMoreMessages failed", e)
                    _error.value = "Failed to load history"
                }

            _isLoadingMore.value = false
        }
    }

    // ─── Typing ─────────────────────────────────────────────────────────

    fun onTyping() {
        val convId = _selectedConversationId.value ?: return
        if (!isTyping) {
            isTyping = true
            socketManager.emitTypingStart(convId)
        }
        // Reset the auto-stop timer (FIX: timeout cleanup prevents stuck state)
        typingJob?.cancel()
        typingJob = viewModelScope.launch {
            delay(TYPING_TIMEOUT_MS)
            stopTyping()
        }
    }

    private fun stopTyping() {
        if (isTyping) {
            isTyping = false
            val convId = _selectedConversationId.value ?: return
            socketManager.emitTypingStop(convId)
        }
        typingJob?.cancel()
    }

    fun clearError() {
        _error.value = null
    }

    /**
     * Upload local socket trace to backend for diagnostics.
     */
    fun sendSocketTraceToServer(origin: String = "mobile", deviceInfo: Map<String, String> = emptyMap()) {
        viewModelScope.launch {
            uploadSocketTraceInternal(origin = origin, deviceInfo = deviceInfo, force = true)
        }
    }

    private fun startPeriodicSocketTraceUpload() {
        if (!BuildConfig.DEBUG) return

        viewModelScope.launch {
            while (true) {
                delay(TRACE_UPLOAD_INTERVAL_MS)
                uploadSocketTraceInternal(origin = "mobile_periodic", deviceInfo = emptyMap(), force = false)
            }
        }
    }

    private suspend fun uploadSocketTraceInternal(
        origin: String,
        deviceInfo: Map<String, String>,
        force: Boolean
    ) {
        val trace = socketManager.eventTrace.value
        if (trace.isEmpty()) return

        if (!force) {
            val hasNewEvents = trace.size > lastUploadedTraceCount
            if (!hasNewEvents || trace.size < TRACE_UPLOAD_MIN_LINES) {
                return
            }
        }

        val mergedDeviceInfo = buildDeviceInfo(deviceInfo)

        chatRepository.sendSocketTrace(trace, origin, mergedDeviceInfo)
            .onSuccess {
                lastUploadedTraceCount = trace.size
                Log.d(TAG, "Socket trace uploaded: ${trace.size} lines, origin=$origin")
            }
            .onFailure { e ->
                Log.w(TAG, "Socket trace upload failed", e)
            }
    }

    private fun buildDeviceInfo(extra: Map<String, String>): Map<String, String> {
        val autoDeviceInfo = mapOf(
            "platform" to "android",
            "osVersion" to (Build.VERSION.RELEASE ?: "unknown"),
            "sdkInt" to Build.VERSION.SDK_INT.toString(),
            "brand" to (Build.BRAND ?: ""),
            "manufacturer" to (Build.MANUFACTURER ?: ""),
            "model" to (Build.MODEL ?: ""),
            "device" to (Build.DEVICE ?: ""),
            "product" to (Build.PRODUCT ?: ""),
            "appVersion" to BuildConfig.VERSION_NAME,
            "appVersionCode" to BuildConfig.VERSION_CODE.toString()
        ).filterValues { it.isNotBlank() }

        return autoDeviceInfo + extra.filterValues { it.isNotBlank() }
    }

    // ─── Socket event observers ─────────────────────────────────────────

    private fun observeIncomingMessages() {
        viewModelScope.launch {
            socketManager.incomingMessages.collect { msg ->
                val activeId = _selectedConversationId.value

                // Persist to Room (upsert handles dedup by PK)
                val entity = MessageEntity(
                    id = msg.id,
                    conversationId = msg.conversationId,
                    senderId = msg.senderId,
                    senderName = msg.senderName,
                    content = msg.content,
                    messageType = msg.messageType,
                    createdAt = msg.createdAt,
                    status = "sent"
                )
                chatRepository.upsertMessage(entity)

                // Ensure newly-created conversations from other devices/users show up immediately.
                if (conversations.value.none { it.id == msg.conversationId }) {
                    val now = System.currentTimeMillis()
                    if (now - lastConversationRefreshAt > 2_000L) {
                        lastConversationRefreshAt = now
                        chatRepository.refreshConversations()
                    }
                }

                // Update conversation preview
                val preview = MessageUtils.normalizePreview(msg.content, msg.messageType)
                val isActive = msg.conversationId == activeId
                val unreadDelta = if (msg.isOwnMessage || isActive) 0 else 1
                chatRepository.updateConversationLastMessage(
                    msg.conversationId, preview, msg.createdAt, unreadDelta
                )

                // If the message is for the active conversation and NOT from us,
                // immediately mark as read (FIX: unread decrement for active conv)
                if (isActive && !msg.isOwnMessage) {
                    _remoteTyping.value = false
                    chatRepository.markConversationRead(msg.conversationId)
                }

                // Show notification only if NOT active conversation
                // (FIX: double-notification suppression)
                if (!isActive && !msg.isOwnMessage) {
                    notificationHelper.showMessageNotification(
                        senderName = msg.senderName,
                        messagePreview = preview,
                        conversationId = msg.conversationId
                    )
                }
            }
        }
    }

    private fun observeTypingEvents() {
        viewModelScope.launch {
            socketManager.typingEvents.collect { event ->
                // Update typing conversations set
                _typingConversations.update { current ->
                    if (event.isTyping) current + event.conversationId
                    else current - event.conversationId
                }
                // Update remoteTyping for the active conversation
                if (event.conversationId == _selectedConversationId.value) {
                    _remoteTyping.value = event.isTyping
                }
            }
        }
    }

    private fun observeReadReceipts() {
        viewModelScope.launch {
            socketManager.readReceipts.collect { event ->
                val senderId = resolveCurrentUserId()
                if (senderId.isBlank()) {
                    return@collect
                }
                // Mark our sent messages as read in Room
                chatRepository.markMessagesRead(
                    event.conversationId,
                    senderId = senderId,
                    timestamp = event.timestamp
                )
            }
        }
    }

    private suspend fun resolveCurrentUserId(): String {
        val cached = currentUserId
        if (!cached.isNullOrBlank()) {
            return cached
        }

        val resolved = tokenManager.getUserId().orEmpty()
        if (resolved.isNotBlank()) {
            currentUserId = resolved
        }
        return resolved
    }

    private fun observeUserStatus() {
        viewModelScope.launch {
            socketManager.userStatusEvents.collect { event ->
                Log.d(TAG, "User status: ${event.userId} → ${if (event.isOnline) "online" else "offline"}")
                chatRepository.updatePresence(
                    userId = event.userId,
                    online = event.isOnline,
                    lastSeen = event.lastSeen,
                    lastSeenLabel = event.lastSeenLabel
                )
            }
        }
    }

    private fun observeUsersStatusSnapshot() {
        viewModelScope.launch {
            socketManager.usersStatusSnapshot.collect { users ->
                users.forEach { event ->
                    chatRepository.updatePresence(
                        userId = event.userId,
                        online = event.isOnline,
                        lastSeen = event.lastSeen,
                        lastSeenLabel = event.lastSeenLabel
                    )
                }
            }
        }
    }

    private fun observeNotifications() {
        viewModelScope.launch {
            socketManager.notifications.collect { event ->
                // NOTE: "message" type notifications are already suppressed in SocketManager
                // (FIX from web audit). Only non-message notifications arrive here.
                notificationHelper.showGeneralNotification(event.title, event.message)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopTyping()
        socketManager.setActiveConversation(null)
    }
}
