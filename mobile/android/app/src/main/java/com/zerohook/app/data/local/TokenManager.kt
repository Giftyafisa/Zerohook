package com.zerohook.app.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages JWT token and user info via AES-256-GCM encrypted SharedPreferences.
 *
 * Uses AndroidX security-crypto [EncryptedSharedPreferences] so that all
 * keys are encrypted with AES-256-SIV and all values with AES-256-GCM.
 * The master key is stored in the Android Keystore (hardware-backed on
 * supported devices).
 *
 * Provides reactive [StateFlow]s for observing auth state changes.
 */
@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "TokenManager"
        private const val PREFS_NAME = "zerohook_secure_prefs"
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USERNAME = "username"
        private const val KEY_ACCOUNT_TYPE = "account_type"
        private const val KEY_FCM_TOKEN = "fcm_token"
    }

    private val prefs: SharedPreferences by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            // Fallback: if keystore is corrupt (rare), delete and recreate
            Log.e(TAG, "EncryptedSharedPreferences init failed, resetting", e)
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().clear().apply()
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        }
    }

    // ─── Reactive state (mirrors SharedPreferences values) ──────────────

    private val _tokenFlow = MutableStateFlow<String?>(null)
    val tokenFlow: StateFlow<String?> = _tokenFlow.asStateFlow()

    private val _refreshTokenFlow = MutableStateFlow<String?>(null)
    val refreshTokenFlow: StateFlow<String?> = _refreshTokenFlow.asStateFlow()

    private val _userIdFlow = MutableStateFlow<String?>(null)
    val userIdFlow: StateFlow<String?> = _userIdFlow.asStateFlow()

    private val _usernameFlow = MutableStateFlow<String?>(null)
    val usernameFlow: StateFlow<String?> = _usernameFlow.asStateFlow()

    private val _accountTypeFlow = MutableStateFlow<String?>(null)
    val accountTypeFlow: StateFlow<String?> = _accountTypeFlow.asStateFlow()

    init {
        // Hydrate flows from encrypted storage on startup
        _tokenFlow.value = prefs.getString(KEY_TOKEN, null)
        _refreshTokenFlow.value = prefs.getString(KEY_REFRESH_TOKEN, null)
        _userIdFlow.value = prefs.getString(KEY_USER_ID, null)
        _usernameFlow.value = prefs.getString(KEY_USERNAME, null)
        _accountTypeFlow.value = prefs.getString(KEY_ACCOUNT_TYPE, null)

        // Migrate from old plain DataStore (one-time, transparent)
        migrateFromPlainDataStoreIfNeeded()
    }

    // ─── Synchronous reads ──────────────────────────────────────────────

    /** Returns current token (non-suspending read from encrypted prefs). */
    suspend fun getToken(): String? = _tokenFlow.value

    suspend fun getRefreshToken(): String? = _refreshTokenFlow.value

    suspend fun getUserId(): String? = _userIdFlow.value

    // ─── Writes ─────────────────────────────────────────────────────────

    suspend fun saveSession(
        token: String,
        userId: String,
        username: String,
        accountType: String,
        refreshToken: String? = null
    ) {
        prefs.edit().apply {
            putString(KEY_TOKEN, token)
            putString(KEY_USER_ID, userId)
            putString(KEY_USERNAME, username)
            putString(KEY_ACCOUNT_TYPE, accountType)
            if (refreshToken != null) putString(KEY_REFRESH_TOKEN, refreshToken)
            apply()
        }
        _tokenFlow.value = token
        _userIdFlow.value = userId
        _usernameFlow.value = username
        _accountTypeFlow.value = accountType
        if (refreshToken != null) _refreshTokenFlow.value = refreshToken
    }

    /** Update only the access token and refresh token (used by token rotation). */
    suspend fun updateTokens(accessToken: String, refreshToken: String?) {
        prefs.edit().apply {
            putString(KEY_TOKEN, accessToken)
            if (refreshToken != null) putString(KEY_REFRESH_TOKEN, refreshToken)
            apply()
        }
        _tokenFlow.value = accessToken
        if (refreshToken != null) _refreshTokenFlow.value = refreshToken
    }

    /** Save FCM registration token for push notifications. */
    suspend fun saveFcmToken(token: String) {
        prefs.edit().putString(KEY_FCM_TOKEN, token).apply()
    }

    fun getFcmToken(): String? = prefs.getString(KEY_FCM_TOKEN, null)

    suspend fun clearSession() {
        val fcm = prefs.getString(KEY_FCM_TOKEN, null) // Preserve FCM token
        prefs.edit().clear().apply()
        if (fcm != null) prefs.edit().putString(KEY_FCM_TOKEN, fcm).apply()

        _tokenFlow.value = null
        _refreshTokenFlow.value = null
        _userIdFlow.value = null
        _usernameFlow.value = null
        _accountTypeFlow.value = null
    }

    // ─── Migration from old plain DataStore ─────────────────────────────

    /**
     * One-time migration: if the old plain DataStore file exists and the new
     * encrypted prefs are empty, copy the values over and delete the old file.
     * This ensures seamless upgrade for existing users.
     */
    private fun migrateFromPlainDataStoreIfNeeded() {
        if (_tokenFlow.value != null) return // Already have data, skip

        try {
            val oldPrefsFile = java.io.File(context.filesDir, "datastore/zerohook_prefs.preferences_pb")
            if (!oldPrefsFile.exists()) return

            // Read from old plain DataStore via standard SharedPreferences fallback
            val oldPrefs = context.getSharedPreferences("zerohook_prefs", Context.MODE_PRIVATE)
            val oldToken = oldPrefs.getString(KEY_TOKEN, null)
            if (oldToken != null) {
                Log.i(TAG, "Migrating from plain DataStore to EncryptedSharedPreferences")
                prefs.edit().apply {
                    putString(KEY_TOKEN, oldToken)
                    oldPrefs.getString(KEY_REFRESH_TOKEN, null)?.let { putString(KEY_REFRESH_TOKEN, it) }
                    oldPrefs.getString(KEY_USER_ID, null)?.let { putString(KEY_USER_ID, it) }
                    oldPrefs.getString(KEY_USERNAME, null)?.let { putString(KEY_USERNAME, it) }
                    oldPrefs.getString(KEY_ACCOUNT_TYPE, null)?.let { putString(KEY_ACCOUNT_TYPE, it) }
                    apply()
                }
                // Refresh flows
                _tokenFlow.value = prefs.getString(KEY_TOKEN, null)
                _refreshTokenFlow.value = prefs.getString(KEY_REFRESH_TOKEN, null)
                _userIdFlow.value = prefs.getString(KEY_USER_ID, null)
                _usernameFlow.value = prefs.getString(KEY_USERNAME, null)
                _accountTypeFlow.value = prefs.getString(KEY_ACCOUNT_TYPE, null)
            }

            // Delete old DataStore file
            oldPrefsFile.delete()
            Log.i(TAG, "Migration complete, old DataStore file deleted")
        } catch (e: Exception) {
            Log.w(TAG, "Migration from old DataStore failed (non-fatal)", e)
        }
    }
}
