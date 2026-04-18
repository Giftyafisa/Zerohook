package com.zerohook.app.features.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zerohook.app.data.local.TokenManager
import com.zerohook.app.data.repository.AuthRepository
import com.zerohook.app.services.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager,
    private val socketManager: SocketManager
) : ViewModel() {

    data class AuthState(
        val isLoading: Boolean = false,
        val isAuthenticated: Boolean = false,
        val userId: String? = null,
        val error: String? = null
    )

    private val _state = MutableStateFlow(AuthState())
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        // Check for existing session on startup
        viewModelScope.launch {
            val token = tokenManager.getToken()
            if (token != null) {
                _state.update { it.copy(isLoading = true) }
                val valid = authRepository.validateToken()
                if (valid) {
                    val userId = tokenManager.getUserId()
                    _state.update { it.copy(isAuthenticated = true, userId = userId, isLoading = false) }
                    authRepository.syncDeviceTokenIfAvailable()
                    socketManager.connect()
                } else {
                    tokenManager.clearSession()
                    _state.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            authRepository.login(email, password)
                .onSuccess { userId ->
                    _state.update { it.copy(isAuthenticated = true, userId = userId, isLoading = false) }
                    authRepository.syncDeviceTokenIfAvailable()
                    socketManager.connect()
                }
                .onFailure { e ->
                    _state.update { it.copy(error = e.message, isLoading = false) }
                }
        }
    }

    fun register(username: String, email: String, password: String, accountType: String = "client") {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            authRepository.register(username, email, password, accountType)
                .onSuccess { userId ->
                    _state.update { it.copy(isAuthenticated = true, userId = userId, isLoading = false) }
                    authRepository.syncDeviceTokenIfAvailable()
                    socketManager.connect()
                }
                .onFailure { e ->
                    _state.update { it.copy(error = e.message, isLoading = false) }
                }
        }
    }

    fun logout() {
        viewModelScope.launch {
            socketManager.disconnect()
            authRepository.logout()
            _state.update { AuthState() }
        }
    }

    fun clearError() {
        _state.update { it.copy(error = null) }
    }
}
