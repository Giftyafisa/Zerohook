package com.zerohook.app.data.local.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * Room entity for offline-cached messages.
 * Index on conversationId for fast lookup per-conversation.
 */
@Entity(
    tableName = "messages",
    indices = [Index(value = ["conversationId"])]
)
data class MessageEntity(
    @PrimaryKey val id: String,
    val conversationId: String,
    val senderId: String,
    val senderName: String? = null,
    val content: String,
    val messageType: String = "text",    // text, image, video, audio, file
    val createdAt: String,
    val readAt: String? = null,
    val status: String = "sent"          // sending, sent, delivered, read
)
