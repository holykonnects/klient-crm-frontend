import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { keyframes } from '@mui/system';

const spinClockwise = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const spinCounterClockwise = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(-360deg); }
`;

const LoadingOverlay = () => {
  return (
    <Box
      sx={{
        position: 'fixed',
        zIndex: 1300,
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ position: 'relative', width: 250, height: 250 }}>
        {/* Mandala Rings */}
        <Box
          component="img"
          src="/assets/Mandala -01.png"
          alt="Ring 1"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
            animation: `${spinClockwise} 10s linear infinite`
          }}
        />
        <Box
          component="img"
          src="/assets/Mandala -02.png"
          alt="Ring 2"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
            animation: `${spinCounterClockwise} 14s linear infinite`
          }}
        />
        <Box
          component="img"
          src="/assets/Mandala -03-03.png"
          alt="Ring 3"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
          }}
        />
        <Box
          component="img"
          src="/assets/Mandala -04.png"
          alt="Ring 4"
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
            animation: `${spinCounterClockwise} 24s linear infinite`
          }}
        />
      </Box>

      <Box mt={3}>
        <CircularProgress size={20} sx={{ color: '#6495ED' }} />
      </Box>
    </Box>
  );
};

export default LoadingOverlay;

