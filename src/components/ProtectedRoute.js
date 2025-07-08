import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // adjust path

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth(); // ✅ corrected here
  return isAuthenticated ? children : <Navigate to="/" />;
};

export default ProtectedRoute;
