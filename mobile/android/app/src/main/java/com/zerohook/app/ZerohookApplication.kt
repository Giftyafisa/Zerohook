package com.zerohook.app

import android.app.Activity
import android.app.Application
import android.os.Bundle
import androidx.work.Configuration
import dagger.hilt.android.HiltAndroidApp

/**
 * Zerohook Application class — entry point for Hilt DI.
 *
 * This class is referenced in AndroidManifest.xml as android:name=".ZerohookApplication".
 * Hilt requires exactly one @HiltAndroidApp-annotated Application subclass.
 *
 * Implements Configuration.Provider because the manifest removes the default WorkManager
 * initializer (to avoid auto-init before Hilt is ready). This provides a custom
 * Configuration so WorkManager.getInstance(context) works correctly.
 */
@HiltAndroidApp
class ZerohookApplication : Application(), Configuration.Provider {

    companion object {
        @Volatile
        var isInForeground: Boolean = false
            private set
    }

    private var startedActivities = 0

    override fun onCreate() {
        super.onCreate()
        registerActivityLifecycleCallbacks(object : ActivityLifecycleCallbacks {
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit

            override fun onActivityStarted(activity: Activity) {
                startedActivities += 1
                if (startedActivities > 0) {
                    isInForeground = true
                }
            }

            override fun onActivityResumed(activity: Activity) = Unit

            override fun onActivityPaused(activity: Activity) = Unit

            override fun onActivityStopped(activity: Activity) {
                startedActivities = (startedActivities - 1).coerceAtLeast(0)
                isInForeground = startedActivities > 0
            }

            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

            override fun onActivityDestroyed(activity: Activity) = Unit
        })
        // Future: initialize Timber, Coil defaults, crash reporting, etc.
    }

    /**
     * Custom WorkManager configuration.
     * Uses default thread pool; adjust if background sync tasks need custom threading.
     */
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()
}
