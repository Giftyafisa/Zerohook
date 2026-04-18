package com.zerohook.app.data.remote

import com.zerohook.app.data.local.TokenManager
import com.zerohook.app.data.remote.dto.RefreshRequest
import com.google.gson.Gson
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.util.concurrent.locks.ReentrantLock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp interceptor that:
 * 1. Attaches the JWT Bearer token to every API request
 * 2. On 401 response, attempts to refresh the token using the stored refresh token
 * 3. Uses a mutex to prevent concurrent refresh attempts (queue pattern)
 * 4. Retries the original request with the new token
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager
) : Interceptor {

    private val gson = Gson()
    private val refreshLock = ReentrantLock()

    companion object {
        private val AUTH_SKIP_PATHS = setOf("/auth/login", "/auth/register", "/auth/refresh")
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val path = request.url.encodedPath

        // Skip auth header for login/register/refresh endpoints
        if (AUTH_SKIP_PATHS.any { path.endsWith(it) }) {
            return chain.proceed(request)
        }

        val token = runBlocking { tokenManager.tokenFlow.firstOrNull() }
        val authenticatedRequest = request.withBearerToken(token)
        val response = chain.proceed(authenticatedRequest)

        // If not 401, return as-is
        if (response.code != 401) return response

        // 401 received — attempt token refresh
        return handleTokenRefresh(chain, authenticatedRequest, response)
    }

    private fun handleTokenRefresh(
        chain: Interceptor.Chain,
        originalRequest: Request,
        failedResponse: Response
    ): Response {
        // Use lock to prevent concurrent refresh attempts
        refreshLock.lock()
        try {
            // Check if another thread already refreshed the token while we waited
            val currentToken = runBlocking { tokenManager.tokenFlow.firstOrNull() }
            val originalToken = originalRequest.header("Authorization")?.removePrefix("Bearer ")

            if (currentToken != null && currentToken != originalToken) {
                // Token was already refreshed by another thread — retry with new token
                failedResponse.close()
                return chain.proceed(originalRequest.withBearerToken(currentToken))
            }

            // We need to perform the refresh
            val refreshToken = runBlocking { tokenManager.getRefreshToken() }
            if (refreshToken.isNullOrBlank()) {
                // No refresh token available — user must re-login
                runBlocking { tokenManager.clearSession() }
                return failedResponse
            }

            // Build refresh request
            val refreshBody = gson.toJson(RefreshRequest(refreshToken))
                .toRequestBody("application/json".toMediaType())

            val baseUrl = originalRequest.url.scheme + "://" + originalRequest.url.host +
                    (if (originalRequest.url.port != 80 && originalRequest.url.port != 443)
                        ":${originalRequest.url.port}" else "")

            val refreshRequest = Request.Builder()
                .url("$baseUrl/api/auth/refresh")
                .post(refreshBody)
                .build()

            val refreshResponse = chain.proceed(refreshRequest)

            if (refreshResponse.isSuccessful) {
                val body = refreshResponse.body?.string()
                refreshResponse.close()

                if (body != null) {
                    val authResponse = gson.fromJson(body, com.zerohook.app.data.remote.dto.AuthResponse::class.java)
                    if (authResponse?.success == true && !authResponse.token.isNullOrBlank()) {
                        // Save new tokens
                        runBlocking {
                            tokenManager.updateTokens(
                                accessToken = authResponse.token,
                                refreshToken = authResponse.refreshToken
                            )
                        }

                        // Retry original request with new token
                        failedResponse.close()
                        return chain.proceed(originalRequest.withBearerToken(authResponse.token))
                    }
                }
            } else {
                refreshResponse.close()
            }

            // Refresh failed — clear session, user must re-login
            runBlocking { tokenManager.clearSession() }
            return failedResponse

        } finally {
            refreshLock.unlock()
        }
    }

    private fun Request.withBearerToken(token: String?): Request {
        return if (!token.isNullOrBlank()) {
            newBuilder().header("Authorization", "Bearer $token").build()
        } else {
            this
        }
    }
}
