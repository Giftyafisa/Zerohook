import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LocationOn,
  Verified,
  Star,
  Whatshot,
  AccessTime,
} from '@mui/icons-material';
import React from 'react';

/**
 * useFeedFilters – manages filter chips + search query state for ProfileFeed.
 * Keeps URL search param in sync with local state.
 */
const useFeedFilters = () => {
  const [searchParams] = useSearchParams();
  const initialSearchQuery = searchParams.get('search') || '';

  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);

  const filterOptions = useMemo(
    () => [
      { id: 'all',      label: 'For You',    icon: <Whatshot sx={{ fontSize: 18 }} /> },
      { id: 'nearby',   label: 'Nearby',     icon: <LocationOn sx={{ fontSize: 18 }} /> },
      { id: 'online',   label: 'Online',     icon: <AccessTime sx={{ fontSize: 18 }} /> },
      { id: 'verified', label: 'Verified',   icon: <Verified sx={{ fontSize: 18 }} /> },
      { id: 'trending', label: 'Top Rated',  icon: <Star sx={{ fontSize: 18 }} /> },
    ],
    [],
  );

  const handleFilterChange = useCallback((filterId) => {
    setActiveFilter(filterId);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setActiveFilter('all');
  }, []);

  return {
    activeFilter,
    searchQuery,
    filterOptions,
    handleFilterChange,
    handleSearchChange,
    resetFilters,
  };
};

export default useFeedFilters;
