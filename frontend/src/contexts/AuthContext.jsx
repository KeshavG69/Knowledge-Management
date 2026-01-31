/**
 * Mock Authentication Context
 * Bypasses authentication for development
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get user IDs from environment variables
    const userId = import.meta.env.VITE_USER_ID || '507f1f77bcf86cd799439011';
    const organizationId = import.meta.env.VITE_ORGANIZATION_ID || '507f191e810c19729de860ea';

    // Mock user - bypass authentication
    setUser({
      sub: userId,
      userId: userId,
      organizationId: organizationId,
      email: 'dev@example.com',
      name: 'Development User'
    });
    setLoading(false);
  }, []);

  const logout = () => {
    setUser(null);
  };

  const getAccessToken = async () => {
    // No token needed for now
    return null;
  };

  const getUserId = () => {
    return user?.userId || import.meta.env.VITE_USER_ID || '507f1f77bcf86cd799439011';
  };

  const getOrganizationId = () => {
    return user?.organizationId || import.meta.env.VITE_ORGANIZATION_ID || '507f191e810c19729de860ea';
  };

  const value = {
    user,
    loading,
    logout,
    getAccessToken,
    getUserId,
    getOrganizationId
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
