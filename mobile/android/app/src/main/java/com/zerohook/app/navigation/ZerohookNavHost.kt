package com.zerohook.app.navigation

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import android.widget.Toast
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.compose.material3.*
import androidx.core.content.ContextCompat
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.contentDescription
import androidx.navigation.NavHostController
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.zerohook.app.features.auth.AuthViewModel
import com.zerohook.app.features.auth.LoginScreen
import com.zerohook.app.features.call.CallScreen
import com.zerohook.app.features.call.CallViewModel
import com.zerohook.app.features.browse.BrowseScreen
import com.zerohook.app.features.browse.BrowseViewModel
import com.zerohook.app.features.chat.ChatViewModel
import com.zerohook.app.features.chat.ConversationListScreen
import com.zerohook.app.features.chat.MessageScreen
import com.zerohook.app.features.services.ServicesScreen
import com.zerohook.app.features.services.ServicesViewModel
import com.zerohook.app.features.wallet.WalletScreen
import com.zerohook.app.features.wallet.WalletViewModel
import com.zerohook.app.BuildConfig
import com.zerohook.app.IncomingCallLaunchData
import com.zerohook.app.util.InteractionPolicy

/**
 * Navigation graph for the Zerohook app.
 *
 * Routes:
 * - login → auth screen
 * - conversations → conversation list
 * - messages/{conversationId} → message thread
 * - call → active call screen (shown as overlay)
 *
 * ## Fixes applied:
 * - Deep link from notification taps (conversationId from intent)
 * - "Message user" from any profile navigates to or creates conversation
 * - Permission-gated call initiation
 */
object Routes {
    const val LOGIN = "login"
    const val BROWSE = "browse"
    const val SERVICES = "services"
    const val CONVERSATIONS = "conversations"
    const val WALLET = "wallet"
    const val MESSAGES = "messages/{conversationId}"
    const val CALL = "call"
    const val ACCOUNT = "account"

    fun messages(conversationId: String) = "messages/$conversationId"
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun ZerohookNavHost(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = hiltViewModel(),
    deepLinkConversationId: String? = null,
    deepLinkParticipantId: String? = null,
    deepLinkNonce: Long = 0L,
    incomingCallLaunch: IncomingCallLaunchData? = null,
    incomingCallNonce: Long = 0L,
    onDeepLinkConsumed: () -> Unit = {},
    onIncomingCallConsumed: () -> Unit = {}
) {
    val authState by authViewModel.state.collectAsState()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route
    val mainRoutes = remember {
        setOf(
            Routes.BROWSE,
            Routes.SERVICES,
            Routes.CONVERSATIONS,
            Routes.WALLET,
            Routes.ACCOUNT
        )
    }

    // Show bottom navigation only when authenticated and on one of the main app screens.
    // Keep thread screens immersive (web-mobile style): hide tab bar on message thread + call.
    val showBottomBar = authState.isAuthenticated && currentRoute in mainRoutes

    // Shared ViewModels — scoped to the nav graph lifetime
    val chatViewModel: ChatViewModel = hiltViewModel()
    val callViewModel: CallViewModel = hiltViewModel()
    val totalUnread by chatViewModel.totalUnread.collectAsState()
    val configuration = LocalConfiguration.current
    val isTabletLayout = configuration.screenWidthDp >= 900
    val snackbarHostState = remember { SnackbarHostState() }

    // Keep auth routing deterministic even when auth state flips after startup.
    // Guard initial composition: NavHost may not have attached its graph yet.
    LaunchedEffect(authState.isAuthenticated, currentRoute) {
        if (currentRoute == null) return@LaunchedEffect

        if (authState.isAuthenticated) {
            if (currentRoute == Routes.LOGIN) {
                navController.navigate(Routes.BROWSE) {
                    popUpTo(navController.graph.findStartDestination().id) {
                        inclusive = true
                    }
                    launchSingleTop = true
                }
            }
            chatViewModel.loadConversations()
        } else if (currentRoute != Routes.LOGIN) {
            chatViewModel.selectConversation(null)
            navController.navigate(Routes.LOGIN) {
                popUpTo(navController.graph.findStartDestination().id) {
                    inclusive = true
                }
                launchSingleTop = true
            }
        }
    }

    // Handle one-shot deep links from notifications and URI links.
    LaunchedEffect(deepLinkNonce, authState.isAuthenticated) {
        if (!authState.isAuthenticated || deepLinkNonce <= 0L) return@LaunchedEffect
        var consumed = false

        if (!deepLinkConversationId.isNullOrBlank()) {
            chatViewModel.selectConversation(deepLinkConversationId)
            navController.navigate(Routes.messages(deepLinkConversationId)) {
                popUpTo(Routes.CONVERSATIONS)
                launchSingleTop = true
            }
            consumed = true
        } else if (!deepLinkParticipantId.isNullOrBlank()) {
            chatViewModel.startConversation(deepLinkParticipantId)
            consumed = true
        }

        if (consumed) {
            onDeepLinkConsumed()
        }
    }

    LaunchedEffect(incomingCallNonce, authState.isAuthenticated) {
        if (!authState.isAuthenticated || incomingCallNonce <= 0L) return@LaunchedEffect
        val pendingCall = incomingCallLaunch ?: return@LaunchedEffect
        callViewModel.bootstrapIncomingCall(
            callerId = pendingCall.callerId,
            callerName = pendingCall.callerName,
            callType = pendingCall.callType,
            callId = pendingCall.callId,
            autoAccept = pendingCall.autoAccept
        )
        onIncomingCallConsumed()
    }

    // FIX: Observe startConversation result to auto-navigate to the new chat
    val navigateToConversation by chatViewModel.navigateToConversation.collectAsState()
    LaunchedEffect(navigateToConversation) {
        navigateToConversation?.let { convId ->
            chatViewModel.selectConversation(convId)
            navController.navigate(Routes.messages(convId)) {
                popUpTo(Routes.CONVERSATIONS)
                launchSingleTop = true
            }
            chatViewModel.clearNavigateToConversation()
        }
    }

    val chatActionFeedback by chatViewModel.actionFeedback.collectAsState()
    LaunchedEffect(chatActionFeedback) {
        val feedback = chatActionFeedback ?: return@LaunchedEffect
        val sugarTypeLabel = feedback.requiredAccessType
            ?.replace('_', ' ')
            ?.replaceFirstChar { ch -> if (ch.isLowerCase()) ch.titlecase() else ch.toString() }
        val message = if (feedback.requiresSugarAccess && !sugarTypeLabel.isNullOrBlank()) {
            "${feedback.message}. Activate $sugarTypeLabel access to continue."
        } else {
            feedback.message
        }

        val snackbarResult = snackbarHostState.showSnackbar(
            message = message,
            actionLabel = if (feedback.requiresSugarAccess) "Wallet" else null,
            duration = SnackbarDuration.Short
        )

        if (snackbarResult == SnackbarResult.ActionPerformed && feedback.requiresSugarAccess) {
            navController.navigate(Routes.WALLET) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }

        chatViewModel.clearActionFeedback()
    }

    // Observe call state — navigate to call screen when a call is active
    val callState by callViewModel.uiState.collectAsState()
    LaunchedEffect(callState.phase) {
        when (callState.phase) {
            CallViewModel.CallPhase.INCOMING,
            CallViewModel.CallPhase.OUTGOING,
            CallViewModel.CallPhase.CONNECTING,
            CallViewModel.CallPhase.ACTIVE -> {
                if (navController.currentDestination?.route != Routes.CALL) {
                    navController.navigate(Routes.CALL) {
                        launchSingleTop = true
                    }
                }
            }
            CallViewModel.CallPhase.ENDED,
            CallViewModel.CallPhase.IDLE -> {
                if (navController.currentDestination?.route == Routes.CALL) {
                    navController.popBackStack()
                }
            }
        }
    }

    val navigateToMainRoute: (String) -> Unit = { route ->
        navController.navigate(route) {
            popUpTo(navController.graph.findStartDestination().id) {
                saveState = true
            }
            launchSingleTop = true
            restoreState = true
        }
    }

    Scaffold(
        snackbarHost = {
            SnackbarHost(
                hostState = snackbarHostState,
                modifier = Modifier.padding(
                    bottom = if (showBottomBar && !isTabletLayout) 72.dp else 16.dp
                )
            )
        },
        bottomBar = {
            if (showBottomBar && !isTabletLayout) {
                Surface(
                    tonalElevation = 12.dp,
                    shadowElevation = 14.dp,
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f)
                ) {
                    NavigationBar(
                        containerColor = Color.Transparent,
                        tonalElevation = 0.dp
                    ) {
                        val navItemColors = NavigationBarItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.16f),
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        NavigationBarItem(
                            selected = currentRoute == Routes.BROWSE,
                            onClick = { navigateToMainRoute(Routes.BROWSE) },
                            icon = { Icon(Icons.Default.Home, contentDescription = "Browse") },
                            label = { Text("Browse") },
                            colors = navItemColors
                        )

                        NavigationBarItem(
                            selected = currentRoute == Routes.SERVICES,
                            onClick = { navigateToMainRoute(Routes.SERVICES) },
                            icon = { Icon(Icons.Default.Favorite, contentDescription = "Services") },
                            label = { Text("Services") },
                            colors = navItemColors
                        )

                        NavigationBarItem(
                            selected = currentRoute == Routes.CONVERSATIONS || currentRoute?.startsWith("messages/") == true,
                            onClick = {
                                chatViewModel.selectConversation(null)
                                navigateToMainRoute(Routes.CONVERSATIONS)
                            },
                            icon = {
                                BadgedBox(
                                    badge = {
                                        if (totalUnread > 0) {
                                            Badge(
                                                modifier = Modifier.semantics {
                                                    contentDescription = "Unread messages: $totalUnread"
                                                }
                                            ) {
                                                Text(if (totalUnread > 99) "99+" else "$totalUnread")
                                            }
                                        }
                                    }
                                ) {
                                    Icon(Icons.Default.Chat, contentDescription = "Messages")
                                }
                            },
                            label = { Text("Messages") },
                            colors = navItemColors
                        )

                        NavigationBarItem(
                            selected = currentRoute == Routes.WALLET,
                            onClick = { navigateToMainRoute(Routes.WALLET) },
                            icon = { Icon(Icons.Default.AccountBalanceWallet, contentDescription = "Wallet") },
                            label = { Text("Wallet") },
                            colors = navItemColors
                        )

                        NavigationBarItem(
                            selected = currentRoute == Routes.ACCOUNT,
                            onClick = { navigateToMainRoute(Routes.ACCOUNT) },
                            icon = { Icon(Icons.Default.Person, contentDescription = "Profile") },
                            label = { Text("Profile") },
                            colors = navItemColors
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (showBottomBar && isTabletLayout) {
                Surface(
                    tonalElevation = 10.dp,
                    shadowElevation = 12.dp,
                    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f),
                    modifier = Modifier.fillMaxHeight()
                ) {
                    NavigationRail(
                        containerColor = Color.Transparent
                    ) {
                        val navRailColors = NavigationRailItemDefaults.colors(
                            selectedIconColor = MaterialTheme.colorScheme.primary,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.16f),
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        NavigationRailItem(
                            selected = currentRoute == Routes.BROWSE,
                            onClick = { navigateToMainRoute(Routes.BROWSE) },
                            icon = { Icon(Icons.Default.Home, contentDescription = "Browse") },
                            label = { Text("Browse") },
                            colors = navRailColors
                        )

                        NavigationRailItem(
                            selected = currentRoute == Routes.SERVICES,
                            onClick = { navigateToMainRoute(Routes.SERVICES) },
                            icon = { Icon(Icons.Default.Favorite, contentDescription = "Services") },
                            label = { Text("Services") },
                            colors = navRailColors
                        )

                        NavigationRailItem(
                            selected = currentRoute == Routes.CONVERSATIONS || currentRoute?.startsWith("messages/") == true,
                            onClick = {
                                chatViewModel.selectConversation(null)
                                navigateToMainRoute(Routes.CONVERSATIONS)
                            },
                            icon = {
                                BadgedBox(
                                    badge = {
                                        if (totalUnread > 0) {
                                            Badge(
                                                modifier = Modifier.semantics {
                                                    contentDescription = "Unread messages: $totalUnread"
                                                }
                                            ) {
                                                Text(if (totalUnread > 99) "99+" else "$totalUnread")
                                            }
                                        }
                                    }
                                ) {
                                    Icon(Icons.Default.Chat, contentDescription = "Messages")
                                }
                            },
                            label = { Text("Messages") },
                            colors = navRailColors
                        )

                        NavigationRailItem(
                            selected = currentRoute == Routes.WALLET,
                            onClick = { navigateToMainRoute(Routes.WALLET) },
                            icon = { Icon(Icons.Default.AccountBalanceWallet, contentDescription = "Wallet") },
                            label = { Text("Wallet") },
                            colors = navRailColors
                        )

                        NavigationRailItem(
                            selected = currentRoute == Routes.ACCOUNT,
                            onClick = { navigateToMainRoute(Routes.ACCOUNT) },
                            icon = { Icon(Icons.Default.Person, contentDescription = "Profile") },
                            label = { Text("Profile") },
                            colors = navRailColors
                        )
                    }
                }
            }

            NavHost(
                navController = navController,
                startDestination = Routes.LOGIN,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxSize()
            ) {

            composable(Routes.LOGIN) {
                LoginScreen(
                    onNavigateToChat = {
                        navController.navigate(Routes.BROWSE) {
                            popUpTo(Routes.LOGIN) { inclusive = true }
                            launchSingleTop = true
                        }
                    },
                    viewModel = authViewModel
                )
            }

            composable(Routes.BROWSE) {
                val browseViewModel: BrowseViewModel = hiltViewModel()
                val browseState by browseViewModel.uiState.collectAsState()

                BrowseScreen(
                    state = browseState,
                    onTabSelected = browseViewModel::onTabSelected,
                    onSearchQueryChange = browseViewModel::onSearchQueryChange,
                    onRefresh = browseViewModel::refresh,
                    onProfileViewed = browseViewModel::onProfileViewed,
                    onMessageClick = { profile ->
                        browseViewModel.onProfileAction(profile.id, "chat_tap")
                        chatViewModel.startConversation(
                            participantId = profile.id,
                            targetAccountType = profile.accountType
                        )
                    },
                    onShareClick = { profile ->
                        browseViewModel.onProfileAction(profile.id, "share_tap")
                    },
                    onMoreClick = { profile ->
                        browseViewModel.onProfileAction(profile.id, "more_tap")
                    }
                )
            }

            composable(Routes.SERVICES) {
                val servicesViewModel: ServicesViewModel = hiltViewModel()
                val servicesState by servicesViewModel.uiState.collectAsState()

                ServicesScreen(
                    state = servicesState,
                    onSearchQueryChange = servicesViewModel::onSearchQueryChange,
                    onCategorySelected = servicesViewModel::onCategorySelected,
                    onRefresh = servicesViewModel::refresh,
                    onRetry = servicesViewModel::refresh,
                    onClearError = servicesViewModel::clearError,
                    onMessageProvider = { service ->
                        if (service.provider.id.isBlank()) return@ServicesScreen
                        chatViewModel.startConversation(
                            participantId = service.provider.id,
                            targetAccountType = InteractionPolicy.ACCOUNT_TYPE_PROVIDER
                        )
                    }
                )
            }

            composable(Routes.CONVERSATIONS) {
                val conversations by chatViewModel.conversations.collectAsState()
                val typingConversations by chatViewModel.typingConversations.collectAsState()
                val isLoading by chatViewModel.isLoading.collectAsState()
                val socketState by chatViewModel.connectionState.collectAsState()

                ConversationListScreen(
                    conversations = conversations,
                    typingConversations = typingConversations,
                    isLoading = isLoading,
                    connectionState = socketState,
                    onConversationClick = { conv ->
                        chatViewModel.selectConversation(conv.id)
                        navController.navigate(Routes.messages(conv.id))
                    },
                    onRefresh = { chatViewModel.loadConversations() }
                )
            }

            composable(Routes.WALLET) {
                val walletViewModel: WalletViewModel = hiltViewModel()
                val walletState by walletViewModel.uiState.collectAsState()

                WalletScreen(
                    state = walletState,
                    onRefresh = walletViewModel::refresh,
                    onFilterSelected = walletViewModel::onFilterSelected,
                    onDepositRequest = walletViewModel::requestDeposit,
                    onWithdrawRequest = walletViewModel::requestWithdrawal,
                    onDismissFeedback = walletViewModel::dismissFeedback,
                    onClearError = walletViewModel::clearError
                )
            }

            composable(Routes.MESSAGES) { backStackEntry ->
                val conversationId = backStackEntry.arguments?.getString("conversationId") ?: return@composable
                val conversations by chatViewModel.conversations.collectAsState()
                val messages by chatViewModel.messages.collectAsState()
                val isRemoteTyping by chatViewModel.remoteTyping.collectAsState()
                val hasMoreMessages by chatViewModel.hasMoreMessages.collectAsState()
                val isLoadingMore by chatViewModel.isLoadingMore.collectAsState()

                val conversation = conversations.find { it.id == conversationId }

                // Ensure the conversation is selected
                LaunchedEffect(conversationId) {
                    chatViewModel.selectConversation(conversationId)
                }

                MessageScreen(
                    conversation = conversation,
                    messages = messages,
                    currentUserId = authState.userId ?: "",
                    isRemoteTyping = isRemoteTyping,
                    hasMoreMessages = hasMoreMessages,
                    isLoadingMore = isLoadingMore,
                    onBack = {
                        chatViewModel.selectConversation(null)
                        navController.popBackStack()
                    },
                    onSendMessage = { text -> chatViewModel.sendMessage(text) },
                    onTyping = { chatViewModel.onTyping() },
                    onCallClick = { callType ->
                        conversation?.let {
                            callViewModel.startCall(it.participantId, it.participantName, callType)
                        }
                    },
                    onAttachFile = { uri -> chatViewModel.sendFile(uri) },
                    onRetryMessage = { messageId -> chatViewModel.retryMessage(messageId) },
                    onLoadMore = { chatViewModel.loadMoreMessages() }
                )
            }

            composable(Routes.ACCOUNT) {
                AccountScreen(
                    userId = authState.userId,
                    onLogout = { authViewModel.logout() }
                )
            }

            composable(Routes.CALL) {
                CallScreen(viewModel = callViewModel)
            }
        }
    }
}
}

@Composable
private fun FeaturePlaceholderScreen(
    title: String,
    subtitle: String,
    actionLabel: String,
    onAction: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
                        MaterialTheme.colorScheme.background
                    )
                )
            )
            .padding(20.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.88f)
            )
        ) {
            Column(modifier = Modifier.padding(20.dp)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(16.dp))
                Button(onClick = onAction) {
                    Text(actionLabel)
                }
            }
        }
    }
}

@Composable
private fun AccountScreen(
    userId: String?,
    onLogout: () -> Unit,
    chatViewModel: com.zerohook.app.features.chat.ChatViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    var showTraceDialog by remember { mutableStateOf(false) }
    val trace by chatViewModel.socketTrace.collectAsState()
    val notificationPermissionRequired = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    var notificationPermissionGranted by remember {
        mutableStateOf(
            !notificationPermissionRequired ||
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED
        )
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { granted ->
        notificationPermissionGranted = granted
    }

    LaunchedEffect(context, notificationPermissionRequired) {
        if (notificationPermissionRequired) {
            notificationPermissionGranted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.Start
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.85f)
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Profile",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Manage your account and messaging diagnostics",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.height(14.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)
                ) {
                    Text(
                        text = "User ID: ${userId ?: "Unknown"}",
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        if (notificationPermissionRequired && !notificationPermissionGranted) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.65f)
                )
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text(
                        text = "Enable notifications for new messages and incoming calls.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = {
                            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    ) {
                        Text("Enable notifications")
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Realtime quality",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = "We continuously monitor chat delivery, presence, and call signaling for faster issue resolution.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth(),
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.error,
                contentColor = MaterialTheme.colorScheme.onError
            )
        ) {
            Text("Logout")
        }

        if (BuildConfig.DEBUG) {
            Spacer(modifier = Modifier.height(12.dp))
            Button(onClick = {
                chatViewModel.sendSocketTraceToServer()
                Toast.makeText(context, "Trace upload requested", Toast.LENGTH_SHORT).show()
            }) {
                Text("Upload socket trace")
            }
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedButton(onClick = { showTraceDialog = true }) {
                Text("View socket trace")
            }
        }
    }

    if (showTraceDialog) {
        AlertDialog(
            onDismissRequest = { showTraceDialog = false },
            title = { Text("Socket trace (latest ${trace.size})") },
            text = {
                Column(Modifier.fillMaxWidth()) {
                    if (trace.isEmpty()) {
                        Text("No trace events yet.")
                    } else {
                        LazyColumn(Modifier.height(240.dp)) {
                            items(trace.reversed()) { line ->
                                Text(
                                    text = line,
                                    style = MaterialTheme.typography.bodySmall,
                                    maxLines = 3,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                            }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showTraceDialog = false }) {
                    Text("Close")
                }
            }
        )
    }
}

