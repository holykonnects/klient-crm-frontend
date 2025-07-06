import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // adjust path

const ProtectedRoute = ({ children }) => {
  const { authenticated } = useAuth();
  return authenticated ? children : <Navigate to="/" />;
};

export default ProtectedRoute;
