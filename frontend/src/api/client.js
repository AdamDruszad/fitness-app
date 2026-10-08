/**
 * @file client.js
 * @description Centralized Axios HTTP client configuration for the FitAI frontend.
 * Automatically injects the JWT authentication Bearer token into outgoing requests
 * and redirects to the login page when encountering 401 Unauthorized responses.
 */

import axios from 'axios';
import { readToken } from './token';

// Instantiate Axios with dynamic API base URL from Vite environment variable or fallback to localhost
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
});

/**
 * Request Interceptor:
 * Extracts JWT token from localStorage (if present) and appends it to the Authorization header.
 */
client.interceptors.request.use(
  (config) => {
    const token = readToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor:
 * Automatically handles expired/invalid authentication sessions (HTTP 401).
 * Purges the invalid token and routes user back to the login screen.
 */
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.startsWith('/auth/')) {
      window.dispatchEvent(new Event('fitai:unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default client;
