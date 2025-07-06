// LoginPage.js
import React, { useState } from 'react';
import {
  Box, Typography, TextField, Button, Paper
} from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10
  }
});

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    // Placeholder auth logic (replace with actual API or sheet validation)
    if (username && password) {
      onLogin(username);
    } else {
      setError('Please enter both username and password.');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Paper elevation={3} sx={{ padding: 4, width: 360 }}>
          <Typography variant="h6" textAlign="center" fontWeight="bold" mb={2}>
            Klient Konnect Login
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField
              label="Username"
              fullWidth
              size="small"
              margin="normal"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
              label="Password"
              fullWidth
              size="small"
              margin="normal"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <Typography color="error" fontSize={11}>{error}</Typography>}
            <Button
              fullWidth
              variant="contained"
              sx={{ backgroundColor: '#6495ED', mt: 2 }}
              type="submit"
            >
              Login
            </Button>
          </form>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}

export default LoginPage;
