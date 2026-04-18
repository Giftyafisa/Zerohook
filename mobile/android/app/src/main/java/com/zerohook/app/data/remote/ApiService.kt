package com.zerohook.app.data.remote

import com.zerohook.app.data.remote.dto.*
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit API interface — all endpoints matching the Express backend.
 */
interface ApiService {

    // ─── Auth ──────────────────────────────────────────────────────────

    @POST("auth/login")
    suspend fun login(@Body body: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): Response<AuthResponse>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body body: RefreshRequest): Response<AuthResponse>

    @POST("auth/validate-token")
    suspend fun validateToken(@Body body: ValidateTokenRequest): Response<AuthResponse>

    // ─── Chat ──────────────────────────────────────────────────────────

    @GET("chat/conversations")
    suspend fun getConversations(): Response<ConversationsResponse>

    @GET("chat/messages/{conversationId}")
    suspend fun getMessages(
        @Path("conversationId") conversationId: String,
        @Query("limit") limit: Int = 50,
        @Query("before") before: String? = null
    ): Response<MessagesResponse>

    @POST("chat/send")
    suspend fun sendMessage(@Body body: SendMessageRequest): Response<SendMessageResponse>

    @POST("chat/start")
    suspend fun startConversation(@Body body: StartConversationRequest): Response<StartConversationResponse>

    /**
     * Mark conversation as read — REST only.
     * FIX: Server uses POST, not PUT.
     * FIX FROM WEB AUDIT: Do NOT also emit socket 'mark_read'; the backend
     * REST handler already broadcasts the read receipt via req.io.
     */
    @POST("chat/read/{conversationId}")
    suspend fun markConversationRead(
        @Path("conversationId") conversationId: String
    ): Response<ApiResponse>

    @Multipart
    @POST("uploads/chat-attachment")
    suspend fun uploadChatAttachment(
        @Part file: MultipartBody.Part
    ): Response<ChatAttachmentUploadResponse>

    // ─── Calls ─────────────────────────────────────────────────────────

    @POST("calls/accept")
    suspend fun acceptCall(@Body body: CallActionRequest): Response<ApiResponse>

    @POST("calls/reject")
    suspend fun rejectCall(@Body body: CallActionRequest): Response<ApiResponse>

    // ─── Notifications ─────────────────────────────────────────────────

    @GET("notifications")
    suspend fun getNotifications(): Response<NotificationsResponse>

    @PUT("notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: String): Response<ApiResponse>

    @POST("notifications/register-device")
    suspend fun registerDeviceToken(@Body body: RegisterDeviceTokenRequest): Response<ApiResponse>

    // ─── User Status ───────────────────────────────────────────────────

    @GET("users/status/{userId}")
    suspend fun getUserStatus(@Path("userId") userId: String): Response<ApiResponse>

    @GET("users/profiles")
    suspend fun getProfiles(
        @Query("limit") limit: Int = 20,
        @Query("page") page: Int = 1,
        @Query("sort") sort: String = "recommendation",
        @Query("surface") surface: String = "auto",
        @Query("search") search: String? = null
    ): Response<BrowseProfilesResponse>

    @POST("users/engagement")
    suspend fun trackProfileEngagement(@Body body: BrowseEngagementRequest): Response<ApiResponse>

    // ─── Services Marketplace ──────────────────────────────────────────

    @GET("adult-services/categories")
    suspend fun getServiceCategories(): Response<ServiceCategoriesResponse>

    @GET("adult-services")
    suspend fun getAdultServices(
        @Query("category") category: String? = null,
        @Query("location") location: String? = null,
        @Query("minPrice") minPrice: Double? = null,
        @Query("maxPrice") maxPrice: Double? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20
    ): Response<AdultServicesResponse>

    @GET("adult-services/search/{term}")
    suspend fun searchAdultServices(
        @Path("term") term: String,
        @Query("category") category: String? = null,
        @Query("minPrice") minPrice: Double? = null,
        @Query("maxPrice") maxPrice: Double? = null
    ): Response<ServiceSearchResponse>

    // ─── Wallet / Payments ─────────────────────────────────────────────

    @GET("payments/wallet")
    suspend fun getWallet(): Response<WalletResponse>

    @GET("payments/balance")
    suspend fun getBalance(): Response<BalanceResponse>

    @GET("payments/transactions")
    suspend fun getPaymentTransactions(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("type") type: String? = null,
        @Query("status") status: String? = null
    ): Response<PaymentTransactionsResponse>

    @GET("transactions")
    suspend fun getTransactionsFeed(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("status") status: String? = null
    ): Response<TransactionsFeedResponse>

    @POST("payments/deposit")
    suspend fun createDeposit(@Body body: DepositRequest): Response<DepositResponse>

    @POST("payments/withdraw")
    suspend fun createWithdrawal(@Body body: WithdrawRequest): Response<WithdrawResponse>

    @GET("users/presence")
    suspend fun getUsersPresence(
        @Query("userIds") userIds: String,
        @Query("context") context: String = "chat"
    ): Response<PresenceSnapshotResponse>

    // Debug telemetry endpoint for socket trace collection
    @POST("debug/socket-trace")
    suspend fun sendSocketTrace(@Body body: SocketTraceRequest): Response<ApiResponse>
}
