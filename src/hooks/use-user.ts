'use client';

import { useEffect, useState } from 'react';

interface UseUserReturn {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  logout: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if we have the auth cookie by making a request
    // If middleware didn't redirect us, we're authenticated
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return {
    isAuthenticated,
    isAdmin: true, // With simple password auth, everyone is admin
    isLoading,
    logout,
  };
}
