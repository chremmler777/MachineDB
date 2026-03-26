import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

interface User {
  userId: number;
  username: string;
  role: 'master' | 'viewer';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check SSO authentication on mount
    authService
      .getMe()
      .then((res) => {
        setUser({
          userId: res.data.userId,
          username: res.data.username,
          role: res.data.role,
        });
      })
      .catch(() => {
        // Not authenticated - redirect to admin panel
        window.location.href = '/';
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    // Redirect to admin panel logout
    window.location.href = '/api/v1/auth/logout';
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
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
