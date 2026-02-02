/**
 * Authentication Service
 * Handles all auth-related API calls
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

export const authService = {
  /**
   * Sign up a new user
   */
  async signup(userData) {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Signup failed');
    }

    return response.json();
  },

  /**
   * Login user
   */
  async login(email, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await response.json();

    // Store token in localStorage
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }

    return data;
  },

  /**
   * Get current user info
   */
  async getCurrentUser() {
    const token = localStorage.getItem('access_token');

    if (!token) {
      throw new Error('No access token found');
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      // Token might be expired or invalid
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        throw new Error('Session expired. Please login again.');
      }
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch user info');
    }

    return response.json();
  },

  /**
   * Logout user
   */
  logout() {
    localStorage.removeItem('access_token');
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!localStorage.getItem('access_token');
  },

  /**
   * Get access token
   */
  getAccessToken() {
    return localStorage.getItem('access_token');
  },
};
