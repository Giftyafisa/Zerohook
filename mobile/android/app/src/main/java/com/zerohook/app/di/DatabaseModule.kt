package com.zerohook.app.di

import android.content.Context
import androidx.room.Room
import com.zerohook.app.data.local.ZerohookDatabase
import com.zerohook.app.data.local.dao.ConversationDao
import com.zerohook.app.data.local.dao.MessageDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): ZerohookDatabase {
        return Room.databaseBuilder(
            context,
            ZerohookDatabase::class.java,
            "zerohook_db"
        )
        .fallbackToDestructiveMigration()
        .build()
    }

    @Provides
    fun provideConversationDao(db: ZerohookDatabase): ConversationDao = db.conversationDao()

    @Provides
    fun provideMessageDao(db: ZerohookDatabase): MessageDao = db.messageDao()
}
