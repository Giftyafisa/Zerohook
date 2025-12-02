/**
 * FilterTabs - Horizontal scrollable filter tabs
 * Clean, simple filtering like the mobile app
 * Zerohook Platform
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/system';

const TabsContainer = styled(Box)({
  display: 'flex',
  gap: '10px',
  padding: '12px 20px',
  overflowX: 'auto',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  
  '&::-webkit-scrollbar': {
    display: 'none',
  },
  
  // Optional gradient fade at edges
  maskImage: 'linear-gradient(90deg, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)',
  WebkitMaskImage: 'linear-gradient(90deg, transparent 0px, black 20px, black calc(100% - 20px), transparent 100%)',
});

const FilterTab = styled(Box)(({ active }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 20px',
  borderRadius: '20px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  whiteSpace: 'nowrap',
  flexShrink: 0,
  
  background: active 
    ? 'linear-gradient(135deg, #00f2ea, #00c2bb)' 
    : 'rgba(255, 255, 255, 0.05)',
  border: active 
    ? '1px solid transparent' 
    : '1px solid rgba(255, 255, 255, 0.1)',
  
  '& .tab-label': {
    color: active ? '#0f0f13' : 'rgba(255, 255, 255, 0.7)',
    fontWeight: active ? 600 : 500,
    fontSize: '14px',
    fontFamily: '"Outfit", sans-serif',
    transition: 'all 0.3s ease',
  },
  
  '& .tab-icon': {
    marginRight: '8px',
    fontSize: '16px',
  },
  
  '&:hover': {
    background: active 
      ? 'linear-gradient(135deg, #00f2ea, #00c2bb)' 
      : 'rgba(255, 255, 255, 0.08)',
    borderColor: active ? 'transparent' : 'rgba(255, 255, 255, 0.15)',
  },
  
  '&:active': {
    transform: 'scale(0.97)',
  },
}));

const FilterTabs = ({ 
  filters = [], 
  activeFilter = 'all', 
  onFilterChange,
  showIcons = false 
}) => {
  const defaultFilters = [
    { id: 'all', label: 'All', icon: '🌐' },
    { id: 'nearby', label: 'Nearby', icon: '📍' },
    { id: 'verified', label: 'Verified', icon: '✓' },
    { id: 'online', label: 'Online', icon: '🟢' },
    { id: 'premium', label: 'Premium', icon: '⭐' },
  ];
  
  const filterList = filters.length > 0 ? filters : defaultFilters;
  
  return (
    <TabsContainer>
      {filterList.map((filter) => (
        <FilterTab
          key={filter.id}
          active={activeFilter === filter.id}
          onClick={() => onFilterChange && onFilterChange(filter.id)}
        >
          {showIcons && filter.icon && (
            <span className="tab-icon">{filter.icon}</span>
          )}
          <Typography className="tab-label">{filter.label}</Typography>
        </FilterTab>
      ))}
    </TabsContainer>
  );
};

export default FilterTabs;
