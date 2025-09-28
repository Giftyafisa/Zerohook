import React, { useState, useRef, useEffect } from 'react';
import { Box, Skeleton, useTheme } from '@mui/material';
import { optimizeImageUrl } from '../utils/performance';

const OptimizedImage = ({
  src,
  alt = '',
  width = 300,
  height = 200,
  quality = 80,
  lazy = true,
  placeholder = true,
  borderRadius = 1,
  objectFit = 'cover',
  sx = {},
  onLoad,
  onError,
  ...props
}) => {
  const theme = useTheme();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef(null);
  const observerRef = useRef(null);

  // Optimize image URL
  const optimizedSrc = optimizeImageUrl(src, width, height, quality);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || !imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy]);

  // Image load handlers
  const handleLoad = () => {
    setIsLoaded(true);
    setIsError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsError(true);
    setIsLoaded(false);
    onError?.();
  };

  // Generate placeholder
  const placeholderSvg = `data:image/svg+xml;base64,${btoa(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f5f5f5"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-family="Arial, sans-serif" font-size="14">
        Loading...
      </text>
    </svg>
  `)}`;

  return (
    <Box
      ref={imgRef}
      sx={{
        position: 'relative',
        width: width,
        height: height,
        borderRadius: borderRadius,
        overflow: 'hidden',
        backgroundColor: theme.palette.grey[100],
        ...sx
      }}
      {...props}
    >
      {/* Placeholder/Skeleton */}
      {placeholder && !isLoaded && !isError && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          animation="wave"
        />
      )}

      {/* Error State */}
      {isError && (
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.palette.grey[200],
            color: theme.palette.grey[500],
            fontSize: '0.875rem'
          }}
        >
          Image unavailable
        </Box>
      )}

      {/* Actual Image */}
      {isInView && !isError && (
        <img
          src={optimizedSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: objectFit,
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in-out',
            display: isLoaded ? 'block' : 'none'
          }}
        />
      )}

      {/* Loading Overlay */}
      {isInView && !isLoaded && !isError && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            zIndex: 1
          }}
        >
          <Box
            sx={{
              width: 20,
              height: 20,
              border: `2px solid ${theme.palette.primary.main}`,
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              '@keyframes spin': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' }
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default OptimizedImage;

