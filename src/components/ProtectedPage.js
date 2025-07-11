import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedPage = ({ pageKey, children }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;

  const hasAccess = user.pageAccess?.includes(pageKey);

  if (!hasAccess) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

export default ProtectedPage;
