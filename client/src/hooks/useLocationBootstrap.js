import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { selectUserCountry, selectDetectedCountry } from '../store/slices/countrySlice';
import { API_BASE_URL } from '../config/constants';
import { LOCATIONS, calculateDistance } from '../config/locations';

// Environment-gated debug logger
const isDev = process.env.NODE_ENV === 'development';
const debugLog  = isDev ? (...args) => console.log(...args)  : () => {};
const debugError = isDev ? (...args) => console.error(...args) : () => {};

// ─── helpers ────────────────────────────────────────────────

const getAllLocations = (countryCode) => {
  let countryKey;
  if (typeof countryCode === 'string') {
    const lower = countryCode.toLowerCase();
    const codeToKey = { gh: 'ghana', ng: 'nigeria', ke: 'kenya', za: 'southafrica' };
    countryKey = codeToKey[lower] || lower;
  } else if (countryCode?.code) {
    const codeToKey = { gh: 'ghana', ng: 'nigeria', ke: 'kenya', za: 'southafrica' };
    countryKey = codeToKey[countryCode.code.toLowerCase()] || countryCode.code.toLowerCase();
  } else if (countryCode?.name) {
    countryKey = countryCode.name.toLowerCase();
  } else {
    countryKey = 'ghana';
  }
  const countryData = LOCATIONS[countryKey];
  if (!countryData) return [];
  if (countryData.cities) return countryData.cities;
  if (countryData.states) return countryData.states.flatMap((s) => s.cities || []);
  return [];
};

const findNearestCity = (latitude, longitude, countryCode) => {
  const locs = getAllLocations(countryCode);
  let nearest = null;
  let minDist = Infinity;
  locs.forEach((loc) => {
    const lat = loc.coordinates?.lat || loc.lat;
    const lng = loc.coordinates?.lng || loc.lng;
    if (lat && lng) {
      const d = calculateDistance(latitude, longitude, lat, lng);
      if (d < minDist) { minDist = d; nearest = loc; }
    }
  });
  return { location: nearest, distance: minDist };
};

// ─── hook ───────────────────────────────────────────────────

/**
 * useLocationBootstrap – detects user location via saved manual → profile → GPS → IP cascade.
 *
 * Returns:
 *  - userLocation          (object|null)
 *  - locationLoading       (boolean)
 *  - showLocationPicker    (boolean)
 *  - setShowLocationPicker (setter)
 *  - locationLabel         (string|null)  human-readable label
 *  - setManualLocation     (function)     call after LocationPicker selection
 *  - availableLocations    (array)        for LocationPicker
 */
const useLocationBootstrap = () => {
  const reduxUser      = useSelector(selectUser);
  const userCountry    = useSelector(selectUserCountry);
  const detectedCountry = useSelector(selectDetectedCountry);

  const [userLocation, setUserLocation]           = useState(null);
  const [locationLoading, setLocationLoading]       = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const countryKey = userCountry || detectedCountry || 'ghana';

  const availableLocations = useMemo(() => getAllLocations(countryKey), [countryKey]);

  // Human-readable label
  const locationLabel = useMemo(() => {
    if (!userLocation) return null;
    const city    = userLocation.city || userLocation.name;
    const region  = userLocation.region || userLocation.district || userLocation.state;
    const country = userLocation.country;
    const parts = [];
    if (country) parts.push(country);
    if (region)  parts.push(region);
    if (city)    parts.push(city);
    return parts.length > 0 ? parts.join(', ') : 'Location enabled';
  }, [userLocation]);

  // ── cascade effect ───────────────────────────────
  useEffect(() => {
    const buildProfileLocation = () => {
      const location = reduxUser?.profile_data?.location;
      if (!location) return null;
      const coords = location.coordinates || location.coords || {};
      const hasCoords = coords.lat != null && coords.lng != null && !isNaN(coords.lat) && !isNaN(coords.lng);
      return {
        lat: hasCoords ? parseFloat(coords.lat) : null,
        lng: hasCoords ? parseFloat(coords.lng) : null,
        city: location.city || location.name,
        country: location.country,
        countryCode: location.countryCode,
        source: 'profile',
        accuracy: hasCoords ? 'city' : 'country',
        confidence: hasCoords ? 0.9 : 0.7,
      };
    };

    const IP_CACHE_KEY = 'zerohook_ip_location';
    const IP_CACHE_TTL = 5 * 60 * 1000;

    const getIPLocation = async () => {
      try {
        const cached = sessionStorage.getItem(IP_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < IP_CACHE_TTL) { debugLog('📍 Using cached IP location'); return data; }
        }
        const token = localStorage.getItem('token');
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`${API_BASE_URL}/geolocation/ip-detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        clearTimeout(tid);
        if (res.ok) {
          const body = await res.json();
          const ip = body?.data;
          if (ip) {
            const loc = {
              lat: ip.lat ?? ip.latitude ?? null,
              lng: ip.lng ?? ip.longitude ?? null,
              city: ip.city, country: ip.country, countryCode: ip.countryCode, region: ip.region,
              source: ip.source || 'ip-proxy', confidence: ip.confidence ?? 'medium',
            };
            sessionStorage.setItem(IP_CACHE_KEY, JSON.stringify({ data: loc, timestamp: Date.now() }));
            return loc;
          }
        }
      } catch (e) {
        if (e.name !== 'AbortError') debugError('IP geolocation failed:', e);
      }
      return null;
    };

    const run = async () => {
      setLocationLoading(true);
      const timeout = setTimeout(() => setLocationLoading(false), 10000);

      // 1. Saved manual location
      const savedRaw = localStorage.getItem('userManualLocation');
      if (savedRaw) {
        try {
          const parsed = JSON.parse(savedRaw);
          setUserLocation({ ...parsed, source: 'manual' });
          setLocationLoading(false);
          clearTimeout(timeout);
          return;
        } catch { localStorage.removeItem('userManualLocation'); }
      }

      // 2. Profile-preferred location
      const profilePreferred = Boolean(reduxUser?.profile_data?.location?.preferProfileLocation);
      const profileLoc = buildProfileLocation();
      if (profilePreferred && profileLoc) {
        setUserLocation({ ...profileLoc, source: 'profile-preferred' });
        setLocationLoading(false);
        clearTimeout(timeout);
        return;
      }

      // 3. GPS (parallel with IP as backup)
      const ipPromise = getIPLocation();

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeout);
            const { latitude, longitude, accuracy } = pos.coords;
            const cfk = userCountry || detectedCountry || 'ghana';
            const { location: nearest, distance } = findNearestCity(latitude, longitude, cfk);
            const getCountryName = (c) => (!c ? 'Unknown' : typeof c === 'string' ? c : c.name || c.code || 'Unknown');
            setUserLocation({
              lat: latitude, lng: longitude, accuracy,
              city: nearest?.name || 'Current Location',
              region: nearest?.region || nearest?.state || null,
              country: getCountryName(userCountry || detectedCountry),
              source: 'gps', confidence: 1.0,
              distanceToCity: distance ? `${distance.toFixed(1)} km from ${nearest?.name}` : null,
            });
            setLocationLoading(false);
          },
          async () => {
            clearTimeout(timeout);
            if (profileLoc) { setUserLocation(profileLoc); setLocationLoading(false); return; }
            const ipLoc = await ipPromise;
            if (ipLoc) setUserLocation(ipLoc);
            setLocationLoading(false);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
        );
      } else {
        clearTimeout(timeout);
        if (profileLoc) { setUserLocation(profileLoc); setLocationLoading(false); return; }
        const ipLoc = await ipPromise;
        if (ipLoc) setUserLocation(ipLoc);
        setLocationLoading(false);
      }
    };

    run();
  }, [reduxUser, userCountry, detectedCountry]);

  // ── public setter for LocationPicker callbacks ───
  const setManualLocation = useCallback(
    async (location) => {
      const selectedCountry = location.country || userCountry || detectedCountry || 'Unknown';
      const locationData = {
        lat: location.lat, lng: location.lng,
        city: location.name,
        country: selectedCountry,
        district: location.district, region: location.region,
        method: location.method, precision: location.precision,
      };
      localStorage.setItem('userManualLocation', JSON.stringify(locationData));

      // Persist to backend
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/users/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ profile_data: { location: locationData } }),
          });
          if (res.ok) debugLog('✅ Location saved to profile');
        } catch (e) { debugError('Failed to save location to backend:', e); }
      }

      setUserLocation({
        lat: location.lat, lng: location.lng,
        city: location.name,
        country: selectedCountry,
        district: location.district, region: location.region,
        source: location.method, precision: location.precision,
      });
    },
    [userCountry, detectedCountry],
  );

  return {
    userLocation,
    locationLoading,
    showLocationPicker,
    setShowLocationPicker,
    locationLabel,
    setManualLocation,
    availableLocations,
    countryKey,
  };
};

export { getAllLocations, findNearestCity };
export default useLocationBootstrap;
