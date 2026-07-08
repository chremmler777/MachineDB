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

  // Sliding-session keepalive: renew the shared SSO cookie every 15 min
  // while this tab is visible or recently used. 401 = session over ->
  // hard-redirect to the AdminPanel hub (this app's existing pattern).
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
    let lastActivity = Date.now();
    const markActivity = () => { lastActivity = Date.now(); };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, markActivity, { passive: true }));

    const tick = async () => {
      const active = document.visibilityState === 'visible'
        || Date.now() - lastActivity < REFRESH_INTERVAL_MS;
      if (!active) return;
      try {
        const res = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });
        if (res.status === 401) window.location.href = '/';
      } catch { /* retry next tick */ }
    };

    const timer = setInterval(tick, REFRESH_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, markActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
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
