package com.zerohook.app.di

import android.util.Log
import com.zerohook.app.BuildConfig
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.AuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val TAG = "NetworkModule"
    private const val DEFAULT_API_BASE_URL = "https://zerohook-api-eoyr.onrender.com/api/"

    private fun resolveApiBaseUrl(rawBaseUrl: String): String {
        val candidate = rawBaseUrl.trim()
        if (candidate.isBlank()) return DEFAULT_API_BASE_URL

        val normalized = if (candidate.endsWith("/")) candidate else "$candidate/"
        val parsed = normalized.toHttpUrlOrNull()
        if (parsed == null) return DEFAULT_API_BASE_URL

        if (parsed.scheme != "http" && parsed.scheme != "https") {
            return DEFAULT_API_BASE_URL
        }

        return parsed.toString()
    }

    private fun resolveApiFallbackBaseUrl(rawFallbackBaseUrl: String, primaryBaseUrl: String): HttpUrl? {
        val candidate = rawFallbackBaseUrl.trim()
        if (candidate.isBlank()) return null

        val normalized = if (candidate.endsWith("/")) candidate else "$candidate/"
        val parsedFallback = normalized.toHttpUrlOrNull() ?: return null
        if (parsedFallback.scheme != "http" && parsedFallback.scheme != "https") {
            return null
        }

        val parsedPrimary = primaryBaseUrl.toHttpUrlOrNull() ?: return null
        val sameEndpoint = parsedFallback.scheme == parsedPrimary.scheme &&
            parsedFallback.host.equals(parsedPrimary.host, ignoreCase = true) &&
            parsedFallback.port == parsedPrimary.port

        return if (sameEndpoint) null else parsedFallback
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        val primaryBaseUrl = resolveApiBaseUrl(BuildConfig.API_BASE_URL)
        val fallbackBaseUrl = resolveApiFallbackBaseUrl(
            BuildConfig.API_BASE_URL_FALLBACK,
            primaryBaseUrl
        )

        val builder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)

        if (fallbackBaseUrl != null) {
            builder.addInterceptor(ApiHostFallbackInterceptor(fallbackBaseUrl))
            if (BuildConfig.DEBUG) {
                Log.i(
                    TAG,
                    "API fallback enabled: ${fallbackBaseUrl.scheme}://${fallbackBaseUrl.host}:${fallbackBaseUrl.port}"
                )
            }
        }

        builder.addInterceptor(authInterceptor)

        if (BuildConfig.DEBUG) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(logging)
        }

        return builder.build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        // BuildConfig.API_BASE_URL comes from local.properties / build.gradle.kts.
        // Guard against malformed values (e.g. "/") that crash Retrofit at startup.
        val baseUrl = resolveApiBaseUrl(BuildConfig.API_BASE_URL)
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        return retrofit.create(ApiService::class.java)
    }
}
