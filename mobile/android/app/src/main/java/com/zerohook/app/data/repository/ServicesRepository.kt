package com.zerohook.app.data.repository

import android.util.Log
import com.google.gson.JsonElement
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.dto.AdultServiceDto
import com.zerohook.app.data.remote.dto.ServiceCategoryDto
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

data class ServiceCategory(
    val id: String,
    val name: String,
    val description: String,
    val icon: String?,
    val startingPrice: Double?,
    val maxPrice: Double?
)

data class ServiceProvider(
    val id: String,
    val username: String,
    val verificationTier: Int,
    val trustScore: Int?,
    val trustLabel: String,
    val isVerified: Boolean,
    val isOnline: Boolean,
    val locationLabel: String,
    val avatarUrl: String?
)

data class ServiceListing(
    val id: String,
    val title: String,
    val description: String,
    val categoryId: String,
    val categoryLabel: String,
    val price: Double,
    val durationMinutes: Int?,
    val locationLabel: String,
    val imageUrl: String?,
    val likesCount: Int,
    val isActive: Boolean,
    val provider: ServiceProvider
)

@Singleton
class ServicesRepository @Inject constructor(
    private val api: ApiService
) {

    companion object {
        private const val TAG = "ServicesRepository"
    }

    suspend fun fetchCategories(): Result<List<ServiceCategory>> {
        return try {
            val response = api.getServiceCategories()
            if (!response.isSuccessful) {
                return Result.failure(Exception("Failed to fetch categories: ${response.code()}"))
            }

            val body = response.body()
                ?: return Result.failure(Exception("Categories response is empty"))

            val categories = body.categories.mapNotNull { mapCategory(it) }
            Result.success(categories)
        } catch (e: Exception) {
            Log.e(TAG, "fetchCategories failed", e)
            Result.failure(e)
        }
    }

    suspend fun fetchServices(
        categoryId: String? = null,
        searchQuery: String? = null
    ): Result<List<ServiceListing>> {
        return try {
            val trimmedSearch = searchQuery?.trim().orEmpty()
            val response = if (trimmedSearch.isNotBlank()) {
                api.searchAdultServices(
                    term = trimmedSearch,
                    category = categoryId?.takeIf { it.isNotBlank() && it != "all" }
                )
            } else {
                api.getAdultServices(
                    category = categoryId?.takeIf { it.isNotBlank() && it != "all" },
                    page = 1,
                    limit = 40
                )
            }

            if (!response.isSuccessful) {
                return Result.failure(Exception("Failed to fetch services: ${response.code()}"))
            }

            val payload = response.body()
                ?: return Result.failure(Exception("Services response is empty"))

            val (success, error, services) = when {
                trimmedSearch.isNotBlank() -> {
                    val searchBody = payload as com.zerohook.app.data.remote.dto.ServiceSearchResponse
                    Triple(searchBody.success, searchBody.error ?: searchBody.message, searchBody.searchResults)
                }

                else -> {
                    val listBody = payload as com.zerohook.app.data.remote.dto.AdultServicesResponse
                    Triple(listBody.success, listBody.error ?: listBody.message, listBody.services)
                }
            }

            if (!success) {
                return Result.failure(Exception(error ?: "Unable to load services"))
            }

            val mapped = services.mapNotNull { mapService(it) }
            Result.success(mapped)
        } catch (e: Exception) {
            Log.e(TAG, "fetchServices failed", e)
            Result.failure(e)
        }
    }

    fun fallbackCategories(): List<ServiceCategory> {
        return listOf(
            ServiceCategory(
                id = "long-term",
                name = "Long Term",
                description = "Serious relationships and ongoing arrangements",
                icon = "LT",
                startingPrice = 100.0,
                maxPrice = 1000.0
            ),
            ServiceCategory(
                id = "short-term",
                name = "Short Term",
                description = "Casual dating and one-time services",
                icon = "ST",
                startingPrice = 150.0,
                maxPrice = 500.0
            ),
            ServiceCategory(
                id = "oral-services",
                name = "Oral Services",
                description = "Discrete and intimate experiences",
                icon = "OR",
                startingPrice = 80.0,
                maxPrice = 300.0
            ),
            ServiceCategory(
                id = "special-services",
                name = "Special Services",
                description = "Premium and exclusive offerings",
                icon = "SP",
                startingPrice = 200.0,
                maxPrice = 2000.0
            )
        )
    }

    fun fallbackServices(categoryId: String? = null, searchQuery: String? = null): List<ServiceListing> {
        val base = listOf(
            ServiceListing(
                id = "fallback_service_1",
                title = "Premium Companionship",
                description = "Trusted provider with secure booking flow and fast response times.",
                categoryId = "long-term",
                categoryLabel = "Long Term",
                price = 250000.0,
                durationMinutes = 120,
                locationLabel = "Lagos, Nigeria",
                imageUrl = null,
                likesCount = 45,
                isActive = true,
                provider = ServiceProvider(
                    id = "",
                    username = "EliteCompanion",
                    verificationTier = 3,
                    trustScore = 92,
                    trustLabel = "Excellent (90-100)",
                    isVerified = true,
                    isOnline = true,
                    locationLabel = "Lagos, Nigeria",
                    avatarUrl = null
                )
            ),
            ServiceListing(
                id = "fallback_service_2",
                title = "VIP Experience",
                description = "Exclusive premium package for private events and high-security venues.",
                categoryId = "special-services",
                categoryLabel = "Special Services",
                price = 500000.0,
                durationMinutes = 180,
                locationLabel = "Abuja, Nigeria",
                imageUrl = null,
                likesCount = 67,
                isActive = true,
                provider = ServiceProvider(
                    id = "",
                    username = "LuxuryQueen",
                    verificationTier = 3,
                    trustScore = 88,
                    trustLabel = "Very Good (80-89)",
                    isVerified = true,
                    isOnline = false,
                    locationLabel = "Abuja, Nigeria",
                    avatarUrl = null
                )
            ),
            ServiceListing(
                id = "fallback_service_3",
                title = "Casual Dates",
                description = "Flexible short-term engagements with verified provider history.",
                categoryId = "short-term",
                categoryLabel = "Short Term",
                price = 150000.0,
                durationMinutes = 90,
                locationLabel = "Accra, Ghana",
                imageUrl = null,
                likesCount = 23,
                isActive = true,
                provider = ServiceProvider(
                    id = "",
                    username = "CasualStar",
                    verificationTier = 2,
                    trustScore = 78,
                    trustLabel = "Good (70-79)",
                    isVerified = true,
                    isOnline = true,
                    locationLabel = "Accra, Ghana",
                    avatarUrl = null
                )
            )
        )

        val byCategory = categoryId
            ?.takeIf { it.isNotBlank() && it != "all" }
            ?.let { requested -> base.filter { it.categoryId == requested } }
            ?: base

        val normalized = searchQuery?.trim()?.lowercase(Locale.getDefault()).orEmpty()
        if (normalized.isBlank()) return byCategory

        return byCategory.filter { service ->
            service.title.lowercase(Locale.getDefault()).contains(normalized) ||
                service.description.lowercase(Locale.getDefault()).contains(normalized) ||
                service.provider.username.lowercase(Locale.getDefault()).contains(normalized) ||
                service.locationLabel.lowercase(Locale.getDefault()).contains(normalized)
        }
    }

    private fun mapCategory(dto: ServiceCategoryDto): ServiceCategory? {
        val id = clean(dto.id) ?: return null
        val name = clean(dto.displayName) ?: clean(dto.name) ?: humanize(id)
        return ServiceCategory(
            id = id,
            name = name,
            description = clean(dto.description) ?: "",
            icon = clean(dto.icon),
            startingPrice = dto.startingPrice,
            maxPrice = dto.maxPrice
        )
    }

    private fun mapService(dto: AdultServiceDto): ServiceListing? {
        val serviceId = clean(dto.id) ?: clean(dto.mongoId) ?: return null
        val provider = dto.provider

        val providerId = clean(provider?.id)
            ?: clean(provider?.mongoId)
            ?: extractString(dto.userId)
            ?: ""

        val providerTier = provider?.verificationTier ?: dto.verificationTier ?: 0
        val providerTrust = provider?.trustScore ?: dto.trustScore
        val providerTrustLabel = clean(provider?.trustScoreRange) ?: inferTrustLabel(providerTrust)

        val city = clean(provider?.location?.city) ?: clean(dto.locationData?.city)
        val region = clean(provider?.location?.region)
            ?: clean(provider?.location?.country)
            ?: clean(dto.locationData?.country)
        val providerLocation = listOfNotNull(city, region)
            .distinct()
            .joinToString(", ")
            .ifBlank { "Location private" }

        val providerAvatar = listOfNotNull(
            extractMediaUrl(provider?.avatar),
            extractMediaUrl(dto.avatar),
            extractMediaUrl(dto.profilePicture)
        ).firstOrNull()

        val serviceImage = listOfNotNull(
            dto.images?.firstOrNull { !it.isNullOrBlank() },
            provider?.photos?.firstOrNull { !it.isNullOrBlank() },
            providerAvatar
        ).firstOrNull()

        val categoryId = clean(dto.category) ?: "special-services"
        val categoryLabel = humanize(categoryId)

        val serviceLocation = providerLocation.takeIf { it != "Location private" }
            ?: clean(dto.location)
            ?: "Location private"

        return ServiceListing(
            id = serviceId,
            title = clean(dto.title) ?: "Untitled service",
            description = clean(dto.description) ?: "Secure listing from verified marketplace provider.",
            categoryId = categoryId,
            categoryLabel = categoryLabel,
            price = dto.price ?: 0.0,
            durationMinutes = dto.durationMinutes ?: dto.duration,
            locationLabel = serviceLocation,
            imageUrl = serviceImage,
            likesCount = dto.likesCount ?: 0,
            isActive = dto.isActive ?: true,
            provider = ServiceProvider(
                id = providerId,
                username = clean(provider?.username) ?: clean(dto.username) ?: "Verified provider",
                verificationTier = providerTier,
                trustScore = providerTrust,
                trustLabel = providerTrustLabel,
                isVerified = provider?.isVerified ?: (providerTier >= 2),
                isOnline = provider?.isOnline ?: false,
                locationLabel = providerLocation,
                avatarUrl = providerAvatar
            )
        )
    }

    private fun inferTrustLabel(score: Int?): String {
        val value = score ?: return "Trust pending"
        return when {
            value >= 90 -> "Excellent (90-100)"
            value >= 80 -> "Very Good (80-89)"
            value >= 70 -> "Good (70-79)"
            value >= 60 -> "Fair (60-69)"
            value >= 50 -> "Poor (50-59)"
            else -> "Very Poor (0-49)"
        }
    }

    private fun extractString(value: JsonElement?): String? {
        if (value == null || value.isJsonNull) return null
        return when {
            value.isJsonPrimitive && value.asJsonPrimitive.isString -> clean(value.asString)
            value.isJsonObject -> {
                val obj = value.asJsonObject
                val keys = listOf("", "id", "_id", "value", "oid", "\$oid")
                keys.firstNotNullOfOrNull { key ->
                    val candidate = if (key.isEmpty()) null else obj.get(key)
                    candidate
                        ?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }
                        ?.asString
                        ?.let { clean(it) }
                }
            }
            else -> null
        }
    }

    private fun extractMediaUrl(value: JsonElement?): String? {
        if (value == null || value.isJsonNull) return null
        return when {
            value.isJsonPrimitive && value.asJsonPrimitive.isString -> clean(value.asString)
            value.isJsonObject -> {
                val obj = value.asJsonObject
                val keys = listOf("url", "secure_url", "src", "value")
                keys.firstNotNullOfOrNull { key ->
                    obj.get(key)
                        ?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }
                        ?.asString
                        ?.let { clean(it) }
                }
            }
            else -> null
        }
    }

    private fun humanize(value: String): String {
        return value
            .replace('_', ' ')
            .replace('-', ' ')
            .split(' ')
            .filter { it.isNotBlank() }
            .joinToString(" ") { token ->
                token.replaceFirstChar { ch ->
                    if (ch.isLowerCase()) ch.titlecase(Locale.getDefault()) else ch.toString()
                }
            }
    }

    private fun clean(value: String?): String? {
        val trimmed = value?.trim().orEmpty()
        return trimmed.takeIf { it.isNotBlank() }
    }
}
