package com.zerohook.app.util

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager

/**
 * Groups of dangerous permissions the app may need at runtime.
 * Each group maps to a feature that can be independently requested.
 */
object AppPermissions {

    /** Microphone only for audio calls */
    val AUDIO_CALL = buildList {
        add(Manifest.permission.RECORD_AUDIO)
    }

    /** Camera + microphone for video calls */
    val VIDEO_CALL = buildList {
        add(Manifest.permission.CAMERA)
        add(Manifest.permission.RECORD_AUDIO)
    }

    /** Fine + coarse location for Uber/Bolt-style proximity */
    val LOCATION = buildList {
        add(Manifest.permission.ACCESS_FINE_LOCATION)
        add(Manifest.permission.ACCESS_COARSE_LOCATION)
    }

    /** Media access — photo picker on API 33+, legacy storage below */
    val MEDIA = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.READ_MEDIA_IMAGES)
        } else {
            add(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    /** Notification permission (API 33+) */
    val NOTIFICATIONS = buildList {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
}

/**
 * Composable that provides a launcher to request a set of permissions.
 *
 * Usage:
 * ```
 * val (allGranted, requestPermissions) = rememberPermissionRequest(
 *     permissions = AppPermissions.VIDEO_CALL,
 *     onResult = { granted -> if (!granted) showRationale() }
 * )
 * Button(onClick = { requestPermissions() }) { Text("Start call") }
 * ```
 *
 * @param permissions list of Android permission strings to request
 * @param onResult callback receiving true if ALL permissions are granted
 * @return Pair(allCurrentlyGranted, launchRequest)
 */
@Composable
fun rememberPermissionRequest(
    permissions: List<String>,
    onResult: (Boolean) -> Unit = {}
): Pair<Boolean, () -> Unit> {
    val context = LocalContext.current

    fun checkAllGranted(): Boolean = permissions.all {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }

    // Keep permission state reactive after launcher callback
    var allGranted by remember(permissions) {
        mutableStateOf(checkAllGranted())
    }

    LaunchedEffect(context, permissions) {
        allGranted = checkAllGranted()
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val granted = results.values.all { it }
        allGranted = granted
        onResult(granted)
    }

    val launch: () -> Unit = {
        val currentlyGranted = checkAllGranted()
        allGranted = currentlyGranted
        if (currentlyGranted) {
            onResult(true)
        } else {
            launcher.launch(permissions.toTypedArray())
        }
    }

    return Pair(allGranted, launch)
}
