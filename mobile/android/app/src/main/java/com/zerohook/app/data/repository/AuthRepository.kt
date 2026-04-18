package com.zerohook.app.data.repository

import com.zerohook.app.data.local.TokenManager
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.dto.LoginRequest
import com.zerohook.app.data.remote.dto.RegisterDeviceTokenRequest
import com.zerohook.app.data.remote.dto.RegisterRequest
import org.json.JSONObject
import retrofit2.Response
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val api: ApiService,
    private val tokenManager: TokenManager
) {

    private fun parseApiError(response: Response<*>, fallback: String): String {
        return try {
            val raw = response.errorBody()?.string().orEmpty()
            if (raw.isBlank()) {
                "$fallback (${response.code()})"
            } else {
                val json = JSONObject(raw)
                val message = json.optString("message").takeIf { it.isNotBlank() }
                    ?: json.optString("error").takeIf { it.isNotBlank() }
                message ?: "$fallback (${response.code()})"
            }
        } catch (_: Exception) {
            "$fallback (${response.code()})"
        }
    }

    suspend fun login(identifier: String, password: String): Result<String> {
        return try {
            val normalizedIdentifier = identifier.trim()
            val request = if (normalizedIdentifier.contains("@")) {
                LoginRequest(email = normalizedIdentifier, password = password)
            } else {
                LoginRequest(username = normalizedIdentifier, password = password)
            }

            val response = api.login(request)
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.token != null && body.user != null) {
                    val resolvedAccountType = body.user.profileData?.accountType
                        ?: body.user.accountType
                        ?: "client"
                    tokenManager.saveSession(
                        token = body.token,
                        userId = body.user.id,
                        username = body.user.username,
                        accountType = resolvedAccountType,
                        refreshToken = body.refreshToken
                    )
                    Result.success(body.user.id)
                } else {
                    Result.failure(Exception(body?.message ?: "Login failed"))
                }
            } else {
                Result.failure(Exception(parseApiError(response, "Login failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(username: String, email: String, password: String, accountType: String): Result<String> {
        return try {
            val response = api.register(RegisterRequest(
                username = username,
                email = email,
                password = password,
                accountType = accountType
            ))
            if (response.isSuccessful) {
                val body = response.body()
                if (body?.success == true && body.token != null && body.user != null) {
                    val resolvedAccountType = body.user.profileData?.accountType
                        ?: body.user.accountType
                        ?: accountType
                    tokenManager.saveSession(
                        token = body.token,
                        userId = body.user.id,
                        username = body.user.username,
                        accountType = resolvedAccountType,
                        refreshToken = body.refreshToken
                    )
                    Result.success(body.user.id)
                } else {
                    Result.failure(Exception(body?.message ?: "Registration failed"))
                }
            } else {
                Result.failure(Exception(parseApiError(response, "Registration failed")))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun validateToken(): Boolean {
        return try {
            val token = tokenManager.getToken() ?: return false
            val response = api.validateToken(com.zerohook.app.data.remote.dto.ValidateTokenRequest(token))
            val body = response.body()
            if (response.isSuccessful && body?.valid == true && body.user != null) {
                val currentRefreshToken = tokenManager.getRefreshToken()
                val resolvedAccountType = body.user.profileData?.accountType
                    ?: body.user.accountType
                    ?: tokenManager.accountTypeFlow.value
                    ?: "client"

                tokenManager.saveSession(
                    token = token,
                    userId = body.user.id,
                    username = body.user.username,
                    accountType = resolvedAccountType,
                    refreshToken = currentRefreshToken
                )
                true
            } else {
                false
            }
        } catch (_: Exception) {
            false
        }
    }

    suspend fun logout() {
        tokenManager.clearSession()
    }

    suspend fun syncDeviceTokenIfAvailable() {
        val token = tokenManager.getFcmToken() ?: return
        if (token.isBlank()) return

        try {
            api.registerDeviceToken(
                RegisterDeviceTokenRequest(token = token)
            )
        } catch (_: Exception) {
            // Non-fatal: keep auth flow resilient; token can be retried later
        }
    }
}
