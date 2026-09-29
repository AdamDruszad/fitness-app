/**
 * @file useAuth.js
 * @description Custom React hook managing user authentication state, session validation,
 * and user logout operations.
 */

import { useState, useEffect } from 'react';
import client from '../api/client';

/**
 * useAuth hook
 * 
 * Fetches the authenticated user profile from /users/me on component mount.
 * Provides loading status while the session check is in flight.
 * 
 * @returns {{
 *   user: Object|null,
 *   loading: boolean,
 *   logout: () => void
 * }}
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Verify token validity by requesting profile
    client.get('/users/me')
      .then((response) => setUser(response.data))
      .catch(() => {
        // If profile fetch fails, purge bad token
        localStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * Clears the user token from local storage and redirects to login page.
   */
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, logout };
}