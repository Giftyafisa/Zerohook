package com.zerohook.app.data.remote.dto

import com.google.gson.annotations.SerializedName
import com.google.gson.JsonElement

// ─── Auth DTOs ────────────────────────────────────────────────────────

data class LoginRequest(
    val email: String? = null,
    val username: String? = null,
    val password: String
)

data class RegisterRequest(
    val username: String,
    val email: String,
    val password: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val phone: String? = null,
    @SerializedName("accountType") val accountType: String = "client",
    val gender: String? = null,
    val dateOfBirth: String? = null
)

data class RefreshRequest(
    val refreshToken: String
)

data class ValidateTokenRequest(
    val token: String
)

data class AuthResponse(
    val success: Boolean = false,
    val token: String?,
    @SerializedName("refreshToken") val refreshToken: String? = null,
    val user: UserDto?,
    val message: String?,
    val valid: Boolean? = null  // Used by validate-token endpoint
)

data class UserDto(
    val id: String,
    val username: String,
    val email: String? = null,
    @SerializedName("account_type") val accountType: String?,
    @SerializedName("verificationTier") val verificationTier: Int? = null,
    @SerializedName("profile_data") val profileData: ProfileDataDto?,
    @SerializedName("is_online") val isOnline: Boolean = false,
    @SerializedName("is_subscribed") val isSubscribed: Boolean = false,
    @SerializedName("subscription_tier") val subscriptionTier: String? = null,
    @SerializedName("is_admin") val isAdmin: Boolean = false,
    val avatar: String? = null,
    val status: String? = null
)

data class ProfileDataDto(
    val firstName: String? = null,
    val lastName: String? = null,
    val accountType: String? = null,
    val age: Int? = null,
    val gender: String? = null,
    val dateOfBirth: String? = null,
    val bio: String? = null,
    val avatar: String? = null,
    val profilePicture: String? = null,
    val photos: List<String>? = null,
    val location: LocationDto? = null,
    val country: String? = null,
    val countryCode: String? = null,
    val currency: String? = null,
    val basePrice: Double? = null,
    val specializations: List<String>? = null,
    val languages: List<String>? = null
)

data class LocationDto(
    val city: String? = null,
    val country: String? = null,
    val coordinates: CoordinatesDto? = null
)

data class CoordinatesDto(
    val lat: Double? = null,
    val lng: Double? = null
)

// ─── Chat DTOs ────────────────────────────────────────────────────────

data class ConversationsResponse(
    val success: Boolean = false,
    val conversations: List<ConversationDto>?
)

/**
 * Matches the server GET /api/chat/conversations response shape.
 * Server returns nested `otherUser` object, NOT flat participantId/Name/Avatar.
 */
data class ConversationDto(
    val id: String,
    val otherUser: OtherUserDto? = null,
    val lastMessage: String?,
    val lastMessageType: String? = "text",
    val lastMessageTime: String?,
    val unreadCount: Int = 0,
    val createdAt: String? = null,
    val status: String? = "active"
)

/** Nested user object inside conversation response */
data class OtherUserDto(
    val id: String? = null,
    val username: String? = null,
    val verificationTier: String? = null,
    val profilePicture: String? = null
)

data class MessagesResponse(
    val success: Boolean = false,
    val messages: List<MessageDto>?,
    val pagination: PaginationDto? = null
)

data class PaginationDto(
    val hasMore: Boolean = false,
    val limit: Int = 50,
    val oldestId: String? = null,
    val newestId: String? = null
)

data class MessageDto(
    val id: String,
    val conversationId: String? = null,
    val senderId: String?,
    val senderName: String?,
    val senderTier: String? = null,
    val content: String?,
    val messageType: String?,
    val metadata: Map<String, Any>? = null,
    val createdAt: String?,
    val readAt: String?,
    val status: String? = null,
    val isOwn: Boolean = false
)

data class SendMessageRequest(
    val conversationId: String,
    val content: String,
    val messageType: String = "text"
)

data class SendMessageResponse(
    val success: Boolean = false,
    val message: MessageDto?,
    val error: String?
)

data class ChatAttachmentUploadResponse(
    val success: Boolean = false,
    val url: String? = null,
    val fileType: String? = "file",
    val filename: String? = null,
    val size: Long? = null,
    val mimeType: String? = null,
    val error: String? = null,
    val message: String? = null
)

data class PresenceSnapshotResponse(
    val success: Boolean = false,
    val users: List<PresenceUserDto> = emptyList(),
    val context: String? = null,
    val timestamp: String? = null,
    val message: String? = null,
    val error: String? = null
)

data class SocketTraceRequest(
    val trace: List<String>,
    val origin: String = "mobile",
    val deviceInfo: Map<String, String> = emptyMap()
)

data class PresenceUserDto(
    val userId: String,
    val isOnline: Boolean = false,
    val status: String? = null,
    val restricted: Boolean = false,
    val lastSeen: String? = null,
    val lastSeenLabel: String? = null
)

/**
 * FIX: Server /api/chat/start expects 'otherUserId', NOT 'participantId'.
 * Also accepts 'recipientId' and 'userId' as aliases.
 */
data class StartConversationRequest(
    val otherUserId: String
)

/**
 * FIX: Server /api/chat/start returns { success, conversationId, createdAt, messagingLimit }
 * NOT a full conversation object.
 */
data class StartConversationResponse(
    val success: Boolean = false,
    val conversationId: String? = null,
    val createdAt: String? = null,
    val messagingLimit: MessagingLimitDto? = null,
    val requiredAccessType: String? = null,
    val initiatorAccountType: String? = null,
    val targetAccountType: String? = null,
    val error: String? = null,
    val message: String? = null
)

data class CallActionRequest(
    val callId: String
)

data class MessagingLimitDto(
    val uniqueContacts: Int = 0,
    val maxContacts: Int = 3,
    val remainingContacts: Int = 3
)

// ─── Browse / Discovery DTOs ──────────────────────────────────────────

data class BrowseProfilesResponse(
    val success: Boolean = false,
    val users: List<BrowseProfileDto> = emptyList(),
    val data: BrowseProfilesDataDto? = null,
    val pagination: BrowsePaginationDto? = null,
    val discoverySurface: String? = null,
    val message: String? = null,
    val error: String? = null
)

data class BrowseProfilesDataDto(
    val users: List<BrowseProfileDto> = emptyList(),
    val pagination: BrowsePaginationDto? = null,
    val discoverySurface: String? = null
)

data class BrowsePaginationDto(
    val page: Int = 1,
    val limit: Int = 20,
    val total: Int = 0,
    val totalPages: Int = 0,
    val hasMore: Boolean = false
)

data class BrowseProfileDto(
    val id: String? = null,
    @SerializedName("_id") val mongoId: String? = null,
    val username: String? = null,
    @SerializedName("account_type") val accountType: String? = null,
    @SerializedName("accountType") val accountTypeAlt: String? = null,
    @SerializedName("profile_data") val profileData: BrowseProfileDataDto? = null,
    @SerializedName("profileData") val profileDataAlt: BrowseProfileDataDto? = null,
    @SerializedName("verificationTier") val verificationTier: Int? = null,
    @SerializedName("verification_tier") val verificationTierAlt: Int? = null,
    @SerializedName("reputationScore") val reputationScore: Int? = null,
    @SerializedName("reputation_score") val reputationScoreAlt: Int? = null,
    val trustScore: Int? = null,
    val isOnline: Boolean? = null,
    @SerializedName("is_online") val isOnlineAlt: Boolean? = null,
    val distance: Double? = null,
    val recommendationScore: Double? = null,
    val lastSeenLabel: String? = null,
    val successRate: Double? = null,
    @SerializedName("profile_image") val profileImage: JsonElement? = null,
    @SerializedName("profile_image_url") val profileImageUrl: String? = null
)

data class BrowseProfileDataDto(
    val firstName: String? = null,
    val lastName: String? = null,
    @SerializedName("account_type") val accountType: String? = null,
    @SerializedName("accountType") val accountTypeAlt: String? = null,
    val bio: String? = null,
    val location: BrowseLocationDto? = null,
    val city: String? = null,
    val country: String? = null,
    val basePrice: Double? = null,
    @SerializedName("profilePicture") val profilePicture: JsonElement? = null,
    @SerializedName("profile_picture") val profilePictureAlt: JsonElement? = null,
    val avatar: String? = null,
    val photos: List<String>? = null
)

data class BrowseLocationDto(
    val city: String? = null,
    val country: String? = null
)

data class BrowseEngagementRequest(
    val profileId: String,
    val actionType: String,
    val surface: String = "mobile_browse",
    val metadata: Map<String, String> = emptyMap()
)

// ─── Adult Services DTOs ──────────────────────────────────────────────

data class ServiceCategoriesResponse(
    val success: Boolean? = null,
    val categories: List<ServiceCategoryDto> = emptyList(),
    val message: String? = null,
    val error: String? = null
)

data class ServiceCategoryDto(
    val id: String? = null,
    val name: String? = null,
    val displayName: String? = null,
    val description: String? = null,
    val icon: String? = null,
    val startingPrice: Double? = null,
    val maxPrice: Double? = null,
    val duration: String? = null
)

data class AdultServicesResponse(
    val success: Boolean = false,
    val services: List<AdultServiceDto> = emptyList(),
    val pagination: ServicePaginationDto? = null,
    val message: String? = null,
    val error: String? = null
)

data class ServiceSearchResponse(
    val success: Boolean = false,
    val searchResults: List<AdultServiceDto> = emptyList(),
    val searchTerm: String? = null,
    val totalResults: Int? = null,
    val message: String? = null,
    val error: String? = null
)

data class ServicePaginationDto(
    val page: Int = 1,
    val limit: Int = 20,
    val hasMore: Boolean = false,
    val total: Int? = null,
    val pages: Int? = null,
    val totalPages: Int? = null,
    val totalCount: Int? = null
)

data class AdultServiceDto(
    val id: String? = null,
    @SerializedName("_id") val mongoId: String? = null,
    val title: String? = null,
    val description: String? = null,
    val category: String? = null,
    val price: Double? = null,
    @SerializedName("duration_minutes") val durationMinutes: Int? = null,
    val duration: Int? = null,
    @SerializedName("location_data") val locationData: ServiceLocationDto? = null,
    val location: String? = null,
    val images: List<String>? = null,
    @SerializedName("likes_count") val likesCount: Int? = null,
    @SerializedName("is_active") val isActive: Boolean? = null,
    @SerializedName("user_id") val userId: JsonElement? = null,
    val username: String? = null,
    @SerializedName("verification_tier") val verificationTier: Int? = null,
    @SerializedName("trust_score") val trustScore: Int? = null,
    @SerializedName("service_verified") val serviceVerified: Boolean? = null,
    val provider: ServiceProviderDto? = null,
    val avatar: JsonElement? = null,
    @SerializedName("profile_picture") val profilePicture: JsonElement? = null
)

data class ServiceLocationDto(
    val city: String? = null,
    val country: String? = null,
    val region: String? = null
)

data class ServiceProviderDto(
    val id: String? = null,
    @SerializedName("_id") val mongoId: String? = null,
    val username: String? = null,
    @SerializedName("verification_tier") val verificationTier: Int? = null,
    @SerializedName("trust_score") val trustScore: Int? = null,
    @SerializedName("trust_score_range") val trustScoreRange: String? = null,
    @SerializedName("is_verified") val isVerified: Boolean? = null,
    @SerializedName("is_online") val isOnline: Boolean? = null,
    val location: ServiceLocationDto? = null,
    val bio: String? = null,
    val avatar: JsonElement? = null,
    val photos: List<String>? = null
)

// ─── Wallet / Payments DTOs ───────────────────────────────────────────

data class WalletResponse(
    val success: Boolean = false,
    val wallet: WalletDto? = null,
    val balance: Double? = null,
    val escrowHeld: Double? = null,
    val pendingWithdrawal: Double? = null,
    val totalEarnings: Double? = null,
    val currency: String? = null,
    val currencySymbol: String? = null,
    val message: String? = null,
    val error: String? = null
)

data class WalletDto(
    val balance: Double? = null,
    val escrowHeld: Double? = null,
    val pendingWithdrawal: Double? = null,
    val totalEarnings: Double? = null,
    val currency: String? = null,
    val currencySymbol: String? = null
)

data class BalanceResponse(
    val success: Boolean = false,
    val balance: BalanceDto? = null,
    val stats: BalanceStatsDto? = null,
    val message: String? = null,
    val error: String? = null
)

data class BalanceDto(
    val available: Double? = null,
    val pending: Double? = null,
    val total: Double? = null,
    val currency: String? = null
)

data class BalanceStatsDto(
    val totalSpent: Double? = null,
    val completedTransactions: Int? = null,
    val pendingTransactions: Int? = null
)

data class PaymentTransactionsResponse(
    val success: Boolean = false,
    val transactions: List<PaymentTransactionDto> = emptyList(),
    val pagination: ServicePaginationDto? = null,
    val message: String? = null,
    val error: String? = null
)

data class PaymentTransactionDto(
    val id: String? = null,
    val type: String? = null,
    val title: String? = null,
    val amount: Double? = null,
    val currency: String? = null,
    val status: String? = null,
    val date: String? = null,
    val rawDate: String? = null,
    val reference: String? = null,
    val paymentMethod: String? = null,
    val cryptoSymbol: String? = null,
    val cryptoAmount: Double? = null
)

data class TransactionsFeedResponse(
    val success: Boolean = false,
    val transactions: List<TransactionFeedItemDto> = emptyList(),
    val summary: TransactionSummaryDto? = null,
    val pagination: ServicePaginationDto? = null,
    val message: String? = null,
    val error: String? = null
)

data class TransactionFeedItemDto(
    val id: String? = null,
    @SerializedName("service_title") val serviceTitle: String? = null,
    @SerializedName("user_role") val userRole: String? = null,
    val amount: Double? = null,
    val status: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class TransactionSummaryDto(
    val totalTransactions: Int? = null,
    val completedTransactions: Int? = null,
    val pendingTransactions: Int? = null,
    val cancelledTransactions: Int? = null,
    val totalEarnings: Double? = null,
    val totalSpent: Double? = null
)

data class DepositRequest(
    val amount: Double,
    val cryptoSymbol: String = "USDT",
    val currency: String? = null
)

data class DepositResponse(
    val success: Boolean = false,
    val reference: String? = null,
    val address: String? = null,
    val walletAddress: String? = null,
    val cryptoAmount: Double? = null,
    val cryptoSymbol: String? = null,
    val fiatAmount: Double? = null,
    val network: String? = null,
    val qrData: String? = null,
    val expiresAt: String? = null,
    val currency: String? = null,
    val currencySymbol: String? = null,
    val rate: Double? = null,
    val message: String? = null,
    val error: String? = null
)

data class WithdrawRequest(
    val amount: Double,
    val cryptoSymbol: String = "USDT",
    val walletAddress: String,
    val network: String? = null
)

data class WithdrawResponse(
    val success: Boolean = false,
    val message: String? = null,
    val reference: String? = null,
    val cryptoAmount: Double? = null,
    val cryptoSymbol: String? = null,
    val walletAddress: String? = null,
    val status: String? = null,
    val currency: String? = null,
    val currencySymbol: String? = null,
    val note: String? = null,
    val error: String? = null,
    val availableBalance: Double? = null,
    val requestedAmount: Double? = null
)

// ─── Notification DTOs ─────────────────────────────────────────────────

data class NotificationsResponse(
    val success: Boolean,
    val notifications: List<NotificationDto>?
)

data class NotificationDto(
    val id: String,
    val type: String?,
    val title: String?,
    val message: String?,
    val data: Map<String, Any>? = null,
    val read: Boolean = false,
    val createdAt: String?
)

data class RegisterDeviceTokenRequest(
    val token: String,
    val platform: String = "android",
    val provider: String = "fcm",
    val deviceId: String? = null,
    val appVersion: String? = null
)

// ─── Generic API Response ──────────────────────────────────────────────

data class ApiResponse(
    val success: Boolean,
    val message: String? = null,
    val data: Any? = null
)
