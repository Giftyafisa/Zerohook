// Performance optimization utilities
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Debounce hook for search inputs
export const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

// Memoized image loading with lazy loading
export const useLazyImage = (src, placeholder = '/api/placeholder/300/200') => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      setIsError(true);
    };
    img.src = src;
  }, [src]);
  
  return { imageSrc, isLoaded, isError };
};

// Virtual scrolling hook for large lists
export const useVirtualScroll = (items, itemHeight, containerHeight) => {
  return useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
    const totalHeight = items.length * itemHeight;
    
    return {
      totalHeight,
      visibleCount,
      getVisibleItems: (scrollTop) => {
        const startIndex = Math.floor(scrollTop / itemHeight);
        const endIndex = Math.min(startIndex + visibleCount, items.length);
        return items.slice(startIndex, endIndex).map((item, index) => ({
          ...item,
          index: startIndex + index,
          top: (startIndex + index) * itemHeight
        }));
      }
    };
  }, [items, itemHeight, containerHeight]);
};

// Performance monitoring
export const performanceMonitor = {
  start: (label) => {
    if (process.env.NODE_ENV === 'development') {
      performance.mark(`${label}-start`);
    }
  },
  
  end: (label) => {
    if (process.env.NODE_ENV === 'development') {
      performance.mark(`${label}-end`);
      performance.measure(label, `${label}-start`, `${label}-end`);
      const measure = performance.getEntriesByName(label)[0];
      console.log(`⏱️ ${label}: ${measure.duration.toFixed(2)}ms`);
    }
  },
  
  measureAsync: async (label, asyncFn) => {
    performanceMonitor.start(label);
    try {
      const result = await asyncFn();
      performanceMonitor.end(label);
      return result;
    } catch (error) {
      performanceMonitor.end(label);
      throw error;
    }
  }
};

// Memory optimization for large datasets
export const useDataPagination = (data, pageSize = 20) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, currentPage, pageSize]);
  
  const totalPages = Math.ceil(data.length / pageSize);
  
  return {
    paginatedData,
    currentPage,
    totalPages,
    setCurrentPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
};

// Image optimization utilities
export const optimizeImageUrl = (url, width = 300, height = 200, quality = 80) => {
  if (!url) return '/api/placeholder/300/200';
  
  // For external URLs, use a proxy service
  if (url.startsWith('http')) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}&w=${width}&h=${height}&q=${quality}`;
  }
  
  return url;
};

// Bundle size optimization - lazy load components
export const lazyLoadComponent = (importFn) => {
  return React.lazy(() => importFn().catch(() => ({
    default: () => <div>Failed to load component</div>
  })));
};

export default {
  useDebounce,
  useLazyImage,
  useVirtualScroll,
  performanceMonitor,
  useDataPagination,
  optimizeImageUrl,
  lazyLoadComponent
};
