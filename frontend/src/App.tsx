import React, { useState, ReactNode } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MachineListPage } from './pages/MachineListPage';
import { MachineDetailPage } from './pages/MachineDetailPage';
import { MachineFinder } from './pages/MachineFinder';
import { AdminPanel } from './pages/AdminPanel';

// Simple routing context
type CurrentPage = 'login' | 'dashboard' | 'machines' | 'machine' | 'finder' | 'admin';
interface RouteState {
  page: CurrentPage;
  params?: any;
}

let currentRoute: RouteState = { page: 'login' };

export const useNavigate = () => {
  const [, setUpdate] = useState({});

  return (page: CurrentPage, params?: any) => {
    currentRoute = { page, params };
    setUpdate({});
  };
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [route, setRoute] = useState<RouteState>(currentRoute);
  const [update, setUpdate] = useState({});
  const [darkMode, setDarkMode] = useState(true);

  const navigate = (page: string | CurrentPage, params?: any) => {
    currentRoute = { page: page as CurrentPage, params };
    setRoute({ page: page as CurrentPage, params });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-700">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black'}`}>
      <nav className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80" onClick={() => navigate('dashboard')}>
            <img src="/logo.png" alt="KTX Logo" className="h-10" />
            <h1 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              MachineDB
            </h1>
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={() => navigate('dashboard')}
              className={`px-3 py-2 rounded ${route.page === 'dashboard' ? 'bg-blue-600 text-white' : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              {t('nav.dashboard')}
            </button>
            <button
              onClick={() => navigate('machines')}
              className={`px-3 py-2 rounded ${route.page === 'machines' ? 'bg-blue-600 text-white' : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              {t('nav.machines')}
            </button>
            <button
              onClick={() => navigate('finder')}
              className={`px-3 py-2 rounded ${route.page === 'finder' ? 'bg-blue-600 text-white' : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              {t('nav.finder')}
            </button>
            {user.role === 'master' && (
              <button
                onClick={() => navigate('admin')}
                className={`px-3 py-2 rounded ${route.page === 'admin' ? 'bg-blue-600 text-white' : darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                {t('nav.admin')}
              </button>
            )}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`px-3 py-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
              title="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as 'en' | 'es' | 'de')}
              className={`px-3 py-2 rounded text-sm font-medium border ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-800'}`}
              title="Select language"
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="de">Deutsch</option>
            </select>
            <div className={`border-l ${darkMode ? 'border-gray-700 pl-4' : 'border-gray-300 pl-4'}`}>
              <span className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{user.username}</span>
            </div>
          </div>
        </div>
      </nav>

      {route.page === 'dashboard' && <DashboardPage darkMode={darkMode} />}
      {route.page === 'machines' && <MachineListPage onNavigate={navigate} darkMode={darkMode} />}
      {route.page === 'machine' && <MachineDetailPage machineId={route.params} onNavigate={navigate} />}
      {route.page === 'finder' && <MachineFinder onNavigate={navigate} />}
      {route.page === 'admin' && user.role === 'master' && <AdminPanel />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AuthProvider>
  );
};

export default App;
