import React, { useState } from 'react';
import {
  Box, Button, TextField, Typography, Paper
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext'; // adjust path accordingly

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5
  }
});

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await fetch('https://klient-crm-frontend.vercel.app/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });


      const result = await res.json();
      console.log('Login result:', result);

      if (result.success) {
        login({ username: result.username, role: result.role });
        navigate('/dashboard');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to login. Please try again.');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{ backgroundColor: '#f7faff' }}
      >
        <Paper elevation={3} sx={{ padding: 4, width: 300, textAlign: 'center' }}>
          <img
            src="/assets/kk-logo.png"
            alt="Klient Konnect"
            style={{ height: 100, marginBottom: 20 }}
          />
          <Typography variant="h5" fontWeight="bold" marginBottom={3}>
            Login to Klient Konnect
          </Typography>
          <TextField
            fullWidth
            label="Email"
            variant="outlined"
            margin="normal"
            size="small"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            margin="normal"
            size="small"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            variant="contained"
            fullWidth
            sx={{ backgroundColor: '#6495ED', marginTop: 2 }}
            onClick={handleLogin}
          >
            Login
          </Button>
          {error && (
            <Typography color="error" variant="body2" sx={{ marginTop: 1 }}>
              {error}
            </Typography>
          )}
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default LoginPage;
