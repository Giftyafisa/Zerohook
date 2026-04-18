package com.zerohook.app.data.repository

import android.util.Log
import com.zerohook.app.data.remote.ApiService
import com.zerohook.app.data.remote.dto.BalanceResponse
import com.zerohook.app.data.remote.dto.DepositRequest
import com.zerohook.app.data.remote.dto.PaymentTransactionDto
import com.zerohook.app.data.remote.dto.WalletResponse
import com.zerohook.app.data.remote.dto.WithdrawRequest
import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

enum class WalletTransactionDirection {
    INCOME,
    EXPENSE
}

data class WalletSummary(
    val availableBalance: Double = 0.0,
    val pendingBalance: Double = 0.0,
    val totalBalance: Double = 0.0,
    val walletBalance: Double = 0.0,
    val escrowHeld: Double = 0.0,
    val pendingWithdrawal: Double = 0.0,
    val totalEarnings: Double = 0.0,
    val totalSpent: Double = 0.0,
    val completedTransactions: Int = 0,
    val pendingTransactions: Int = 0,
    val currency: String = "USD",
    val currencySymbol: String = "$"
)

data class WalletTransaction(
    val id: String,
    val title: String,
    val direction: WalletTransactionDirection,
    val amount: Double,
    val currency: String,
    val status: String,
    val dateLabel: String,
    val rawDate: String?,
    val reference: String?,
    val paymentMethod: String?,
    val cryptoSymbol: String?,
    val cryptoAmount: Double?
)

data class WalletDashboard(
    val summary: WalletSummary,
    val transactions: List<WalletTransaction>
)

data class DepositQuote(
    val reference: String,
    val walletAddress: String,
    val cryptoAmount: Double,
    val cryptoSymbol: String,
    val fiatAmount: Double,
    val currency: String,
    val currencySymbol: String,
    val expiresAt: String?,
    val network: String?
)

data class WithdrawalReceipt(
    val reference: String,
    val message: String,
    val cryptoAmount: Double,
    val cryptoSymbol: String,
    val walletAddress: String,
    val currency: String,
    val currencySymbol: String,
    val status: String,
    val note: String?
)

@Singleton
class WalletRepository @Inject constructor(
    private val api: ApiService
) {

    companion object {
        private const val TAG = "WalletRepository"
    }

    suspend fun fetchWalletDashboard(page: Int = 1, limit: Int = 25): Result<WalletDashboard> {
        return try {
            val walletResponse = runCatching { api.getWallet() }.getOrNull()
            val balanceResponse = runCatching { api.getBalance() }.getOrNull()
            val paymentsResponse = runCatching { api.getPaymentTransactions(page = page, limit = limit) }.getOrNull()

            val walletBody = walletResponse
                ?.takeIf { it.isSuccessful }
                ?.body()
                ?.takeIf { it.success }

            val balanceBody = balanceResponse
                ?.takeIf { it.isSuccessful }
                ?.body()
                ?.takeIf { it.success }

            var summary = mapSummary(walletBody, balanceBody)

            var transactions = paymentsResponse
                ?.takeIf { it.isSuccessful }
                ?.body()
                ?.takeIf { it.success }
                ?.transactions
                ?.mapNotNull { mapPaymentTransaction(it, summary.currency) }
                ?: emptyList()

            if (transactions.isEmpty()) {
                val fallbackResponse = runCatching { api.getTransactionsFeed(page = page, limit = limit) }.getOrNull()
                val fallbackBody = fallbackResponse
                    ?.takeIf { it.isSuccessful }
                    ?.body()
                    ?.takeIf { it.success }

                transactions = fallbackBody
                    ?.transactions
                    ?.mapNotNull { tx ->
                        val direction = if (tx.userRole?.equals("provider", ignoreCase = true) == true) {
                            WalletTransactionDirection.INCOME
                        } else {
                            WalletTransactionDirection.EXPENSE
                        }

                        val amount = tx.amount ?: return@mapNotNull null
                        WalletTransaction(
                            id = tx.id ?: "tx_${System.currentTimeMillis()}",
                            title = tx.serviceTitle ?: "Transaction",
                            direction = direction,
                            amount = kotlin.math.abs(amount),
                            currency = summary.currency,
                            status = tx.status ?: "pending",
                            dateLabel = formatDateLabel(tx.createdAt),
                            rawDate = tx.createdAt,
                            reference = null,
                            paymentMethod = null,
                            cryptoSymbol = null,
                            cryptoAmount = null
                        )
                    }
                    ?: emptyList()

                fallbackBody?.summary?.let { stats ->
                    summary = summary.copy(
                        totalEarnings = stats.totalEarnings ?: summary.totalEarnings,
                        totalSpent = stats.totalSpent ?: summary.totalSpent,
                        completedTransactions = stats.completedTransactions ?: summary.completedTransactions,
                        pendingTransactions = stats.pendingTransactions ?: summary.pendingTransactions
                    )
                }
            }

            if (walletBody == null && balanceBody == null && transactions.isEmpty()) {
                return Result.failure(Exception("Unable to load wallet data"))
            }

            Result.success(
                WalletDashboard(
                    summary = summary,
                    transactions = transactions
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "fetchWalletDashboard failed", e)
            Result.failure(e)
        }
    }

    suspend fun requestDeposit(
        amount: Double,
        cryptoSymbol: String,
        currency: String?
    ): Result<DepositQuote> {
        return try {
            val response = api.createDeposit(
                DepositRequest(
                    amount = amount,
                    cryptoSymbol = cryptoSymbol.uppercase(Locale.getDefault()),
                    currency = currency?.takeIf { it.isNotBlank() }
                )
            )

            if (!response.isSuccessful) {
                return Result.failure(
                    Exception(parseHttpError(response.errorBody()?.string(), "Failed to create deposit"))
                )
            }

            val body = response.body()
                ?: return Result.failure(Exception("Deposit response is empty"))

            if (!body.success) {
                return Result.failure(Exception(body.error ?: body.message ?: "Deposit request failed"))
            }

            val address = body.walletAddress ?: body.address
                ?: return Result.failure(Exception("Wallet address not returned"))

            val symbol = body.cryptoSymbol ?: cryptoSymbol.uppercase(Locale.getDefault())
            val resolvedCurrency = body.currency ?: currency ?: "USD"
            val resolvedCurrencySymbol = body.currencySymbol ?: currencySymbolFor(resolvedCurrency)

            Result.success(
                DepositQuote(
                    reference = body.reference ?: "pending_reference",
                    walletAddress = address,
                    cryptoAmount = body.cryptoAmount ?: 0.0,
                    cryptoSymbol = symbol,
                    fiatAmount = body.fiatAmount ?: amount,
                    currency = resolvedCurrency,
                    currencySymbol = resolvedCurrencySymbol,
                    expiresAt = body.expiresAt,
                    network = body.network
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "requestDeposit failed", e)
            Result.failure(e)
        }
    }

    suspend fun requestWithdrawal(
        amount: Double,
        cryptoSymbol: String,
        walletAddress: String,
        network: String? = null
    ): Result<WithdrawalReceipt> {
        return try {
            val response = api.createWithdrawal(
                WithdrawRequest(
                    amount = amount,
                    cryptoSymbol = cryptoSymbol.uppercase(Locale.getDefault()),
                    walletAddress = walletAddress,
                    network = network
                )
            )

            if (!response.isSuccessful) {
                return Result.failure(
                    Exception(parseHttpError(response.errorBody()?.string(), "Failed to request withdrawal"))
                )
            }

            val body = response.body()
                ?: return Result.failure(Exception("Withdrawal response is empty"))

            if (!body.success) {
                return Result.failure(Exception(body.error ?: body.message ?: "Withdrawal request failed"))
            }

            val symbol = body.cryptoSymbol ?: cryptoSymbol.uppercase(Locale.getDefault())
            val resolvedCurrency = body.currency ?: "USD"
            val resolvedCurrencySymbol = body.currencySymbol ?: currencySymbolFor(resolvedCurrency)

            Result.success(
                WithdrawalReceipt(
                    reference = body.reference ?: "pending_reference",
                    message = body.message ?: "Withdrawal request submitted",
                    cryptoAmount = body.cryptoAmount ?: 0.0,
                    cryptoSymbol = symbol,
                    walletAddress = body.walletAddress ?: walletAddress,
                    currency = resolvedCurrency,
                    currencySymbol = resolvedCurrencySymbol,
                    status = body.status ?: "pending",
                    note = body.note
                )
            )
        } catch (e: Exception) {
            Log.e(TAG, "requestWithdrawal failed", e)
            Result.failure(e)
        }
    }

    fun fallbackDashboard(): WalletDashboard {
        return WalletDashboard(
            summary = WalletSummary(
                availableBalance = 0.0,
                pendingBalance = 0.0,
                totalBalance = 0.0,
                walletBalance = 0.0,
                escrowHeld = 0.0,
                pendingWithdrawal = 0.0,
                totalEarnings = 0.0,
                totalSpent = 0.0,
                completedTransactions = 0,
                pendingTransactions = 0,
                currency = "USD",
                currencySymbol = "$"
            ),
            transactions = emptyList()
        )
    }

    private fun mapSummary(
        wallet: WalletResponse?,
        balance: BalanceResponse?
    ): WalletSummary {
        val currency = balance?.balance?.currency
            ?: wallet?.wallet?.currency
            ?: wallet?.currency
            ?: "USD"

        val currencySymbol = wallet?.wallet?.currencySymbol
            ?: wallet?.currencySymbol
            ?: currencySymbolFor(currency)

        val available = balance?.balance?.available
            ?: wallet?.wallet?.balance
            ?: wallet?.balance
            ?: 0.0

        val pending = balance?.balance?.pending ?: 0.0
        val total = balance?.balance?.total ?: (available + pending)
        val walletBalance = wallet?.wallet?.balance ?: wallet?.balance ?: available

        return WalletSummary(
            availableBalance = available,
            pendingBalance = pending,
            totalBalance = total,
            walletBalance = walletBalance,
            escrowHeld = wallet?.wallet?.escrowHeld ?: wallet?.escrowHeld ?: 0.0,
            pendingWithdrawal = wallet?.wallet?.pendingWithdrawal ?: wallet?.pendingWithdrawal ?: 0.0,
            totalEarnings = wallet?.wallet?.totalEarnings ?: wallet?.totalEarnings ?: 0.0,
            totalSpent = balance?.stats?.totalSpent ?: 0.0,
            completedTransactions = balance?.stats?.completedTransactions ?: 0,
            pendingTransactions = balance?.stats?.pendingTransactions ?: 0,
            currency = currency,
            currencySymbol = currencySymbol
        )
    }

    private fun mapPaymentTransaction(
        tx: PaymentTransactionDto,
        defaultCurrency: String
    ): WalletTransaction? {
        val id = tx.id ?: return null
        val direction = when (tx.type?.lowercase(Locale.getDefault())) {
            "income", "deposit", "credit" -> WalletTransactionDirection.INCOME
            else -> WalletTransactionDirection.EXPENSE
        }

        val amount = tx.amount ?: return null
        val currency = tx.currency ?: defaultCurrency
        val title = tx.title ?: if (direction == WalletTransactionDirection.INCOME) {
            "Incoming payment"
        } else {
            "Outgoing payment"
        }

        return WalletTransaction(
            id = id,
            title = title,
            direction = direction,
            amount = kotlin.math.abs(amount),
            currency = currency,
            status = tx.status ?: "pending",
            dateLabel = tx.date ?: formatDateLabel(tx.rawDate),
            rawDate = tx.rawDate,
            reference = tx.reference,
            paymentMethod = tx.paymentMethod,
            cryptoSymbol = tx.cryptoSymbol,
            cryptoAmount = tx.cryptoAmount
        )
    }

    private fun parseHttpError(rawError: String?, fallback: String): String {
        if (rawError.isNullOrBlank()) return fallback
        return try {
            val obj = org.json.JSONObject(rawError)
            obj.optString("error")
                .ifBlank { obj.optString("message") }
                .ifBlank { fallback }
        } catch (_: Exception) {
            fallback
        }
    }

    private fun formatDateLabel(rawIso: String?): String {
        val instant = runCatching { rawIso?.let { Instant.parse(it) } }.getOrNull()
            ?: return rawIso?.take(10) ?: "Now"

        val now = Instant.now()
        val diff = Duration.between(instant, now)
        return when {
            diff.toMinutes() < 1 -> "Just now"
            diff.toMinutes() < 60 -> "${diff.toMinutes()} min ago"
            diff.toHours() < 24 -> "${diff.toHours()}h ago"
            diff.toDays() < 7 -> "${diff.toDays()}d ago"
            else -> DateTimeFormatter.ofPattern("dd MMM", Locale.getDefault())
                .withZone(ZoneId.systemDefault())
                .format(instant)
        }
    }

    private fun currencySymbolFor(currency: String): String {
        return when (currency.uppercase(Locale.getDefault())) {
            "NGN" -> "₦"
            "GHS" -> "₵"
            "KES" -> "KSh"
            "ZAR" -> "R"
            "UGX" -> "USh"
            "TZS" -> "TSh"
            "RWF" -> "FRw"
            "BWP" -> "P"
            "ZMW" -> "ZK"
            "MWK" -> "MK"
            "EUR" -> "€"
            "GBP" -> "£"
            else -> "$"
        }
    }
}
