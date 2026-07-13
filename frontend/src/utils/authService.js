import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:5000';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState(() => {
    // Initialize tokens from localStorage if available
    const savedTokens = localStorage.getItem('auth_tokens');
    return savedTokens ? JSON.parse(savedTokens) : null;
  });

  // Set up axios interceptor for adding authorization headers
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Set up axios interceptor for handling 401 errors (expired tokens)
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If error is 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && tokens?.refreshToken && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Try to get a new access token
            const response = await axios.post('/api/auth/refresh', {
              refreshToken: tokens.refreshToken
            });
            
            // Update the tokens with the new access token
            const newTokens = {
              ...tokens,
              accessToken: response.data.accessToken
            };
            
            // Save the updated tokens
            setTokens(newTokens);
            localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
            
            // Retry the original request with the new token
            originalRequest.headers.Authorization = `Bearer ${response.data.accessToken}`;
            return axios(originalRequest);
          } catch (refreshError) {
            // If refresh fails, clear auth and prevent further retries
            console.error('Token refresh failed:', refreshError);
            clearAuth();
            return Promise.reject(refreshError);
          }
        }
        
        // If it's a 401 and we've already tried to refresh, or no refresh token
        if (error.response?.status === 401) {
          clearAuth();
        }
        
        return Promise.reject(error);
      }
    );
    
    // Clean up interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [tokens]);

  // Check auth status on initial load
  useEffect(() => {
    const validateSession = async () => {
      if (tokens) {
        try {
          const response = await axios.get('/api/users/me');
          setUser(response.data);
        } catch (error) {
          // If we can't get user info, clear auth
          if (error.response?.status === 401) {
            clearAuth();
          }
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    validateSession();
  }, [tokens]);

  // Save tokens to localStorage whenever they change
  useEffect(() => {
    if (tokens) {
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    } else {
      localStorage.removeItem('auth_tokens');
    }
  }, [tokens]);

  const setAuthTokens = (newTokens) => {
    setTokens(newTokens);
  };

  const setUserData = (userData) => {
    setUser(userData);
  };

  const clearAuth = () => {
    setTokens(null);
    setUser(null);
    setLoading(false); // Reset loading so ProtectedRoute can redirect
    localStorage.removeItem('auth_tokens');
  };

  const logout = async () => {
    try {
      if (tokens?.refreshToken) {
        // Invalidate the refresh token on the server
        await axios.post('/api/auth/logout', { refreshToken: tokens.refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
    }
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        tokens, 
        loading, 
        setAuthTokens, 
        setUserData, 
        clearAuth, 
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};