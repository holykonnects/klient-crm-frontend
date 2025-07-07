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
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async () => {
    const res = await fetch('https://script.google.com/macros/s/AKfycbxZLaEeuh7VldIjnlPQEE9_xw4x02nbB0-NzDhNPwIhDp4idp-Bbwu5tfyCIHK3aQ8yvA/exec', {
      //https://script.google.com/macros/s/AKfycbxZLaEeuh7VldIjnlPQEE9_xw4x02nbB0-NzDhNPwIhDp4idp-Bbwu5tfyCIHK3aQ8yvA/exec
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await res.json();
    if (result.success) {
      login({ username: result.username, role: result.role }); // update context
      navigate('/dashboard');
    } else {
      setError('Invalid email or password');
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
        <Paper elevation={3} sx={{ padding: 4, width: 250, textAlign: 'center' }}>
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
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default LoginPage;
