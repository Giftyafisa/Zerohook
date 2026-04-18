package com.zerohook.app.di

import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

class ApiHostFallbackInterceptor(
    private val fallbackBaseUrl: HttpUrl?
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        return try {
            chain.proceed(request)
        } catch (error: IOException) {
            val configuredFallback = fallbackBaseUrl
            val alreadyRetried = request.header(HEADER_FALLBACK_ATTEMPT) == "1"

            if (configuredFallback == null || alreadyRetried || !isRetryableIOException(error)) {
                throw error
            }

            val retryUrl = rewriteRequestUrl(request.url, configuredFallback)
            if (retryUrl == request.url) {
                throw error
            }

            val retryRequest = request.newBuilder()
                .url(retryUrl)
                .header(HEADER_FALLBACK_ATTEMPT, "1")
                .build()

            chain.proceed(retryRequest)
        }
    }

    internal fun rewriteRequestUrl(originalUrl: HttpUrl, fallbackUrl: HttpUrl): HttpUrl {
        return originalUrl.newBuilder()
            .scheme(fallbackUrl.scheme)
            .host(fallbackUrl.host)
            .port(fallbackUrl.port)
            .build()
    }

    internal fun isRetryableIOException(error: IOException): Boolean {
        return error is UnknownHostException ||
            error is ConnectException ||
            error is SocketTimeoutException ||
            error is SSLException
    }

    companion object {
        const val HEADER_FALLBACK_ATTEMPT = "X-ZH-Api-Fallback-Attempt"
    }
}