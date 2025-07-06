import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    username: '',
    role: ''
  });

  const login = ({ username, role }) => {
    setAuth({
      isAuthenticated: true,
      username,
      role
    });
  };

  const logout = () => {
    setAuth({
      isAuthenticated: false,
      username: '',
      role: ''
    });
  };

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
