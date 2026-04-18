package com.zerohook.app.features.services

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zerohook.app.data.repository.ServiceCategory
import com.zerohook.app.data.repository.ServiceListing
import com.zerohook.app.data.repository.ServicesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val ALL_CATEGORY_ID = "all"

data class ServicesUiState(
    val categories: List<ServiceCategory> = emptyList(),
    val selectedCategoryId: String = ALL_CATEGORY_ID,
    val searchQuery: String = "",
    val services: List<ServiceListing> = emptyList(),
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class ServicesViewModel @Inject constructor(
    private val servicesRepository: ServicesRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(ServicesUiState())
    val uiState: StateFlow<ServicesUiState> = _uiState.asStateFlow()

    private var searchJob: Job? = null

    init {
        loadContent(refresh = false)
    }

    fun onCategorySelected(categoryId: String) {
        val normalized = categoryId.ifBlank { ALL_CATEGORY_ID }
        if (_uiState.value.selectedCategoryId == normalized) return

        _uiState.update { current ->
            current.copy(
                selectedCategoryId = normalized,
                isLoading = current.services.isEmpty(),
                isRefreshing = false,
                error = null
            )
        }

        loadContent(refresh = false)
    }

    fun onSearchQueryChange(value: String) {
        _uiState.update { it.copy(searchQuery = value.take(80)) }

        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(350)
            loadContent(refresh = false)
        }
    }

    fun refresh() {
        loadContent(refresh = true)
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }

    private fun loadContent(refresh: Boolean) {
        viewModelScope.launch {
            _uiState.update { current ->
                current.copy(
                    isLoading = if (refresh) false else current.services.isEmpty(),
                    isRefreshing = refresh,
                    error = null
                )
            }

            var categoryError: String? = null
            val remoteCategories = servicesRepository.fetchCategories()
                .getOrElse { err ->
                    categoryError = err.message
                    servicesRepository.fallbackCategories()
                }

            val categories = withAllCategory(remoteCategories)
            val selectedCategory = _uiState.value.selectedCategoryId
                .takeIf { selected -> selected == ALL_CATEGORY_ID || categories.any { it.id == selected } }
                ?: ALL_CATEGORY_ID

            val categoryFilter = selectedCategory.takeUnless { it == ALL_CATEGORY_ID }
            val query = _uiState.value.searchQuery

            var servicesError: String? = null
            val services = servicesRepository.fetchServices(
                categoryId = categoryFilter,
                searchQuery = query
            ).getOrElse { err ->
                servicesError = err.message
                servicesRepository.fallbackServices(categoryFilter, query)
            }

            _uiState.update { current ->
                current.copy(
                    categories = categories,
                    selectedCategoryId = selectedCategory,
                    services = services,
                    isLoading = false,
                    isRefreshing = false,
                    error = servicesError ?: categoryError
                )
            }
        }
    }

    private fun withAllCategory(categories: List<ServiceCategory>): List<ServiceCategory> {
        val allCategory = ServiceCategory(
            id = ALL_CATEGORY_ID,
            name = "All",
            description = "All verified services",
            icon = "ALL",
            startingPrice = null,
            maxPrice = null
        )

        return listOf(allCategory) + categories.filterNot { it.id == ALL_CATEGORY_ID }
    }
}
