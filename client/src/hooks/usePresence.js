import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

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
const usePresence = (userIds = [], { context = 'chat' } = {}) => {
  const { socket, isConnected } = useSocket();
  const [statusMap, setStatusMap] = useState({});
  const idsRef = useRef([]);

  // Deduplicate, stringify, and sort once so we get a stable dependency key
  const sortedIds = useMemo(
    () => [...new Set(userIds.map(id => String(id || '')).filter(Boolean))].sort(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userIds.length, userIds.join?.(',')]
  );
  const idsKey = sortedIds.join(',');

  // Keep a ref so socket listeners can read the latest list without re-binding
  useEffect(() => { idsRef.current = sortedIds; }, [sortedIds]);

  // ── Request bulk status when IDs change ──────────────────────────────────
  useEffect(() => {
    if (!socket || !isConnected || sortedIds.length === 0) return;
    socket.emit('get_users_status', { userIds: sortedIds, context });
  }, [socket, isConnected, idsKey, context]);

  // ── Listen for responses ─────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Batch response (from get_users_status)
    const handleBulk = ({ users = [] }) => {
      const tracked = idsRef.current;
      const updates = {};
      let changed = false;
      users.forEach(u => {
        const id = String(u.userId);
        if (tracked.includes(id)) {
          updates[id] = !!u.isOnline;
          changed = true;
        }
      });
      if (changed) setStatusMap(prev => ({ ...prev, ...updates }));
    };

    // Individual user connect / disconnect broadcast
    const handleSingle = ({ userId, isOnline }) => {
      const id = String(userId);
      if (idsRef.current.includes(id)) {
        setStatusMap(prev => {
          if (prev[id] === !!isOnline) return prev; // no change, skip re-render
          return { ...prev, [id]: !!isOnline };
        });
      }
    };

    socket.on('users_status', handleBulk);
    socket.on('user_status', handleSingle);

    return () => {
      socket.off('users_status', handleBulk);
      socket.off('user_status', handleSingle);
    };
  }, [socket]);

  // ── Public API ───────────────────────────────────────────────────────────
  const isUserOnline = useCallback(
    (userId) => {
      const val = statusMap[String(userId)];
      return val === undefined ? null : val;
    },
    [statusMap]
  );

  const onlineCount = useMemo(
    () => Object.values(statusMap).filter(Boolean).length,
    [statusMap]
  );

  return { isUserOnline, onlineCount, statusMap };
};

export default usePresence;
