import React, { useState } from 'react';
import {
  Box, Button, TextField, Typography, Paper
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5
  }
});

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    alert(`Logging in with Email: ${email}, Password: ${password}`);
    // TODO: Implement login logic and user role-based routing
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
        <Paper elevation={3} sx={{ padding: 4, width: 400, textAlign: 'center' }}>
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
