import React, { useState } from 'react';
import {
  Box, Button, CircularProgress, TextField, Typography, Paper
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // adjust path accordingly

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
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });


      const result = await res.json();
      if (res.ok && result.success) {
        login({ username: result.username, email: result.email || email, role: result.role, pageAccess: result.pageAccess });
        navigate('/dashboard');
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to login. Please try again.');
    } finally {
      setSubmitting(false);
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
            className="crm-primary-logo"
            src="/assets/rido-sports-logo.png"
            alt="Rido Sports"
            style={{ margin: '0 auto 20px' }}
          />
          <Typography variant="h5" fontWeight="bold" marginBottom={3}>
            Login to Rido Sports
          </Typography>
          <Box component="form" onSubmit={handleLogin}>
            <TextField
              fullWidth
              label="Email"
              variant="outlined"
              margin="normal"
              size="small"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={submitting}
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
              autoComplete="current-password"
              disabled={submitting}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting || !email.trim() || !password}
              sx={{ backgroundColor: '#6495ED', marginTop: 2 }}
            >
              {submitting ? <><CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />Signing in...</> : 'Login to Rido Sports'}
            </Button>
          </Box>
          {error && (
            <Typography color="error" variant="body2" sx={{ marginTop: 1 }}>
              {error}
            </Typography>
          )}
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e7edf5' }}>
            <Typography sx={{ mb: 0.75, fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Empowered by
            </Typography>
            <img
              src="/assets/kk-logo.png"
              alt="Klient Konnect"
              style={{ width: 64, height: 'auto', maxHeight: 44, objectFit: 'contain' }}
            />
          </Box>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default LoginPage;
