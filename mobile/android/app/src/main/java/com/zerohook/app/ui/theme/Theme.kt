package com.zerohook.app.ui.theme

import android.app.Activity
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

// Zerohook brand palette
private val NeonCyan = Color(0xFF00E8E0)
private val DeepCyan = Color(0xFF00AFA8)
private val Night = Color(0xFF06070D)
private val NightSurface = Color(0xFF10131C)
private val NightCard = Color(0xFF171B27)
private val NightCardStrong = Color(0xFF1E2331)
private val OnNight = Color(0xFFF0F3FA)
private val OnNightMuted = Color(0xFFA3AEC6)
private val Danger = Color(0xFFFF5D72)
private val Success = Color(0xFF48D597)

private val DarkColorScheme = darkColorScheme(
    primary = NeonCyan,
    onPrimary = Night,
    primaryContainer = DeepCyan,
    onPrimaryContainer = Night,
    secondary = Color(0xFF6EA9FF),
    onSecondary = Night,
    tertiary = Success,
    onTertiary = Night,
    background = Night,
    onBackground = OnNight,
    surface = NightSurface,
    onSurface = OnNight,
    surfaceVariant = NightCard,
    onSurfaceVariant = OnNightMuted,
    surfaceTint = NeonCyan,
    inverseSurface = OnNight,
    inverseOnSurface = Night,
    error = Danger,
    onError = Night,
    outline = Color(0xFF2E3447),
    outlineVariant = Color(0xFF24293A)
)

private val ZerohookTypography = Typography(
    headlineMedium = TextStyle(
        fontSize = 34.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.2.sp
    ),
    headlineSmall = TextStyle(
        fontSize = 28.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.1.sp
    ),
    titleLarge = TextStyle(
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.1.sp
    ),
    titleMedium = TextStyle(
        fontSize = 18.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.1.sp
    ),
    bodyLarge = TextStyle(
        fontSize = 16.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 24.sp
    ),
    bodyMedium = TextStyle(
        fontSize = 14.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 21.sp
    ),
    labelLarge = TextStyle(
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.1.sp
    )
)

private val ZerohookShapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
    small = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
    medium = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
    large = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(32.dp)
)

@Composable
fun ZerohookTheme(content: @Composable () -> Unit) {
    val colorScheme = DarkColorScheme // Always dark — matches the web app

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            window.navigationBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = ZerohookTypography,
        shapes = ZerohookShapes,
        content = content
    )
}
