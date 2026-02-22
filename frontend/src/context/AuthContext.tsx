import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

interface User {
  id: number;
  username: string;
  role: 'master' | 'viewer';
  plant?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authService.getMe()
        .then((res) => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    console.log('[Auth] Attempting login for:', username);
    try {
      const res = await authService.login(username, password);
      console.log('[Auth] Login successful, response:', res.data);
      localStorage.setItem('token', res.data.token);
      setUser(res.data.user);
      console.log('[Auth] Token saved and user set');
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      console.error('[Auth] Error response:', error.response?.data);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
