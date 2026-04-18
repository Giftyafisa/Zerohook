package com.zerohook.app.data.repository

import android.util.Log
import com.zerohook.app.data.local.dao.ConversationDao
import com.zerohook.app.data.local.dao.MessageDao
import com.zerohook.app.data.local.entity.ConversationEntity
import com.zerohook.app.data.local.entity.MessageEntity
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.dto.SendMessageRequest
import com.zerohook.app.data.remote.dto.SocketTraceRequest
import com.zerohook.app.data.remote.dto.StartConversationRequest
import com.zerohook.app.util.MessageUtils
import kotlinx.coroutines.flow.Flow
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import org.json.JSONObject
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Chat repository — offline-first with Room cache, API as source of truth.
 *
 * ## Web audit fixes applied:
 * - [markConversationRead] calls REST only (no socket emit) to prevent the
 *   4-event cascade.
 * - Last-message previews are normalized (URLs → "📷 Photo" etc.) before
 *   caching, matching the server-side normalizeLastMessagePreview() fix.
 */
@Singleton
class ChatRepository @Inject constructor(
    private val api: ApiService,
    private val conversationDao: ConversationDao,
    private val messageDao: MessageDao
) {
    data class ConversationStartException(
        val userMessage: String,
        val statusCode: Int? = null,
        val requiredAccessType: String? = null,
        val initiatorAccountType: String? = null,
        val targetAccountType: String? = null
    ) : Exception(userMessage)

    companion object {
        private const val TAG = "ChatRepository"
    }

    // ─── Conversations ──────────────────────────────────────────────────

    /** Reactive stream of cached conversations. */
    fun observeConversations(): Flow<List<ConversationEntity>> = conversationDao.observeAll()

    /**
     * Fetch conversations from API and cache them.
     *
     * FIX: Server returns nested `otherUser { id, username, profilePicture }`
     * instead of flat participantId/Name/Avatar. Map accordingly.
     */
    suspend fun refreshConversations(): Result<List<ConversationEntity>> {
        return try {
            val response = api.getConversations()
            if (response.isSuccessful) {
                val conversations = response.body()?.conversations?.map { dto ->
                    ConversationEntity(
                        id = dto.id,
                        participantId = dto.otherUser?.id ?: "",
                        participantName = dto.otherUser?.username ?: "Unknown",
                        participantAvatar = dto.otherUser?.profilePicture,
                        participantOnline = false, // server doesn't send this; socket updates it
                        participantLastSeen = null,
                        participantLastSeenLabel = null,
                        // FIX: Normalize URL previews → friendly labels
                        lastMessage = MessageUtils.normalizePreview(dto.lastMessage, dto.lastMessageType),
                        lastMessageTime = dto.lastMessageTime,
                        unreadCount = dto.unreadCount,
                        isBlocked = false,
                        hasActiveEscrow = false
                    )
                } ?: emptyList()

                conversationDao.upsertAll(conversations)
                Result.success(conversations)
            } else {
                Result.failure(Exception("Failed to load conversations: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "refreshConversations failed", e)
            Result.failure(e)
        }
    }

    /**
     * Start or get existing conversation with another user.
     *
     * FIX: Server POST /api/chat/start returns { success, conversationId, createdAt }
     * NOT a full conversation object. We create a minimal ConversationEntity and then
     * refresh the full conversation data from the server.
     */
    suspend fun startConversation(participantId: String): Result<ConversationEntity> {
        return try {
            val response = api.startConversation(StartConversationRequest(otherUserId = participantId))
            if (!response.isSuccessful) {
                return Result.failure(
                    parseStartConversationHttpError(
                        rawError = response.errorBody()?.string(),
                        statusCode = response.code()
                    )
                )
            }

            val body = response.body()
                ?: return Result.failure(Exception("No response body"))

            if (!body.success || !body.error.isNullOrBlank()) {
                return Result.failure(
                    ConversationStartException(
                        userMessage = body.message ?: body.error ?: "Failed to start conversation",
                        requiredAccessType = body.requiredAccessType,
                        initiatorAccountType = body.initiatorAccountType,
                        targetAccountType = body.targetAccountType
                    )
                )
            }

            val conversationId = body.conversationId
                ?: return Result.failure(Exception("No conversation ID returned"))

            // Create a minimal entity — we'll get full data via refresh
            val entity = ConversationEntity(
                id = conversationId,
                participantId = participantId,
                participantName = "Loading...",
                participantAvatar = null,
                participantOnline = false,
                participantLastSeen = null,
                participantLastSeenLabel = null,
                lastMessage = null,
                lastMessageTime = body.createdAt,
                unreadCount = 0
            )
            conversationDao.upsert(entity)

            // Refresh to get full conversation data with participant info
            refreshConversations()

            // Return the (possibly enriched) entity
            val enriched = conversationDao.getById(conversationId) ?: entity
            Result.success(enriched)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun parseStartConversationHttpError(
        rawError: String?,
        statusCode: Int
    ): ConversationStartException {
        if (rawError.isNullOrBlank()) {
            return ConversationStartException(
                userMessage = "Failed to start conversation ($statusCode)",
                statusCode = statusCode
            )
        }

        return try {
            val json = JSONObject(rawError)
            ConversationStartException(
                userMessage = json.optString("message").takeIf { it.isNotBlank() }
                    ?: json.optString("error").takeIf { it.isNotBlank() }
                    ?: "Failed to start conversation ($statusCode)",
                statusCode = statusCode,
                requiredAccessType = json.optString("requiredAccessType").takeIf { it.isNotBlank() },
                initiatorAccountType = json.optString("initiatorAccountType").takeIf { it.isNotBlank() },
                targetAccountType = json.optString("targetAccountType").takeIf { it.isNotBlank() }
            )
        } catch (_: Exception) {
            ConversationStartException(
                userMessage = "Failed to start conversation ($statusCode)",
                statusCode = statusCode
            )
        }
    }

    // ─── Messages ───────────────────────────────────────────────────────

    /** Reactive stream of cached messages for a conversation. */
    fun observeMessages(conversationId: String): Flow<List<MessageEntity>> =
        messageDao.observeByConversation(conversationId)

    /**
     * Fetch messages from API and cache them.
     * FIX: Server messages don't include conversationId or status fields.
     */
    suspend fun refreshMessages(conversationId: String): Result<List<MessageEntity>> {
        return try {
            val response = api.getMessages(conversationId)
            if (response.isSuccessful) {
                val body = response.body()
                val messages = body?.messages?.map { dto ->
                    MessageEntity(
                        id = dto.id,
                        conversationId = dto.conversationId ?: conversationId,
                        senderId = dto.senderId ?: "",
                        senderName = dto.senderName,
                        content = dto.content ?: "",
                        messageType = dto.messageType ?: "text",
                        createdAt = dto.createdAt ?: "",
                        readAt = dto.readAt,
                        status = dto.status ?: "sent"
                    )
                } ?: emptyList()

                if (messages.isNotEmpty()) {
                    messageDao.upsertAll(messages)
                }
                Result.success(messages)
            } else {
                Result.failure(Exception("Failed to load messages: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "refreshMessages failed", e)
            Result.failure(e)
        }
    }

    /**
     * Load older messages before the given message ID (cursor-based pagination).
     *
     * Server returns: { messages: [...], pagination: { hasMore, limit, oldestId, newestId } }
     *
     * @return Pair(messages loaded, hasMore pages)
     */
    suspend fun loadOlderMessages(
        conversationId: String,
        beforeId: String,
        limit: Int = 50
    ): Result<Pair<List<MessageEntity>, Boolean>> {
        return try {
            val response = api.getMessages(conversationId, before = beforeId, limit = limit)
            if (response.isSuccessful) {
                val body = response.body()
                val messages = body?.messages?.map { dto ->
                    MessageEntity(
                        id = dto.id,
                        conversationId = dto.conversationId ?: conversationId,
                        senderId = dto.senderId ?: "",
                        senderName = dto.senderName,
                        content = dto.content ?: "",
                        messageType = dto.messageType ?: "text",
                        createdAt = dto.createdAt ?: "",
                        readAt = dto.readAt,
                        status = dto.status ?: "sent"
                    )
                } ?: emptyList()

                if (messages.isNotEmpty()) {
                    messageDao.upsertAll(messages)
                }

                // Extract hasMore from pagination object
                val hasMore = body?.pagination?.hasMore ?: false
                Result.success(Pair(messages, hasMore))
            } else {
                Result.failure(Exception("Failed to load older messages: ${response.code()}"))
            }
        } catch (e: Exception) {
            Log.e(TAG, "loadOlderMessages failed", e)
            Result.failure(e)
        }
    }

    /** Send a message via REST (text/image/video/file). */
    suspend fun sendMessage(
        conversationId: String,
        content: String,
        messageType: String = "text"
    ): Result<MessageEntity> {
        return try {
            val response = api.sendMessage(
                SendMessageRequest(
                    conversationId = conversationId,
                    content = content,
                    messageType = messageType
                )
            )
            if (response.isSuccessful) {
                val dto = response.body()?.message
                    ?: return Result.failure(Exception("No message returned"))
                val entity = MessageEntity(
                    id = dto.id,
                    conversationId = dto.conversationId ?: conversationId,
                    senderId = dto.senderId ?: "",
                    senderName = dto.senderName,
                    content = dto.content ?: content,
                    messageType = dto.messageType ?: messageType,
                    createdAt = dto.createdAt ?: "",
                    status = "sent"
                )
                messageDao.upsert(entity)
                Result.success(entity)
            } else {
                Result.failure(Exception("Failed to send message: ${response.code()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Upload a file attachment and create a chat message with the uploaded URL.
     *
     * Backend contract:
     * 1) POST /api/uploads/chat-attachment -> { url, fileType }
     * 2) POST /api/chat/send with content=url and messageType=fileType
     */
    suspend fun uploadFile(conversationId: String, file: File, mimeType: String): Result<MessageEntity> {
        return try {
            val reqFile = file.asRequestBody(mimeType.toMediaTypeOrNull())
            val filePart = MultipartBody.Part.createFormData("file", file.name, reqFile)

            val uploadResponse = api.uploadChatAttachment(filePart)
            if (!uploadResponse.isSuccessful) {
                return Result.failure(Exception("Upload failed: ${uploadResponse.code()}"))
            }

            val uploadBody = uploadResponse.body()
                ?: return Result.failure(Exception("Upload failed: empty response"))
            if (!uploadBody.success || uploadBody.url.isNullOrBlank()) {
                return Result.failure(Exception(uploadBody.error ?: uploadBody.message ?: "Upload failed"))
            }

            val normalizedType = when (uploadBody.fileType?.lowercase()) {
                "image" -> "image"
                "video" -> "video"
                else -> "file"
            }

            sendMessage(
                conversationId = conversationId,
                content = uploadBody.url,
                messageType = normalizedType
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Mark a conversation as read — REST ONLY.
     *
     * FIX FROM WEB AUDIT: The web ChatSystem.js was emitting BOTH a REST call
     * AND socket.emit('mark_read'), causing 4 read-receipt events. The REST
     * endpoint already broadcasts the receipt via req.io, so NO socket emit needed.
     */
    suspend fun markConversationRead(conversationId: String): Result<Unit> {
        return try {
            conversationDao.clearUnread(conversationId)
            val response = api.markConversationRead(conversationId)
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Mark read failed: ${response.code()}"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateConversationLastMessage(conversationId: String, preview: String, time: String, unreadDelta: Int) {
        val normalizedPreview = MessageUtils.normalizePreview(preview)
        conversationDao.updateLastMessage(conversationId, normalizedPreview, time, unreadDelta)
    }

    suspend fun updatePresence(
        userId: String,
        online: Boolean,
        lastSeen: String? = null,
        lastSeenLabel: String? = null
    ) {
        conversationDao.updatePresence(
            userId = userId,
            online = online,
            lastSeen = lastSeen,
            lastSeenLabel = lastSeenLabel,
            updatedAt = System.currentTimeMillis()
        )
    }

    /** Report socket trace telemetry to backend */
    suspend fun sendSocketTrace(
        trace: List<String>,
        origin: String = "mobile",
        deviceInfo: Map<String, String> = emptyMap()
    ): Result<Unit> {
        return try {
            val response = api.sendSocketTrace(
                com.zerohook.app.data.remote.dto.SocketTraceRequest(
                    trace = trace,
                    origin = origin,
                    deviceInfo = deviceInfo
                )
            )
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception("Socket trace upload failed: ${response.code()}"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun upsertMessage(msg: com.zerohook.app.data.local.entity.MessageEntity) = messageDao.upsert(msg)

    suspend fun deleteMessageById(messageId: String) = messageDao.deleteById(messageId)

    suspend fun getMessageById(messageId: String): com.zerohook.app.data.local.entity.MessageEntity? = messageDao.getById(messageId)

    suspend fun getOldestMessage(conversationId: String): com.zerohook.app.data.local.entity.MessageEntity? =
        messageDao.getOldestByConversation(conversationId)

    suspend fun updateOnlineStatus(userId: String, online: Boolean) {
        updatePresence(userId = userId, online = online, lastSeen = null, lastSeenLabel = null)
    }

    suspend fun fetchPresenceSnapshot(userIds: List<String>, context: String = "chat"):
        Result<List<com.zerohook.app.data.remote.dto.PresenceUserDto>> {
        return try {
            val cleaned = userIds.map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(200)
            if (cleaned.isEmpty()) {
                return Result.success(emptyList())
            }

            val response = api.getUsersPresence(
                userIds = cleaned.joinToString(","),
                context = context
            )

            if (!response.isSuccessful) {
                return Result.failure(Exception("Presence snapshot failed: ${response.code()}"))
            }

            val body = response.body()
                ?: return Result.failure(Exception("Presence snapshot returned empty body"))

            if (!body.success) {
                return Result.failure(Exception(body.message ?: body.error ?: "Presence snapshot failed"))
            }

            Result.success(body.users)
        } catch (e: Exception) {
            Log.e(TAG, "fetchPresenceSnapshot failed", e)
            Result.failure(e)
        }
    }

    suspend fun markMessagesRead(conversationId: String, senderId: String, timestamp: String) {
        messageDao.markReadBySender(conversationId, senderId, timestamp)
    }
}
