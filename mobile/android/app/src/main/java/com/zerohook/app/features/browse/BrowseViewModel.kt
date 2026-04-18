package com.zerohook.app.features.browse

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zerohook.app.data.repository.BrowseProfile
import com.zerohook.app.data.repository.BrowseRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class BrowseTab(val label: String, val backendSort: String) {
    FOR_YOU("For You", "recommendation"),
    ONLINE("Online", "recent"),
    VERIFIED("Verified", "recommendation"),
    TOP_RATED("Top Rated", "rating")
}

data class BrowseUiState(
    val selectedTab: BrowseTab = BrowseTab.FOR_YOU,
    val searchQuery: String = "",
    val profiles: List<BrowseProfile> = emptyList(),
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class BrowseViewModel @Inject constructor(
    private val browseRepository: BrowseRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BrowseUiState())
    val uiState: StateFlow<BrowseUiState> = _uiState.asStateFlow()

    private var sourceProfiles: List<BrowseProfile> = emptyList()
    private val trackedImpressions = mutableSetOf<String>()

    init {
        loadProfiles(refresh = false)
    }

    fun onTabSelected(tab: BrowseTab) {
        if (tab == _uiState.value.selectedTab) return
        _uiState.update {
            it.copy(selectedTab = tab, isLoading = true, isRefreshing = false, error = null)
        }
        loadProfiles(refresh = false)
    }

    fun onSearchQueryChange(value: String) {
        _uiState.update { current ->
            val query = value.take(80)
            current.copy(
                searchQuery = query,
                profiles = applyFilters(
                    profiles = sourceProfiles,
                    tab = current.selectedTab,
                    query = query
                )
            )
        }
    }

    fun refresh() {
        loadProfiles(refresh = true)
    }

    fun onProfileViewed(profileId: String) {
        if (!trackedImpressions.add(profileId)) return
        viewModelScope.launch {
            browseRepository.trackEngagement(
                profileId = profileId,
                actionType = "view",
                metadata = mapOf("source" to "android_feed")
            )
        }
    }

    fun onProfileAction(profileId: String, actionType: String) {
        viewModelScope.launch {
            browseRepository.trackEngagement(
                profileId = profileId,
                actionType = actionType,
                metadata = mapOf("source" to "android_feed")
            )
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun loadProfiles(refresh: Boolean) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isLoading = if (refresh) false else true,
                    isRefreshing = refresh,
                    error = null
                )
            }

            val currentTab = _uiState.value.selectedTab
            browseRepository.fetchProfiles(sort = currentTab.backendSort)
                .onSuccess { remoteProfiles ->
                    sourceProfiles = if (remoteProfiles.isEmpty()) {
                        browseRepository.fallbackProfiles()
                    } else {
                        remoteProfiles
                    }

                    _uiState.update { current ->
                        current.copy(
                            profiles = applyFilters(
                                profiles = sourceProfiles,
                                tab = current.selectedTab,
                                query = current.searchQuery
                            ),
                            isLoading = false,
                            isRefreshing = false,
                            error = null
                        )
                    }
                }
                .onFailure { error ->
                    if (sourceProfiles.isEmpty()) {
                        sourceProfiles = browseRepository.fallbackProfiles()
                    }

                    _uiState.update { current ->
                        current.copy(
                            profiles = applyFilters(
                                profiles = sourceProfiles,
                                tab = current.selectedTab,
                                query = current.searchQuery
                            ),
                            isLoading = false,
                            isRefreshing = false,
                            error = error.message ?: "Unable to refresh feed"
                        )
                    }
                }
        }
    }

    private fun applyFilters(
        profiles: List<BrowseProfile>,
        tab: BrowseTab,
        query: String
    ): List<BrowseProfile> {
        val tabFiltered = when (tab) {
            BrowseTab.FOR_YOU -> profiles
            BrowseTab.ONLINE -> profiles.filter { it.isOnline }
            BrowseTab.VERIFIED -> profiles.filter { it.isVerified }
            BrowseTab.TOP_RATED -> profiles.sortedByDescending { it.trustScore }
        }

        if (query.isBlank()) return tabFiltered

        val normalized = query.trim().lowercase()
        return tabFiltered.filter { profile ->
            profile.displayName.lowercase().contains(normalized) ||
                profile.username.lowercase().contains(normalized) ||
                profile.city.lowercase().contains(normalized) ||
                profile.country.lowercase().contains(normalized) ||
                profile.bio.lowercase().contains(normalized)
        }
    }
}
