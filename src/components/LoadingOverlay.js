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
        <img
          src="/assets/Mandala -01.png"
          alt="Ring 1"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
            animation: `${spinClockwise} 10s linear infinite`
          }}
        />
        <img
          src="/assets/Mandala -02.png"
          alt="Ring 2"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
            animation: `${spinCounterClockwise} 14s linear infinite`
          }}
        />
        <img
          src="/assets/Mandala -03.png"
          alt="Ring 3"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
            animation: `${spinClockwise} 18s linear infinite`
          }}
        />
        <img
          src="/assets/Mandala -04.png"
          alt="Ring 4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 250,
            height: 250,
            animation: `${spinCounterClockwise} 24s linear infinite`
          }}
        />

        {/* Central Klient Konnect Logo */}
        <img
          src="/assets/kk-logo.png"
          alt="Klient Konnect"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 50,
            height: 48,
            transform: 'translate(-50%, -50%)',
            zIndex: 5
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
