package com.zerohook.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.zerohook.app.data.local.dao.ConversationDao
import com.zerohook.app.data.local.dao.MessageDao
import com.zerohook.app.data.local.entity.ConversationEntity
import com.zerohook.app.data.local.entity.MessageEntity

@Database(
    entities = [ConversationEntity::class, MessageEntity::class],
    version = 1,
    exportSchema = false
)
abstract class ZerohookDatabase : RoomDatabase() {
    abstract fun conversationDao(): ConversationDao
    abstract fun messageDao(): MessageDao
}
