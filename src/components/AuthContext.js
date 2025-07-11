import React, { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Load from localStorage on mount
  useEffect(() => {
    const cached = localStorage.getItem('crmUser');
    if (cached) {
      setUser(JSON.parse(cached));
    }
  }, []);

  const login = ({ username, role, pageAccess }) => {
    const userData = {
      username,
      role,
      pageAccess: pageAccess?.split(',').map(p => p.trim()) || []  // Normalize access list
    };
    setUser(userData);
    localStorage.setItem('crmUser', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('crmUser');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
