package com.zerohook.app.data.local.dao

import androidx.room.*
import com.zerohook.app.data.local.entity.ConversationEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface ConversationDao {

    @Query("SELECT * FROM conversations ORDER BY lastMessageTime DESC")
    fun observeAll(): Flow<List<ConversationEntity>>

    @Query("SELECT * FROM conversations WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): ConversationEntity?

    @Upsert
    suspend fun upsertAll(conversations: List<ConversationEntity>)

    @Upsert
    suspend fun upsert(conversation: ConversationEntity)

    @Query("UPDATE conversations SET unreadCount = 0 WHERE id = :conversationId")
    suspend fun clearUnread(conversationId: String)

    @Query("UPDATE conversations SET participantOnline = :online, participantLastSeen = :lastSeen, participantLastSeenLabel = :lastSeenLabel, updatedAt = :updatedAt WHERE participantId = :userId")
    suspend fun updatePresence(
        userId: String,
        online: Boolean,
        lastSeen: String?,
        lastSeenLabel: String?,
        updatedAt: Long
    )

    @Query("UPDATE conversations SET lastMessage = :preview, lastMessageTime = :time, unreadCount = unreadCount + :unreadDelta WHERE id = :conversationId")
    suspend fun updateLastMessage(conversationId: String, preview: String, time: String, unreadDelta: Int)

    @Query("DELETE FROM conversations")
    suspend fun deleteAll()
}
