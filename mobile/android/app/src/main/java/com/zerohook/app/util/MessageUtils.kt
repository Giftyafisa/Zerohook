package com.zerohook.app.util

import com.zerohook.app.BuildConfig

/**
 * Message utility functions — mirrors the web ChatSystem.js fixes.
 *
 * Key fixes ported from web audit:
 * - Comprehensive URL detection (query params, Cloudinary, data: URIs)
 * - Media type detection with friendly labels
 * - Same normalization applied in conversation list previews
 */
object MessageUtils {

    private val IMAGE_EXTENSIONS = setOf(
        "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif", "heic", "heif", "avif"
    )
    private val VIDEO_EXTENSIONS = setOf(
        "mp4", "mov", "avi", "mkv", "webm", "wmv", "flv", "m4v", "3gp"
    )
    private val AUDIO_EXTENSIONS = setOf(
        "mp3", "wav", "ogg", "aac", "flac", "m4a", "wma"
    )

    /**
     * Checks whether [text] looks like a URL. Handles:
     * - Standard https/http URLs
     * - Cloudinary / S3 / cloud-hosted URLs with query params
     * - data: URIs
     * - URLs with authentication tokens or long query strings
     */
    fun isLikelyUrl(text: String?): Boolean {
        if (text.isNullOrBlank()) return false
        val trimmed = text.trim()
        if (trimmed.startsWith("data:")) return true
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return true
        if (trimmed.startsWith("blob:")) return true
        if (trimmed.startsWith("/uploads/") || trimmed.startsWith("uploads/")) return true
        // URL without scheme but with cloud host patterns
        val cloudHosts = listOf("cloudinary.com", "amazonaws.com", "firebasestorage", "supabase")
        if (cloudHosts.any { trimmed.contains(it, ignoreCase = true) }) return true

        // Also treat bare file names with known media extensions as URLs
        // (e.g., "IMG_1234.jpg" sent from older clients / upload endpoints)
        val knownExtensions = (IMAGE_EXTENSIONS + VIDEO_EXTENSIONS + AUDIO_EXTENSIONS + setOf("pdf", "doc", "docx"))
        val fileNamePattern = Regex("^[^\\s]+\\.(${knownExtensions.joinToString("|")})$", RegexOption.IGNORE_CASE)
        if (fileNamePattern.matches(trimmed)) return true

        return false
    }

    /** Converts relative media paths into absolute URLs consumable by image loaders. */
    fun resolveMediaUrl(url: String?): String {
        if (url.isNullOrBlank()) return ""
        val trimmed = url.trim()
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
            return trimmed
        }
        if (trimmed.startsWith("/")) {
            return "${BuildConfig.SOCKET_URL}$trimmed"
        }
        return "${BuildConfig.SOCKET_URL}/$trimmed"
    }

    /**
     * Detects media type from a URL string.
     * Returns a pair of (emoji, label) e.g. ("📷", "Photo").
     */
    fun getMediaType(url: String): Pair<String, String> {
        val lower = url.lowercase()

        // data: URI
        if (lower.startsWith("data:image")) return "📷" to "Photo"
        if (lower.startsWith("data:video")) return "🎬" to "Video"
        if (lower.startsWith("data:audio")) return "🎵" to "Audio"
        if (lower.startsWith("data:")) return "📎" to "File"

        // Strip query params and fragments for extension detection
        val pathPart = lower.split("?").first().split("#").first()
        val ext = pathPart.substringAfterLast('.', "")

        if (ext in IMAGE_EXTENSIONS) return "📷" to "Photo"
        if (ext in VIDEO_EXTENSIONS) return "🎬" to "Video"
        if (ext in AUDIO_EXTENSIONS) return "🎵" to "Audio"
        if (ext == "pdf") return "📄" to "PDF"
        if (ext == "doc" || ext == "docx") return "📄" to "Document"

        // Cloud image service patterns (even without file extension)
        val imageHosts = listOf("cloudinary.com/", "imgur.com/", "/image/upload/", "/images/", "/photos/")
        if (imageHosts.any { lower.contains(it) }) return "📷" to "Photo"

        val videoHosts = listOf("/video/upload/", "/videos/")
        if (videoHosts.any { lower.contains(it) }) return "🎬" to "Video"

        return "📎" to "File"
    }

    /**
     * Normalizes a last-message preview — if it's a URL, replace with a friendly label.
     * Same logic as `normalizeLastMessagePreview()` in server/routes/chat.js.
     */
    fun normalizePreview(content: String?, messageType: String? = null): String {
        if (content.isNullOrBlank()) return ""

        // If messageType explicitly says image/video/file, use that
        when (messageType?.lowercase()) {
            "image" -> return "📷 Photo"
            "video" -> return "🎬 Video"
            "audio" -> return "🎵 Audio"
            "file" -> return "📎 File"
        }

        val trimmed = content.trim()
        if (isLikelyUrl(trimmed)) {
            val (emoji, label) = getMediaType(trimmed)
            return "$emoji $label"
        }

        return trimmed
    }

    /**
     * Formats a message timestamp for display.
     * Returns relative time like "Just now", "2m ago", "1h ago", or date.
     *
     * FIX: Server sends various ISO formats including:
     * - 2025-01-15T10:30:00.000Z (with millis + Z)
     * - 2025-01-15T10:30:00Z (no millis + Z)
     * - 2025-01-15T10:30:00 (no millis or Z)
     * We strip trailing Z and try multiple formats.
     */
    fun formatRelativeTime(isoTimestamp: String?): String {
        if (isoTimestamp.isNullOrBlank()) return ""
        return try {
            // Normalize: strip trailing Z (we set timezone to UTC explicitly)
            val normalized = isoTimestamp.trim().removeSuffix("Z").removeSuffix("z")

            // Try format with milliseconds first, then without
            val formats = listOf(
                "yyyy-MM-dd'T'HH:mm:ss.SSS",
                "yyyy-MM-dd'T'HH:mm:ss.SS",
                "yyyy-MM-dd'T'HH:mm:ss.S",
                "yyyy-MM-dd'T'HH:mm:ss"
            )

            var date: java.util.Date? = null
            for (fmt in formats) {
                try {
                    val sdf = java.text.SimpleDateFormat(fmt, java.util.Locale.US)
                    sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                    date = sdf.parse(normalized)
                    if (date != null) break
                } catch (_: Exception) {}
            }

            if (date == null) return isoTimestamp

            val now = System.currentTimeMillis()
            val diff = now - date.time

            when {
                diff < 0 -> "Just now"  // clock skew
                diff < 60_000 -> "Just now"
                diff < 3_600_000 -> "${diff / 60_000}m ago"
                diff < 86_400_000 -> "${diff / 3_600_000}h ago"
                diff < 604_800_000 -> "${diff / 86_400_000}d ago"
                else -> {
                    val displayFmt = java.text.SimpleDateFormat("MMM d", java.util.Locale.US)
                    displayFmt.format(date)
                }
            }
        } catch (_: Exception) {
            isoTimestamp
        }
    }
}
