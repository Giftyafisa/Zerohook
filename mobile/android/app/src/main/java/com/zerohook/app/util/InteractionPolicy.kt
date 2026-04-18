package com.zerohook.app.util

/**
 * Client-side mirror of backend interaction policy for fast preflight validation.
 * Backend remains the source of truth.
 */
object InteractionPolicy {

    const val ACCOUNT_TYPE_CLIENT = "client"
    const val ACCOUNT_TYPE_PROVIDER = "provider"
    const val ACCOUNT_TYPE_SUGAR_DADDY = "sugar_daddy"
    const val ACCOUNT_TYPE_SUGAR_MOMMY = "sugar_mommy"

    private val sugarTypes = setOf(ACCOUNT_TYPE_SUGAR_DADDY, ACCOUNT_TYPE_SUGAR_MOMMY)
    private val sugarEligibleViewers = setOf(ACCOUNT_TYPE_PROVIDER)

    private val chatTargetMatrix: Map<String, Set<String>> = mapOf(
        ACCOUNT_TYPE_CLIENT to setOf(
            ACCOUNT_TYPE_PROVIDER,
            ACCOUNT_TYPE_SUGAR_DADDY,
            ACCOUNT_TYPE_SUGAR_MOMMY
        ),
        ACCOUNT_TYPE_PROVIDER to setOf(
            ACCOUNT_TYPE_CLIENT,
            ACCOUNT_TYPE_PROVIDER,
            ACCOUNT_TYPE_SUGAR_DADDY,
            ACCOUNT_TYPE_SUGAR_MOMMY
        ),
        ACCOUNT_TYPE_SUGAR_DADDY to setOf(ACCOUNT_TYPE_PROVIDER, ACCOUNT_TYPE_CLIENT),
        ACCOUNT_TYPE_SUGAR_MOMMY to setOf(ACCOUNT_TYPE_PROVIDER, ACCOUNT_TYPE_CLIENT)
    )

    enum class ConversationIssue {
        NONE,
        ROLE_PAIR_NOT_ALLOWED,
        SUGAR_PROVIDER_ONLY
    }

    data class ConversationPolicyResult(
        val allowed: Boolean,
        val issue: ConversationIssue = ConversationIssue.NONE,
        val message: String? = null,
        val requiresSugarAccessCheck: Boolean = false
    )

    fun normalizeAccountType(value: String?): String? {
        val normalized = value?.trim()?.lowercase().orEmpty()
        return normalized.takeIf { it.isNotBlank() }
    }

    fun isSugarType(accountType: String?): Boolean {
        return normalizeAccountType(accountType) in sugarTypes
    }

    fun evaluateConversationStart(
        initiatorAccountType: String?,
        targetAccountType: String?
    ): ConversationPolicyResult {
        val initiatorType = normalizeAccountType(initiatorAccountType)
        val otherType = normalizeAccountType(targetAccountType)

        // Unknown types should be delegated to backend enforcement.
        if (initiatorType == null || otherType == null) {
            return ConversationPolicyResult(allowed = true)
        }

        val allowedTargets = chatTargetMatrix[initiatorType]
        if (allowedTargets == null || otherType !in allowedTargets) {
            return ConversationPolicyResult(
                allowed = false,
                issue = ConversationIssue.ROLE_PAIR_NOT_ALLOWED,
                message = "Conversation not allowed for this account type pair"
            )
        }

        val initiatorIsSugar = initiatorType in sugarTypes
        val targetIsSugar = otherType in sugarTypes

        if (initiatorIsSugar != targetIsSugar) {
            val viewerType = if (initiatorIsSugar) otherType else initiatorType
            if (viewerType !in sugarEligibleViewers) {
                return ConversationPolicyResult(
                    allowed = false,
                    issue = ConversationIssue.SUGAR_PROVIDER_ONLY,
                    message = "Only provider accounts can interact with sugar profiles"
                )
            }

            // Provider-to-sugar interaction may still require paid access.
            return ConversationPolicyResult(
                allowed = true,
                requiresSugarAccessCheck = true
            )
        }

        return ConversationPolicyResult(allowed = true)
    }
}
