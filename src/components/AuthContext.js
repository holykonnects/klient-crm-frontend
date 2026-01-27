// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "shiftzUser";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Load from localStorage on mount (Rido style)
  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) setUser(JSON.parse(cached));
  }, []);

  const login = ({ loginUsername, email, role, pageAccess }) => {
    const userData = {
      loginUsername: loginUsername || email,
      email,
      role: role || "End User",
      pageAccess: Array.isArray(pageAccess)
        ? pageAccess
        : String(pageAccess || "")
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
    };

    setUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  function isAdmin() {
    return (user?.role || "").toLowerCase() === "admin";
  }

  function canAccess(page) {
    if (!user) return false;
    if (isAdmin()) return true;

    const wanted = String(page || "").trim();
    return (user.pageAccess || []).includes(wanted);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
}
