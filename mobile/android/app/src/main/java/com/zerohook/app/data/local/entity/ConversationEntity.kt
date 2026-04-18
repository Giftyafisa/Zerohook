package com.zerohook.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Room entity for offline-cached conversations.
 * Maps to the server's conversation model.
 */
@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey val id: String,
    val participantId: String,
    val participantName: String,
    val participantAvatar: String? = null,
    val participantOnline: Boolean = false,
    val participantLastSeen: String? = null,
    val participantLastSeenLabel: String? = null,
    val lastMessage: String? = null,
    val lastMessageTime: String? = null,
    val unreadCount: Int = 0,
    val isBlocked: Boolean = false,
    val hasActiveEscrow: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)
