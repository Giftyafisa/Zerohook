import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import axios from 'axios';
import apiClient from '../services/apiClient';
import { resolveProfileImage } from '../utils/imageUtils';
import useCurrency from './useCurrency';

// Environment-gated debug logger
const isDev = process.env.NODE_ENV === 'development';
const debugError = isDev ? (...args) => console.error(...args) : () => {};

/**
 * useFeedQuery – handles fetching profiles from the recommendation engine,
 *  pagination (infinite-scroll), abort-controller race-condition prevention,
 *  and profile-data normalisation.
 *
 * @param {object}  opts
 * @param {string}  opts.activeFilter  – current filter chip id
 * @param {string}  opts.searchQuery   – current search text
 * @param {object|null} opts.userLocation – location from useLocationBootstrap
 * @param {boolean} opts.locationLoading – still detecting location
 */
const useFeedQuery = ({ activeFilter, searchQuery, userLocation, locationLoading, discoverySurface = 'providers' }) => {
  const { user: currentUser, isAuthenticated } = useAuth();
  const reduxUser    = useSelector(selectUser);
  const { convertFromUSD } = useCurrency();

  const [displayedProfiles, setDisplayedProfiles] = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [loadingMore, setLoadingMore]             = useState(false);
  const [error, setError]                         = useState(null);
  const [page, setPage]                           = useState(1);
  const [hasMore, setHasMore]                     = useState(true);
  const [searchMetadata, setSearchMetadata]       = useState(null);

  const loadMoreRef       = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef       = useRef(0);

  // Price converter (stable ref)
  const convertPrice = useCallback(
    (basePriceUSD) => convertFromUSD(basePriceUSD),
    [convertFromUSD],
  );

  // ── core fetch ───────────────────────────────────
  const fetchProfiles = useCallback(
    async (pageNum = 1, append = false) => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();
      const currentRequestId = ++requestIdRef.current;

      try {
        setError(null); // Clear any previous error (e.g. stale "canceled")
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        const qp = new URLSearchParams({
          page: pageNum.toString(),
          limit: '24',
          filter: activeFilter,
          search: searchQuery,
        });

        if (discoverySurface) {
          qp.set('surface', String(discoverySurface));
        }

        if (userLocation) {
          if (userLocation.lat != null && userLocation.lng != null &&
              !isNaN(userLocation.lat) && !isNaN(userLocation.lng)) {
            qp.set('userLat', parseFloat(userLocation.lat).toFixed(6));
            qp.set('userLng', parseFloat(userLocation.lng).toFixed(6));
          }
          if (userLocation.city)       qp.set('userCity', userLocation.city);
          if (userLocation.country)    qp.set('userCountry', userLocation.country);
          if (userLocation.source)     qp.set('locationSource', userLocation.source);
          if (userLocation.confidence != null) qp.set('locationConfidence', userLocation.confidence);
          if (userLocation.accuracy)   qp.set('locationAccuracy', userLocation.accuracy);
        }

        const res = await apiClient.get(`/users/profiles?${qp}`, {
          signal: abortControllerRef.current.signal,
        });

        if (currentRequestId !== requestIdRef.current) return;

        const responseBody = res.data || {};
        const contractData = responseBody?.data && typeof responseBody.data === 'object'
          ? responseBody.data
          : null;
        const payload = contractData || responseBody;

        const rawUsers = [
          payload?.users,
          payload?.profiles,
          responseBody?.users,
          responseBody?.profiles
        ].find((candidate) => Array.isArray(candidate)) || [];

        const processed = rawUsers
          .filter((u) => {
            if (isAuthenticated && String(currentUser?.id) === String(u.id)) return false;
            if (String(reduxUser?.id) === String(u.id)) return false;
            if (u.profile_visibility === 'hidden') return false;
            if (u.profile_data?.profileVisibility === 'hidden') return false;
            return true;
          })
          .map((u) => {
            const pd = u.profile_data || {};
            const basePrice = pd.basePrice != null ? parseFloat(pd.basePrice) : null;
            const converted = basePrice != null ? convertPrice(basePrice) : null;
            const normalizedImage = resolveProfileImage({
              ...pd,
              photos: pd.photos || u.photos,
              profile_picture: pd.profile_picture || u.profile_picture,
              profilePicture: pd.profilePicture || u.profilePicture,
            });
            const hasProfileImage = !!(
              u.hasProfileImage ||
              u.profile_image ||
              u.profile_image_url ||
              pd.profilePicture ||
              pd.avatar ||
              pd.profile_picture ||
              normalizedImage ||
              (Array.isArray(pd.photos) && pd.photos.length > 0)
            );
            return {
              id: u.id,
              username: u.username,
              profileData: pd,
              verificationTier: parseInt(u.verification_tier) || 1,
              trustScore: parseFloat(u.reputation_score) || 75,
              isPremium: u.is_subscribed,
              isOnline: u.isOnline || u.is_online || false,
              lastActive: u.last_active || u.lastActive || u.created_at,
              lastSeenLabel: u.lastSeenLabel ?? u.last_seen_label ?? u.lastSeen ?? null,
              createdAt: u.created_at,
              distance: u.distance != null ? parseFloat(u.distance) : null,
              distanceEstimated: u.distanceEstimated,
              distanceSource: u.distanceSource,
              distanceConfidence: u.distanceConfidence,
              recommendationScore: parseFloat(u.recommendationScore) || 0,
              successRate: parseFloat(u.successRate) || 0,
              hasProfileImage,
              sameCountry: u.sameCountry,
              displayPrice: converted,
              scoreBreakdown: u.scoreBreakdown || null,
              eloRating: u.eloRating || 1200,
              matchPercentage: u.matchPercentage || null,
              rankingReasons: Array.isArray(u.rankingReasons) ? u.rankingReasons : [],
              exactSearchMatch: !!u.exactSearchMatch,
              trustFloorApplied: u.trustFloorApplied ?? null,
            };
          });

        if (append) setDisplayedProfiles((prev) => [...prev, ...processed]);
        else setDisplayedProfiles(processed);

        setHasMore(rawUsers.length === 24);
        setPage(pageNum);
        const metadata = payload?.metadata || responseBody?.metadata || null;
        if (metadata) setSearchMetadata(metadata);
        else if (pageNum === 1) setSearchMetadata(null);
      } catch (err) {
        // Axios throws CanceledError (not AbortError) when AbortController fires
        if (axios.isCancel(err) || err.name === 'AbortError' || err.name === 'CanceledError') return;
        // Ignore errors from stale requests that were superseded
        if (currentRequestId !== requestIdRef.current) return;
        debugError('Error fetching profiles:', err);
        setError(err.message);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [activeFilter, searchQuery, isAuthenticated, currentUser, reduxUser, userLocation, convertPrice, discoverySurface],
  );

  // Cleanup on unmount
  useEffect(() => () => { if (abortControllerRef.current) abortControllerRef.current.abort(); }, []);

  // ── Single unified trigger ────────────────────────────────────
  // Combines filter changes, location updates, and debounced search into one
  // effect to prevent triple-fetch overlap.
  const searchTimerRef = useRef(null);
  const prevSearchRef  = useRef(searchQuery);

  useEffect(() => {
    // If the searchQuery changed, debounce the fetch
    if (prevSearchRef.current !== searchQuery) {
      prevSearchRef.current = searchQuery;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => fetchProfiles(1), 500);
      return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }
    // Always fetch immediately for non-search changes; location updates trigger
    // a second refresh once available, but we never block initial hydration.
    fetchProfiles(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, searchQuery, locationLoading, userLocation]);

  // Infinite-scroll observer
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchProfiles(page + 1, true);
        }
      },
      { threshold: 0.1 },
    );
    if (loadMoreRef.current) obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchProfiles]);

  // Reset helper (e.g. when clearing filters)
  const resetProfiles = useCallback(() => {
    setPage(1);
    setDisplayedProfiles([]);
  }, []);

  return {
    displayedProfiles,
    loading,
    loadingMore,
    error,
    hasMore,
    page,
    searchMetadata,
    loadMoreRef,
    fetchProfiles,
    resetProfiles,
  };
};

export default useFeedQuery;
