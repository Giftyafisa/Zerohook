import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, useTheme } from '@mui/material';
import { useVirtualScroll } from '../utils/performance';

const VirtualizedList = ({
  items = [],
  itemHeight = 200,
  containerHeight = 600,
  renderItem,
  overscan = 5,
  onScroll,
  className,
  sx = {}
}) => {
  const theme = useTheme();
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef(null);
  
  const { totalHeight, getVisibleItems } = useVirtualScroll(
    items,
    itemHeight,
    containerHeight
  );

  const visibleItems = useMemo(() => {
    return getVisibleItems(scrollTop);
  }, [getVisibleItems, scrollTop]);

  const handleScroll = (event) => {
    const newScrollTop = event.target.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  };

  return (
    <Box
      ref={scrollElementRef}
      className={className}
      sx={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
        ...sx
      }}
      onScroll={handleScroll}
    >
      {/* Total height container */}
      <Box
        sx={{
          height: totalHeight,
          position: 'relative'
        }}
      >
        {/* Visible items */}
        {visibleItems.map((item) => (
          <Box
            key={item.id || item.index}
            sx={{
              position: 'absolute',
              top: item.top,
              left: 0,
              right: 0,
              height: itemHeight,
              padding: 1
            }}
          >
            {renderItem(item, item.index)}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// Higher-order component for virtualized profile cards
export const VirtualizedProfileList = ({ profiles, ...props }) => {
  const renderProfileCard = (profile, index) => {
    // This would render your actual profile card component
    return (
      <Box
        sx={{
          height: '100%',
          border: 1,
          borderColor: 'grey.300',
          borderRadius: 1,
          p: 2,
          backgroundColor: 'white'
        }}
      >
        <Box sx={{ fontWeight: 'bold' }}>{profile.username}</Box>
        <Box sx={{ color: 'text.secondary' }}>{profile.profileData?.bio}</Box>
        {/* Add more profile card content here */}
      </Box>
    );
  };

  return (
    <VirtualizedList
      items={profiles}
      itemHeight={200}
      renderItem={renderProfileCard}
      {...props}
    />
  );
};

// Higher-order component for virtualized service cards
export const VirtualizedServiceList = ({ services, ...props }) => {
  const renderServiceCard = (service, index) => {
    return (
      <Box
        sx={{
          height: '100%',
          border: 1,
          borderColor: 'grey.300',
          borderRadius: 1,
          p: 2,
          backgroundColor: 'white'
        }}
      >
        <Box sx={{ fontWeight: 'bold' }}>{service.title}</Box>
        <Box sx={{ color: 'text.secondary' }}>{service.description}</Box>
        <Box sx={{ color: 'primary.main', fontWeight: 'bold' }}>
          ${service.price}
        </Box>
        {/* Add more service card content here */}
      </Box>
    );
  };

  return (
    <VirtualizedList
      items={services}
      itemHeight={180}
      renderItem={renderServiceCard}
      {...props}
    />
  );
};

export default VirtualizedList;

