package com.zerohook.app.util

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InteractionPolicyTest {

    @Test
    fun clientToProvider_isAllowed() {
        val result = InteractionPolicy.evaluateConversationStart(
            initiatorAccountType = InteractionPolicy.ACCOUNT_TYPE_CLIENT,
            targetAccountType = InteractionPolicy.ACCOUNT_TYPE_PROVIDER
        )

        assertTrue(result.allowed)
        assertEquals(InteractionPolicy.ConversationIssue.NONE, result.issue)
        assertFalse(result.requiresSugarAccessCheck)
    }

    @Test
    fun clientToSugar_isBlockedProviderOnly() {
        val result = InteractionPolicy.evaluateConversationStart(
            initiatorAccountType = InteractionPolicy.ACCOUNT_TYPE_CLIENT,
            targetAccountType = InteractionPolicy.ACCOUNT_TYPE_SUGAR_DADDY
        )

        assertFalse(result.allowed)
        assertEquals(InteractionPolicy.ConversationIssue.SUGAR_PROVIDER_ONLY, result.issue)
    }

    @Test
    fun providerToSugar_isAllowedButRequiresServerSugarAccessCheck() {
        val result = InteractionPolicy.evaluateConversationStart(
            initiatorAccountType = InteractionPolicy.ACCOUNT_TYPE_PROVIDER,
            targetAccountType = InteractionPolicy.ACCOUNT_TYPE_SUGAR_MOMMY
        )

        assertTrue(result.allowed)
        assertTrue(result.requiresSugarAccessCheck)
    }

    @Test
    fun clientToClient_isBlockedByMatrix() {
        val result = InteractionPolicy.evaluateConversationStart(
            initiatorAccountType = InteractionPolicy.ACCOUNT_TYPE_CLIENT,
            targetAccountType = InteractionPolicy.ACCOUNT_TYPE_CLIENT
        )

        assertFalse(result.allowed)
        assertEquals(InteractionPolicy.ConversationIssue.ROLE_PAIR_NOT_ALLOWED, result.issue)
    }

    @Test
    fun unknownTypes_deferToBackend() {
        val result = InteractionPolicy.evaluateConversationStart(
            initiatorAccountType = null,
            targetAccountType = "provider"
        )

        assertTrue(result.allowed)
        assertEquals(InteractionPolicy.ConversationIssue.NONE, result.issue)
    }
}
