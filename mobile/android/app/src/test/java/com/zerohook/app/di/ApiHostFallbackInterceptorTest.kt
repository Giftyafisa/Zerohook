package com.zerohook.app.di

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.net.ServerSocket
import java.util.concurrent.TimeUnit

class ApiHostFallbackInterceptorTest {

    private lateinit var fallbackServer: MockWebServer

    @Before
    fun setUp() {
        fallbackServer = MockWebServer()
        fallbackServer.start()
    }

    @After
    fun tearDown() {
        fallbackServer.shutdown()
    }

    @Test
    fun retriesOnConnectFailureUsingFallbackHost() {
        fallbackServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("{\"success\":true}")
        )

        val closedPort = reserveClosedPort()
        val client = OkHttpClient.Builder()
            .connectTimeout(1, TimeUnit.SECONDS)
            .readTimeout(1, TimeUnit.SECONDS)
            .writeTimeout(1, TimeUnit.SECONDS)
            .addInterceptor(ApiHostFallbackInterceptor(fallbackServer.url("/api/")))
            .build()

        val request = Request.Builder()
            .url("http://127.0.0.1:$closedPort/api/users/profiles?limit=3")
            .build()

        client.newCall(request).execute().use { response ->
            assertTrue(response.isSuccessful)
            assertEquals(200, response.code)
        }

        val retried = fallbackServer.takeRequest(2, TimeUnit.SECONDS)
        assertEquals("/api/users/profiles?limit=3", retried?.path)
        assertEquals("1", retried?.getHeader(ApiHostFallbackInterceptor.HEADER_FALLBACK_ATTEMPT))
    }

    @Test(expected = IOException::class)
    fun doesNotRetryWhenFallbackIsUnset() {
        val closedPort = reserveClosedPort()
        val client = OkHttpClient.Builder()
            .connectTimeout(1, TimeUnit.SECONDS)
            .readTimeout(1, TimeUnit.SECONDS)
            .writeTimeout(1, TimeUnit.SECONDS)
            .addInterceptor(ApiHostFallbackInterceptor(null))
            .build()

        val request = Request.Builder()
            .url("http://127.0.0.1:$closedPort/api/status")
            .build()

        client.newCall(request).execute().close()
    }

    @Test
    fun doesNotFallbackOnHttpServerErrorResponse() {
        val primaryServer = MockWebServer()
        primaryServer.start()

        try {
            primaryServer.enqueue(
                MockResponse()
                    .setResponseCode(500)
                    .setBody("{\"success\":false,\"message\":\"server error\"}")
            )
            fallbackServer.enqueue(
                MockResponse()
                    .setResponseCode(200)
                    .setBody("{\"success\":true}")
            )

            val client = OkHttpClient.Builder()
                .connectTimeout(1, TimeUnit.SECONDS)
                .readTimeout(1, TimeUnit.SECONDS)
                .writeTimeout(1, TimeUnit.SECONDS)
                .addInterceptor(ApiHostFallbackInterceptor(fallbackServer.url("/api/")))
                .build()

            val request = Request.Builder()
                .url(primaryServer.url("/api/status"))
                .build()

            client.newCall(request).execute().use { response ->
                assertEquals(500, response.code)
            }

            val primaryRequest = primaryServer.takeRequest(2, TimeUnit.SECONDS)
            assertEquals("/api/status", primaryRequest?.path)
            assertNull(primaryRequest?.getHeader(ApiHostFallbackInterceptor.HEADER_FALLBACK_ATTEMPT))

            val fallbackRequest = fallbackServer.takeRequest(300, TimeUnit.MILLISECONDS)
            assertNull(fallbackRequest)
        } finally {
            primaryServer.shutdown()
        }
    }

    private fun reserveClosedPort(): Int {
        ServerSocket(0).use { socket ->
            return socket.localPort
        }
    }
}