// components/UserMenu.js
import React from 'react';
import { useAuth } from '../AuthContext';
import LogoutIcon from '@mui/icons-material/Logout';
import LoginIcon from '@mui/icons-material/Login';
import { IconButton, Tooltip } from '@mui/material';


export default function UserMenu() {
  const { user, logout } = useAuth();

  const handleClick = () => {
    if (user) {
      logout();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <Tooltip title={user ? "Logout" : "Login"}>
      <IconButton onClick={handleClick} sx={{ color: '#2f80ed' }}>
        {user ? <LogoutIcon /> : <LoginIcon />}
      </IconButton>
    </Tooltip>
  );
}

