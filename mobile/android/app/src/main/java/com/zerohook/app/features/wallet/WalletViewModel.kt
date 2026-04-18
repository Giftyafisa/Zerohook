package com.zerohook.app.features.wallet

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zerohook.app.data.repository.WalletRepository
import com.zerohook.app.data.repository.WalletSummary
import com.zerohook.app.data.repository.WalletTransaction
import dagger.hilt.android.lifecycle.HiltViewModel
import java.text.DecimalFormat
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

enum class WalletTransactionFilter(val label: String) {
    ALL("All"),
    INCOME("Income"),
    EXPENSE("Expense"),
    PENDING("Pending")
}

data class WalletFeedback(
    val title: String,
    val message: String,
    val reference: String? = null,
    val walletAddress: String? = null,
    val cryptoAmount: Double? = null,
    val cryptoSymbol: String? = null,
    val isError: Boolean = false
)

data class WalletUiState(
    val summary: WalletSummary = WalletSummary(),
    val transactions: List<WalletTransaction> = emptyList(),
    val selectedFilter: WalletTransactionFilter = WalletTransactionFilter.ALL,
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val isActionInProgress: Boolean = false,
    val error: String? = null,
    val feedback: WalletFeedback? = null
)

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val walletRepository: WalletRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(WalletUiState())
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    init {
        loadDashboard(refresh = false)
    }

    fun refresh() {
        loadDashboard(refresh = true)
    }

    fun onFilterSelected(filter: WalletTransactionFilter) {
        _uiState.update { it.copy(selectedFilter = filter) }
    }

    fun requestDeposit(amount: Double, cryptoSymbol: String) {
        if (amount <= 0.0) {
            _uiState.update {
                it.copy(
                    feedback = WalletFeedback(
                        title = "Invalid amount",
                        message = "Enter an amount greater than zero.",
                        isError = true
                    )
                )
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isActionInProgress = true, error = null) }
            val currency = _uiState.value.summary.currency

            walletRepository.requestDeposit(
                amount = amount,
                cryptoSymbol = cryptoSymbol,
                currency = currency
            ).onSuccess { quote ->
                _uiState.update { current ->
                    current.copy(
                        isActionInProgress = false,
                        feedback = WalletFeedback(
                            title = "Deposit Request Created",
                            message = "Send ${formatCrypto(quote.cryptoAmount)} ${quote.cryptoSymbol} to the wallet address.",
                            reference = quote.reference,
                            walletAddress = quote.walletAddress,
                            cryptoAmount = quote.cryptoAmount,
                            cryptoSymbol = quote.cryptoSymbol
                        )
                    )
                }
                loadDashboard(refresh = true)
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isActionInProgress = false,
                        error = error.message ?: "Deposit request failed",
                        feedback = WalletFeedback(
                            title = "Deposit Failed",
                            message = error.message ?: "Unable to create deposit request.",
                            isError = true
                        )
                    )
                }
            }
        }
    }

    fun requestWithdrawal(amount: Double, cryptoSymbol: String, walletAddress: String) {
        if (amount <= 0.0 || walletAddress.isBlank()) {
            _uiState.update {
                it.copy(
                    feedback = WalletFeedback(
                        title = "Invalid withdrawal",
                        message = "Provide a valid amount and destination wallet address.",
                        isError = true
                    )
                )
            }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isActionInProgress = true, error = null) }

            walletRepository.requestWithdrawal(
                amount = amount,
                cryptoSymbol = cryptoSymbol,
                walletAddress = walletAddress.trim()
            ).onSuccess { receipt ->
                _uiState.update { current ->
                    current.copy(
                        isActionInProgress = false,
                        feedback = WalletFeedback(
                            title = "Withdrawal Submitted",
                            message = receipt.message,
                            reference = receipt.reference,
                            walletAddress = receipt.walletAddress,
                            cryptoAmount = receipt.cryptoAmount,
                            cryptoSymbol = receipt.cryptoSymbol
                        )
                    )
                }
                loadDashboard(refresh = true)
            }.onFailure { error ->
                _uiState.update {
                    it.copy(
                        isActionInProgress = false,
                        error = error.message ?: "Withdrawal request failed",
                        feedback = WalletFeedback(
                            title = "Withdrawal Failed",
                            message = error.message ?: "Unable to request withdrawal.",
                            isError = true
                        )
                    )
                }
            }
        }
    }

    fun dismissFeedback() {
        _uiState.update { it.copy(feedback = null) }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun loadDashboard(refresh: Boolean) {
        viewModelScope.launch {
            _uiState.update { current ->
                current.copy(
                    isLoading = if (refresh) false else current.transactions.isEmpty(),
                    isRefreshing = refresh,
                    error = null
                )
            }

            walletRepository.fetchWalletDashboard()
                .onSuccess { dashboard ->
                    _uiState.update { current ->
                        current.copy(
                            summary = dashboard.summary,
                            transactions = dashboard.transactions,
                            isLoading = false,
                            isRefreshing = false,
                            error = null
                        )
                    }
                }
                .onFailure { error ->
                    val fallback = walletRepository.fallbackDashboard()
                    _uiState.update { current ->
                        current.copy(
                            summary = if (current.transactions.isEmpty()) fallback.summary else current.summary,
                            transactions = if (current.transactions.isEmpty()) fallback.transactions else current.transactions,
                            isLoading = false,
                            isRefreshing = false,
                            error = error.message ?: "Unable to load wallet data"
                        )
                    }
                }
        }
    }

    private fun formatCrypto(value: Double): String {
        val formatter = if (value >= 1) {
            DecimalFormat("#,##0.####")
        } else {
            DecimalFormat("0.########")
        }
        return formatter.format(value)
    }
}
