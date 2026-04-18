package com.zerohook.app.features.chat

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.zerohook.app.data.local.entity.ConversationEntity
import com.zerohook.app.data.local.entity.MessageEntity
import com.zerohook.app.util.AppPermissions
import com.zerohook.app.util.MessageUtils
import com.zerohook.app.util.rememberPermissionRequest
import kotlinx.coroutines.launch

/**
 * Message thread screen — shows messages for the selected conversation.
 *
 * ## Features:
 * - Read ticks (✓ sent, ✓✓ read) driven by message.readAt from Room
 * - URL content displayed as friendly labels (📷 Photo) via MessageUtils
 * - Typing indicator properly cleared when message arrives
 * - Auto-scroll on new messages
 * - **Image/file picker** — attach button launches system content picker
 * - **Tap-to-retry** — failed messages show retry prompt
 * - **Infinite scroll** — scrolling near top loads older messages (cursor pagination)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MessageScreen(
    conversation: ConversationEntity?,
    messages: List<MessageEntity>,
    currentUserId: String,
    isRemoteTyping: Boolean,
    hasMoreMessages: Boolean,
    isLoadingMore: Boolean,
    onBack: () -> Unit,
    onSendMessage: (String) -> Unit,
    onTyping: () -> Unit,
    onCallClick: (String) -> Unit,
    onAttachFile: (Uri) -> Unit,
    onRetryMessage: (String) -> Unit,
    onLoadMore: () -> Unit
) {
    var messageText by rememberSaveable(conversation?.id) { mutableStateOf("") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()
    var previousMessageCount by remember(conversation?.id) { mutableIntStateOf(0) }
    var showAttachmentMenu by remember { mutableStateOf(false) }

    val (hasAudioCallPermissions, requestAudioCallPermissions) = rememberPermissionRequest(
        permissions = AppPermissions.AUDIO_CALL,
        onResult = { granted ->
            if (granted) {
                onCallClick("audio")
            }
        }
    )

    val (hasVideoCallPermissions, requestVideoCallPermissions) = rememberPermissionRequest(
        permissions = AppPermissions.VIDEO_CALL,
        onResult = { granted ->
            if (granted) {
                onCallClick("video")
            }
        }
    )

    // ── Attachment pickers ───────────────────────────────────────────────
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { onAttachFile(it) }
    }
    val videoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { onAttachFile(it) }
    }
    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        uri?.let { onAttachFile(it) }
    }

    // ── Retry dialog state ──────────────────────────────────────────────
    var retryMessageId by remember { mutableStateOf<String?>(null) }

    // Auto-scroll only for initial loads or when user is already near the bottom.
    // This prevents history pagination from snapping the list to the newest message.
    val isNearBottom by remember(messages.size, listState) {
        derivedStateOf {
            val lastVisibleIndex = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index
            if (lastVisibleIndex == null) return@derivedStateOf true
            val targetIndex = (messages.lastIndex - 2).coerceAtLeast(0)
            lastVisibleIndex >= targetIndex
        }
    }

    val showJumpToLatest by remember(messages.size, listState) {
        derivedStateOf {
            if (messages.isEmpty()) return@derivedStateOf false
            val firstVisibleIndex = listState.firstVisibleItemIndex
            val minDistance = (messages.lastIndex - 6).coerceAtLeast(0)
            firstVisibleIndex < minDistance && !isNearBottom
        }
    }

    val sendCurrentMessage: () -> Unit = {
        val trimmed = messageText.trim()
        if (trimmed.isNotEmpty()) {
            onSendMessage(trimmed)
            messageText = ""
        }
    }

    LaunchedEffect(messages.size, isLoadingMore) {
        if (messages.isEmpty()) {
            previousMessageCount = 0
            return@LaunchedEffect
        }

        val isInitialLoad = previousMessageCount == 0
        val appendedMessages = messages.size > previousMessageCount

        if (isInitialLoad || (appendedMessages && !isLoadingMore && isNearBottom)) {
            listState.animateScrollToItem(messages.size - 1)
        }

        previousMessageCount = messages.size
    }

    // ── Pagination trigger: load more when scrolling near top ───────────
    val shouldLoadMore by remember {
        derivedStateOf {
            val firstVisible = listState.firstVisibleItemIndex
            // Trigger when within 3 items of the top and there are more to load
            firstVisible <= 3 && hasMoreMessages && !isLoadingMore
        }
    }
    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) {
            onLoadMore()
        }
    }

    // ── Retry confirmation dialog ───────────────────────────────────────
    if (retryMessageId != null) {
        AlertDialog(
            onDismissRequest = { retryMessageId = null },
            title = { Text("Message failed") },
            text = { Text("Tap Retry to resend this message.") },
            confirmButton = {
                TextButton(onClick = {
                    retryMessageId?.let { onRetryMessage(it) }
                    retryMessageId = null
                }) { Text("Retry") }
            },
            dismissButton = {
                TextButton(onClick = { retryMessageId = null }) { Text("Cancel") }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // Avatar
                        Box(modifier = Modifier.size(36.dp)) {
                            AsyncImage(
                                model = conversation?.participantAvatar,
                                contentDescription = null,
                                modifier = Modifier
                                    .fillMaxSize()
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                            )
                            if (conversation?.participantOnline == true) {
                                Box(
                                    modifier = Modifier
                                        .size(10.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF00E676))
                                        .align(Alignment.BottomEnd)
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = conversation?.participantName ?: "",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 16.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = when {
                                    isRemoteTyping -> "typing..."
                                    conversation?.participantOnline == true -> "Online"
                                    !conversation?.participantLastSeenLabel.isNullOrBlank() -> conversation?.participantLastSeenLabel ?: "Offline"
                                    else -> "Offline"
                                },
                                fontSize = 12.sp,
                                color = when {
                                    isRemoteTyping -> MaterialTheme.colorScheme.primary
                                    conversation?.participantOnline == true -> Color(0xFF00E676)
                                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                                }
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        if (hasAudioCallPermissions) {
                            onCallClick("audio")
                        } else {
                            requestAudioCallPermissions()
                        }
                    }) {
                        Icon(Icons.Default.Call, contentDescription = "Audio call")
                    }
                    IconButton(onClick = {
                        if (hasVideoCallPermissions) {
                            onCallClick("video")
                        } else {
                            requestVideoCallPermissions()
                        }
                    }) {
                        Icon(Icons.Default.Videocam, contentDescription = "Video call")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f),
                    scrolledContainerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            // Message input with attachment button
            Surface(
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f),
                tonalElevation = 5.dp,
                shadowElevation = 3.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 10.dp, vertical = 8.dp)
                        .navigationBarsPadding()
                        .imePadding(),
                    verticalAlignment = Alignment.Bottom
                ) {
                    // Attachment button
                    Box {
                        Surface(
                            shape = CircleShape,
                            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.75f)
                        ) {
                            IconButton(
                                onClick = { showAttachmentMenu = true },
                                modifier = Modifier.size(44.dp)
                            ) {
                                Icon(
                                    Icons.Default.AttachFile,
                                    contentDescription = "Attach file",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        DropdownMenu(
                            expanded = showAttachmentMenu,
                            onDismissRequest = { showAttachmentMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("Photo") },
                                leadingIcon = {
                                    Icon(Icons.Default.Image, contentDescription = null)
                                },
                                onClick = {
                                    showAttachmentMenu = false
                                    imagePickerLauncher.launch(arrayOf("image/*"))
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Video") },
                                leadingIcon = {
                                    Icon(Icons.Default.Movie, contentDescription = null)
                                },
                                onClick = {
                                    showAttachmentMenu = false
                                    videoPickerLauncher.launch(arrayOf("video/*"))
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Document") },
                                leadingIcon = {
                                    Icon(Icons.Default.Description, contentDescription = null)
                                },
                                onClick = {
                                    showAttachmentMenu = false
                                    filePickerLauncher.launch(arrayOf("*/*"))
                                }
                            )
                        }
                    }

                    OutlinedTextField(
                        value = messageText,
                        onValueChange = {
                            messageText = it
                            if (it.isNotEmpty()) onTyping()
                        },
                        modifier = Modifier.weight(1f),
                        placeholder = { Text("Write a message") },
                        maxLines = 4,
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                        keyboardActions = KeyboardActions(onSend = { sendCurrentMessage() }),
                        shape = RoundedCornerShape(24.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.70f),
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.55f),
                            focusedBorderColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.70f),
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.55f)
                        )
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    FilledIconButton(
                        onClick = sendCurrentMessage,
                        modifier = Modifier.size(48.dp),
                        enabled = messageText.isNotBlank()
                    ) {
                        Icon(Icons.Filled.Send, contentDescription = "Send")
                    }
                }
            }
        },
        floatingActionButton = {
            if (showJumpToLatest) {
                SmallFloatingActionButton(
                    onClick = {
                        if (messages.isNotEmpty()) {
                            scope.launch {
                                listState.animateScrollToItem(messages.lastIndex)
                            }
                        }
                    }
                ) {
                    Icon(Icons.Default.ArrowDownward, contentDescription = "Jump to latest")
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 12.dp),
            state = listState,
            verticalArrangement = Arrangement.spacedBy(4.dp),
            contentPadding = PaddingValues(vertical = 8.dp)
        ) {
            // Loading more indicator at top
            if (isLoadingMore) {
                item(key = "_loading_more") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            strokeWidth = 2.dp
                        )
                    }
                }
            } else if (!hasMoreMessages && messages.size > 50) {
                item(key = "_no_more") {
                    Text(
                        text = "Beginning of conversation",
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp),
                        textAlign = TextAlign.Center,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                }
            }

            items(messages, key = { it.id }) { message ->
                val isFailed = message.status == "failed"
                val canRetry = isFailed && message.messageType == "text"
                MessageBubble(
                    message = message,
                    isOwn = message.senderId == currentUserId,
                    onRetryClick = if (canRetry) {
                        { retryMessageId = message.id }
                    } else null
                )
            }

            // Typing indicator
            if (isRemoteTyping) {
                item {
                    Text(
                        text = "typing...",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 8.dp, top = 4.dp)
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageBubble(
    message: MessageEntity,
    isOwn: Boolean,
    onRetryClick: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val bgColor = if (isOwn) MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
    else MaterialTheme.colorScheme.surfaceVariant

    val alignment = if (isOwn) Arrangement.End else Arrangement.Start
    val isFailed = message.status == "failed"
    val mediaUrl = if (MessageUtils.isLikelyUrl(message.content)) {
        MessageUtils.resolveMediaUrl(message.content)
    } else {
        null
    }

    val onTapAction: (() -> Unit)? = when {
        onRetryClick != null -> onRetryClick
        !mediaUrl.isNullOrBlank() -> {
            {
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(mediaUrl)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                } catch (_: Exception) {
                    Toast.makeText(context, "Unable to open attachment", Toast.LENGTH_SHORT).show()
                }
            }
        }
        else -> null
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = alignment
    ) {
        Column(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 16.dp,
                        topEnd = 16.dp,
                        bottomStart = if (isOwn) 16.dp else 4.dp,
                        bottomEnd = if (isOwn) 4.dp else 16.dp
                    )
                )
                .background(if (isFailed) Color(0x22FF5252) else bgColor)
                .combinedClickable(
                    onClick = { onTapAction?.invoke() },
                    onLongClick = {
                        val copyText = when {
                            mediaUrl.isNullOrBlank() -> message.content
                            else -> mediaUrl
                        }
                        if (copyText.isNotBlank()) {
                            clipboardManager.setText(AnnotatedString(copyText))
                            Toast.makeText(context, "Copied", Toast.LENGTH_SHORT).show()
                        }
                    }
                )
                .padding(12.dp)
        ) {
            // If it's a media URL, show the friendly label
            val displayContent = when {
                isFailed && message.messageType != "text" -> "Upload failed. Please pick and resend."
                MessageUtils.isLikelyUrl(message.content) -> MessageUtils.normalizePreview(message.content, message.messageType)
                else -> message.content
            }

            // For images, show a placeholder + the image
            if (message.messageType == "image" && MessageUtils.isLikelyUrl(message.content)) {
                AsyncImage(
                    model = MessageUtils.resolveMediaUrl(message.content),
                    contentDescription = "Photo",
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 200.dp)
                        .clip(RoundedCornerShape(8.dp)),
                    contentScale = ContentScale.Crop
                )
            } else {
                Text(
                    text = displayContent,
                    fontSize = 15.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            // Time + read ticks
            Row(
                modifier = Modifier
                    .align(Alignment.End)
                    .padding(top = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = MessageUtils.formatRelativeTime(message.createdAt),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )

                // Read ticks for own messages
                if (isOwn) {
                    Spacer(modifier = Modifier.width(4.dp))
                    val tickText = when {
                        message.readAt != null -> "✓✓"  // Read
                        message.status == "sent" -> "✓"  // Sent/delivered
                        message.status == "sending" -> "⏳"
                        isFailed -> "✗ Tap to retry"
                        else -> "✓"
                    }
                    val tickColor = when {
                        message.readAt != null -> MaterialTheme.colorScheme.primary
                        isFailed -> Color(0xFFFF5252)
                        else -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    }
                    Text(
                        text = tickText,
                        fontSize = 12.sp,
                        color = tickColor
                    )
                }
            }
        }
    }
}
