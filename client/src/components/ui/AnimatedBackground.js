import React from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';

// Floating blob animation
const blobFloat = keyframes`
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(30px, -30px) scale(1.05);
  }
  50% {
    transform: translate(50px, 20px) scale(0.95);
  }
  75% {
    transform: translate(-20px, 40px) scale(1.02);
  }
`;

const blobFloatReverse = keyframes`
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(-30px, 30px) scale(0.95);
  }
  50% {
    transform: translate(-50px, -20px) scale(1.05);
  }
  75% {
    transform: translate(20px, -40px) scale(0.98);
  }
`;

const AnimatedBackground = () => {
  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
        overflow: 'hidden',
      }}
    >
      {/* Cyan Blob - Top Left */}
      <Box
        sx={{
          position: 'absolute',
          width: { xs: '250px', md: '400px' },
          height: { xs: '250px', md: '400px' },
          borderRadius: '50%',
          background: '#00f2ea',
          filter: 'blur(80px)',
          opacity: 0.35,
          top: '-100px',
          left: '-100px',
          animation: `${blobFloat} 12s infinite ease-in-out`,
        }}
      />

      {/* Pink Blob - Bottom Right */}
      <Box
        sx={{
          position: 'absolute',
          width: { xs: '200px', md: '350px' },
          height: { xs: '200px', md: '350px' },
          borderRadius: '50%',
          background: '#ff0055',
          filter: 'blur(80px)',
          opacity: 0.35,
          bottom: '-80px',
          right: '-80px',
          animation: `${blobFloatReverse} 15s infinite ease-in-out`,
        }}
      />

      {/* Gradient Blob - Center */}
      <Box
        sx={{
          position: 'absolute',
          width: { xs: '180px', md: '280px' },
          height: { xs: '180px', md: '280px' },
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00f2ea 0%, #ff0055 100%)',
          filter: 'blur(100px)',
          opacity: 0.2,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: `${blobFloat} 18s infinite ease-in-out`,
        }}
      />

      {/* Extra subtle blob - Top Right */}
      <Box
        sx={{
          position: 'absolute',
          width: { xs: '150px', md: '200px' },
          height: { xs: '150px', md: '200px' },
          borderRadius: '50%',
          background: '#00f2ea',
          filter: 'blur(100px)',
          opacity: 0.15,
          top: '20%',
          right: '10%',
          animation: `${blobFloatReverse} 20s infinite ease-in-out`,
        }}
      />

      {/* Extra subtle blob - Bottom Left */}
      <Box
        sx={{
          position: 'absolute',
          width: { xs: '120px', md: '180px' },
          height: { xs: '120px', md: '180px' },
          borderRadius: '50%',
          background: '#ff0055',
          filter: 'blur(90px)',
          opacity: 0.15,
          bottom: '30%',
          left: '5%',
          animation: `${blobFloat} 22s infinite ease-in-out`,
        }}
      />
    </Box>
  );
};

export default AnimatedBackground;
