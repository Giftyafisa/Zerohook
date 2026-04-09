# Zerohook Realtime QA Checklist

Use this checklist for live verification of chat, presence, read ticks, calls, and background notifications.

Enable compact trace mode for a test session with `?traceRealtime=1` or by setting `localStorage['zerohook.realtimeTrace.enabled'] = '1'` before loading the app.

## 1. Chat entry points
- Open a provider/client profile and click Message.
- Open a service profile and click Message.
- Open a message notification and confirm it lands in `/chat` with the correct recipient selected.
- Confirm the same recipient still opens correctly after a full page refresh.

## 2. Live message delivery
- Send a text message from device A to device B.
- Confirm the message appears immediately on both sides without manual refresh.
- Send an image, video, and file message.
- Confirm inbox previews show friendly labels such as Photo, Video, or File instead of raw URLs.

## 3. Presence and read ticks
- Keep the chat open on device B and verify the sender appears online.
- Switch device B to another conversation and confirm typing indicators stop cleanly.
- Mark a message as read and verify the read state updates on both devices.
- Close the app or tab on device B and verify the sender transitions to offline / last seen.

## 4. Call and media flow
- Start an audio call from device A to device B.
- Confirm the incoming call alert appears on device B.
- Accept the call and verify audio is heard end to end.
- Repeat with a video call and verify both video streams render.
- End the call from each side once and confirm both sides tear down cleanly.

## 5. Background notifications
- Put the app in the background or switch tabs.
- Send a message to the backgrounded user.
- Confirm the browser/device notification fires and the unread badge increments.
- Return to the app and confirm the unread count and message list remain consistent.

## 6. Resilience checks
- Repeat the above on a mobile device.
- Test once on a restrictive network or with poor connectivity.
- Confirm the app still reconnects, restores presence, and resumes message delivery.

## 7. Pass criteria
- No duplicate toasts or duplicate device notifications.
- No dead Message buttons or incorrect chat targets.
- No missed read receipts or stuck typing indicators.
- No one-way audio/video in calls.
- No raw media URLs shown in inbox previews.

## 8. What to capture if something fails
- Browser console logs.
- Network tab for `/socket.io`, `/api/chat`, and `/api/notifications`.
- Mobile app logs for call permission, speaker routing, and call lifecycle.
- Exact recipient, conversation ID, and time of failure.