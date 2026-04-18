package com.zerohook.app.data.repository

import android.util.Log
import com.google.gson.JsonElement
import com.zerohook.app.data.local.TokenManager
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.dto.BrowseEngagementRequest
import com.zerohook.app.data.remote.dto.BrowseProfileDataDto
import com.zerohook.app.data.remote.dto.BrowseProfileDto
import com.zerohook.app.util.InteractionPolicy
import javax.inject.Inject
import javax.inject.Singleton

data class BrowseProfile(
    val id: String,
    val username: String,
    val displayName: String,
    val bio: String,
    val city: String,
    val country: String,
    val imageUrl: String?,
    val trustScore: Int,
    val recommendationScore: Double,
    val successRate: Double,
    val isOnline: Boolean,
    val isVerified: Boolean,
    val accountType: String,
    val basePrice: Double?,
    val distanceKm: Double?
)

@Singleton
class BrowseRepository @Inject constructor(
    private val api: ApiService,
    private val tokenManager: TokenManager
) {
    companion object {
        private const val TAG = "BrowseRepository"
    }

    suspend fun fetchProfiles(
        sort: String,
        search: String? = null,
        page: Int = 1,
        limit: Int = 20
    ): Result<List<BrowseProfile>> {
        return try {
            val response = api.getProfiles(
                limit = limit,
                page = page,
                sort = sort,
                surface = "auto",
                search = search?.takeIf { it.isNotBlank() }
            )

            if (!response.isSuccessful) {
                return Result.failure(Exception("Failed to fetch profiles: ${response.code()}"))
            }

            val body = response.body()
                ?: return Result.failure(Exception("Profiles response is empty"))

            if (!body.success) {
                return Result.failure(Exception(body.error ?: body.message ?: "Failed to load profiles"))
            }

            val responseUsers = if (body.users.isNotEmpty()) {
                body.users
            } else {
                body.data?.users.orEmpty()
            }

            val currentUserId = tokenManager.getUserId()
            val mapped = responseUsers
                .mapNotNull { mapProfile(it) }
                .filterNot { profile ->
                    !currentUserId.isNullOrBlank() && profile.id == currentUserId
                }

            Result.success(mapped)
        } catch (e: Exception) {
            Log.e(TAG, "fetchProfiles failed", e)
            Result.failure(e)
        }
    }

    suspend fun trackEngagement(
        profileId: String,
        actionType: String,
        metadata: Map<String, String> = emptyMap()
    ) {
        runCatching {
            api.trackProfileEngagement(
                BrowseEngagementRequest(
                    profileId = profileId,
                    actionType = actionType,
                    metadata = metadata
                )
            )
        }.onFailure { error ->
            Log.w(TAG, "trackEngagement failed: ${error.message}")
        }
    }

    fun fallbackProfiles(): List<BrowseProfile> {
        return listOf(
            BrowseProfile(
                id = "fallback_1",
                username = "nana_glow",
                displayName = "Nana",
                bio = "Trusted provider with quick responses and flexible availability.",
                city = "Tema",
                country = "Ghana",
                imageUrl = null,
                trustScore = 103,
                recommendationScore = 95.2,
                successRate = 98.0,
                isOnline = true,
                isVerified = true,
                    accountType = InteractionPolicy.ACCOUNT_TYPE_PROVIDER,
                basePrice = 1952.0,
                distanceKm = 4.1
            ),
            BrowseProfile(
                id = "fallback_2",
                username = "ama_prime",
                displayName = "Ama",
                bio = "Verified profile focused on secure bookings and clear communication.",
                city = "Accra",
                country = "Ghana",
                imageUrl = null,
                trustScore = 97,
                recommendationScore = 91.4,
                successRate = 95.0,
                isOnline = false,
                isVerified = true,
                    accountType = InteractionPolicy.ACCOUNT_TYPE_PROVIDER,
                basePrice = 1500.0,
                distanceKm = 8.7
            ),
            BrowseProfile(
                id = "fallback_3",
                username = "kesi_vibes",
                displayName = "Kesi",
                bio = "Highly rated for reliability, punctuality, and discreet communication.",
                city = "Kumasi",
                country = "Ghana",
                imageUrl = null,
                trustScore = 94,
                recommendationScore = 88.3,
                successRate = 93.0,
                isOnline = true,
                isVerified = false,
                    accountType = InteractionPolicy.ACCOUNT_TYPE_PROVIDER,
                basePrice = 1200.0,
                distanceKm = 16.2
            )
        )
    }

    private fun mapProfile(dto: BrowseProfileDto): BrowseProfile? {
        val id = clean(dto.id) ?: clean(dto.mongoId) ?: return null
        val username = clean(dto.username) ?: "user_${id.take(6)}"
        val profile = dto.profileData ?: dto.profileDataAlt

        val firstName = clean(profile?.firstName)
        val lastName = clean(profile?.lastName)
        val fullName = listOfNotNull(firstName, lastName).joinToString(" ").trim()
        val displayName = if (fullName.isBlank()) username else fullName

        val city = clean(profile?.location?.city) ?: clean(profile?.city) ?: "Unknown city"
        val country = clean(profile?.location?.country) ?: clean(profile?.country) ?: "Unknown country"
        val bio = clean(profile?.bio) ?: "Verified profile generated from recommendation engine."

        val imageUrl = listOfNotNull(
            clean(dto.profileImageUrl),
            extractMediaUrl(dto.profileImage),
            extractMediaUrl(profile?.profilePicture),
            extractMediaUrl(profile?.profilePictureAlt),
            clean(profile?.avatar),
            profile?.photos?.firstOrNull { !it.isNullOrBlank() }
        ).firstOrNull()

        val verificationTier = dto.verificationTier ?: dto.verificationTierAlt ?: 0
        val trustScore = dto.trustScore ?: dto.reputationScore ?: dto.reputationScoreAlt ?: 75
        val accountType = InteractionPolicy.normalizeAccountType(
            dto.profileData?.accountType
                ?: dto.profileDataAlt?.accountType
                ?: dto.profileData?.accountTypeAlt
                ?: dto.profileDataAlt?.accountTypeAlt
                ?: dto.accountType
                ?: dto.accountTypeAlt
        ) ?: InteractionPolicy.ACCOUNT_TYPE_PROVIDER

        return BrowseProfile(
            id = id,
            username = username,
            displayName = displayName,
            bio = bio,
            city = city,
            country = country,
            imageUrl = imageUrl,
            trustScore = trustScore,
            recommendationScore = dto.recommendationScore ?: 0.0,
            successRate = dto.successRate ?: 0.0,
            isOnline = dto.isOnline ?: dto.isOnlineAlt ?: false,
            isVerified = verificationTier >= 2,
            accountType = accountType,
            basePrice = profile?.basePrice,
            distanceKm = dto.distance
        )
    }

    private fun extractMediaUrl(value: JsonElement?): String? {
        if (value == null || value.isJsonNull) return null

        return when {
            value.isJsonPrimitive && value.asJsonPrimitive.isString -> clean(value.asString)
            value.isJsonObject -> {
                val obj = value.asJsonObject
                val keys = listOf("url", "secure_url", "src", "value")
                keys.firstNotNullOfOrNull { key ->
                    obj.get(key)?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }?.asString
                }?.let { clean(it) }
            }
            else -> null
        }
    }

    private fun clean(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        return trimmed.takeIf { it.isNotBlank() }
    }
}
