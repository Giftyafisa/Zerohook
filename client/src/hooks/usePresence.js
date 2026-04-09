import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { API_BASE_URL } from '../config/constants';

/**
 * usePresence — real-time online-status tracking for a list of user IDs.
 *
 * On mount (and when the tracked ID list changes) it emits `get_users_status`
 * to get the current snapshot.  After that it listens for both:
 *   • `users_status`  (batch response)
 *   • `user_status`   (individual connect / disconnect broadcasts)
 *
 * @param {string[]} userIds   Array of user IDs to track
 * @param {object}   options
 * @param {string}   options.context  'chat' (default, conversation-gated) | 'browse' | 'feed' (public)
 *
 * Returns:
 *   isUserOnline(userId)     → true | false | null (null = unknown / not yet loaded)
 *   onlineCount              → number of tracked users currently online
 *   statusMap                → { [userId]: boolean }  plain object
 *
 * Usage:
 *   const ids = profiles.map(p => p.id);
 *   const { isUserOnline } = usePresence(ids, { context: 'browse' });
 *   // in render:  isUserOnline(profile.id) ?? profile.isOnline
 */
const usePresence = (userIds = [], { context = 'chat', initialStatusMap = {} } = {}) => {
  const { socket, isConnected, onlineUsersRef } = useSocket();
  const [statusMap, setStatusMap] = useState({});
  // lastSeenMap: { [userId]: string | null }  — populated from batch server response
  const [lastSeenMap, setLastSeenMap] = useState({});
  const idsRef = useRef([]);

  // Deduplicate, stringify, and sort once so we get a stable dependency key
  const sortedIds = useMemo(
    () => [...new Set(userIds.map(id => String(id || '')).filter(Boolean))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userIds.length, userIds.join?.(',')]
  );
  const idsKey = sortedIds.join(',');
  const trackedIdSet = useMemo(() => new Set(sortedIds), [sortedIds]);

  // Keep a ref so socket listeners can read the latest list without re-binding
  useEffect(() => { idsRef.current = sortedIds; }, [sortedIds]);

  // Prune stale keys when tracked IDs change to prevent stale status/lastSeen leaks.
  useEffect(() => {
    const tracked = new Set(sortedIds);
    setStatusMap(prev => {
      const next = {};
      Object.keys(prev).forEach((id) => {
        if (tracked.has(id)) next[id] = prev[id];
      });
      return next;
    });
    setLastSeenMap(prev => {
      const next = {};
      Object.keys(prev).forEach((id) => {
        if (tracked.has(id)) next[id] = prev[id];
      });
      return next;
    });
  }, [idsKey, sortedIds]);

  // Seed from server-provided snapshot (e.g. profile list payload) so
  // brand-new pages don't wait for the first socket round-trip.
  useEffect(() => {
    if (!initialStatusMap || sortedIds.length === 0) return;
    const seedUpdates = {};
    let hasSeed = false;
    sortedIds.forEach(id => {
      if (typeof initialStatusMap[id] === 'boolean') {
        seedUpdates[id] = initialStatusMap[id];
        hasSeed = true;
      }
    });
    if (hasSeed) {
      setStatusMap(prev => ({ ...prev, ...seedUpdates }));
      if (onlineUsersRef?.current) {
        Object.entries(seedUpdates).forEach(([id, isOnline]) => {
          onlineUsersRef.current.set(id, isOnline);
        });
      }
    }
  }, [initialStatusMap, idsKey, sortedIds, onlineUsersRef]);

  // ── Seed from global presence cache — removes flash-of-offline on mount ──
  // The SocketContext keeps onlineUsersRef up-to-date from broadcast events,
  // so we can instantly show cached status while the server round-trip is in flight.
  useEffect(() => {
    if (!onlineUsersRef?.current || sortedIds.length === 0) return;
    const seedUpdates = {};
    let hasSeed = false;
    sortedIds.forEach(id => {
      if (onlineUsersRef.current.has(id)) {
        seedUpdates[id] = !!onlineUsersRef.current.get(id);
        hasSeed = true;
      }
    });
    if (hasSeed) setStatusMap(prev => ({ ...prev, ...seedUpdates }));
  // onlineUsersRef is a stable ref — no need to list it in deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // ── Request bulk status when IDs change ──────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || sortedIds.length === 0) return;
    socket.emit('get_users_status', { userIds: sortedIds, context });
  }, [socket, isConnected, idsKey, sortedIds, context]);

  // ── HTTP fallback / initial hydration ───────────────────────────────────
  // Ensures presence can render promptly even before socket responses arrive,
  // and still works when socket connectivity is temporarily degraded.
  useEffect(() => {
    if (sortedIds.length === 0) return;

    const controller = new AbortController();
    let active = true;

    const fetchPresenceSnapshot = async () => {
      try {
        const params = new URLSearchParams({
          ids: sortedIds.join(','),
          context,
        });
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/users/presence?${params.toString()}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok || !active) return;
        const payload = await response.json();
        const users = Array.isArray(payload?.users) ? payload.users : [];
        if (users.length === 0) return;

        const statusUpdates = {};
        const lastSeenUpdates = {};
        users.forEach((u) => {
          const id = String(u.userId || '');
          if (!id || !trackedIdSet.has(id)) return;
          statusUpdates[id] = !!u.isOnline;
          if (!u.isOnline) {
            lastSeenUpdates[id] = u.lastSeenLabel || null;
          } else {
            lastSeenUpdates[id] = null;
          }

          if (onlineUsersRef?.current) {
            onlineUsersRef.current.set(id, !!u.isOnline);
          }
        });

        if (!active) return;
        setStatusMap((prev) => ({ ...prev, ...statusUpdates }));
        setLastSeenMap((prev) => ({ ...prev, ...lastSeenUpdates }));
      } catch (err) {
        if (err?.name === 'AbortError') return;
      }
    };

    fetchPresenceSnapshot();

    // Periodic fallback reconcile in case websocket events are missed
    const fallbackTimer = setInterval(() => {
      if (!active) return;
      fetchPresenceSnapshot().catch((err) => {
        console.error('Presence fallback snapshot failed:', err);
      });
    }, 30000); // 30s

    return () => {
      active = false;
      controller.abort();
      clearInterval(fallbackTimer);
    };
  }, [idsKey, sortedIds, trackedIdSet, context, onlineUsersRef]);

  // ── Listen for responses ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Batch response (from get_users_status)
    const handleBulk = ({ users = [] }) => {
      const tracked = idsRef.current;
      const trackedSet = new Set(tracked);
      const statusUpdates = {};
      const lastSeenUpdates = {};
      let changed = false;
      users.forEach(u => {
        const id = String(u.userId);
        if (trackedSet.has(id)) {
          statusUpdates[id] = !!u.isOnline;
          // Capture lastSeenLabel for offline users from server response
          lastSeenUpdates[id] = u.isOnline ? null : (u.lastSeenLabel || null);
          if (onlineUsersRef?.current) {
            onlineUsersRef.current.set(id, !!u.isOnline);
          }
          changed = true;
        }
      });
      if (changed) {
        setStatusMap(prev => ({ ...prev, ...statusUpdates }));
        setLastSeenMap(prev => ({ ...prev, ...lastSeenUpdates }));
      }
    };

    // Individual user connect / disconnect broadcast
    const handleSingle = ({ userId, isOnline, lastSeenLabel }) => {
      const id = String(userId);
      if (idsRef.current.includes(id)) {
        setStatusMap(prev => {
          if (prev[id] === !!isOnline) return prev; // no change, skip re-render
          return { ...prev, [id]: !!isOnline };
        });
        // Update lastSeen: clear when online, preserve/update when offline
        setLastSeenMap(prev => ({
          ...prev,
          [id]: isOnline ? null : (lastSeenLabel || prev[id] || null),
        }));
        if (onlineUsersRef?.current) {
          onlineUsersRef.current.set(id, !!isOnline);
        }
      }
    };

    socket.on('users_status', handleBulk);
    socket.on('user_status', handleSingle);

    return () => {
      socket.off('users_status', handleBulk);
      socket.off('user_status', handleSingle);
    };
  }, [socket, onlineUsersRef]);

  // ── Public API ───────────────────────────────────────────────────────────
  const isUserOnline = useCallback(
    (userId) => {
      const val = statusMap[String(userId)];
      return val === undefined ? null : val;
    },
    [statusMap]
  );

  // Returns a pre-formatted label like "5m ago", "2h ago", or null if online/unknown
  const getUserLastSeen = useCallback(
    (userId) => lastSeenMap[String(userId)] ?? null,
    [lastSeenMap]
  );

  const onlineCount = useMemo(
    () => Object.values(statusMap).filter(Boolean).length,
    [statusMap]
  );

  return { isUserOnline, getUserLastSeen, onlineCount, statusMap };
};

export default usePresence;
