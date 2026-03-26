import React, { useEffect, useState } from 'react';
import { machineService } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  darkMode?: boolean;
  onNavigate: (page: string, params?: any) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ darkMode = false, onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await machineService.list({ limit: 1000 });
      const machines = res.data.machines;
      setStats({
        total: machines.length,
        usa: machines.filter((m: any) => m.plant_location === 'USA').length,
        mexico: machines.filter((m: any) => m.plant_location === 'Mexico').length,
        manufacturers: [...new Set(machines.map((m: any) => m.manufacturer))].length,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const textPrimary = darkMode ? 'text-white' : 'text-gray-800';
  const textSecondary = darkMode ? 'text-gray-400' : 'text-gray-600';

  if (loading) {
    return <div className={`p-6 ${textPrimary}`}>{t('dashboard.loading')}</div>;
  }

  return (
    <div className={`p-6 max-w-6xl mx-auto`}>
      <h2 className={`text-3xl font-bold mb-6 ${textPrimary}`}>{t('dashboard.title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className={`${cardBg} p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition`}
          onClick={() => onNavigate('machines')}>
          <h3 className={`text-sm font-medium ${textSecondary}`}>{t('dashboard.totalMachines')}</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.total}</p>
        </div>
        <div className={`${cardBg} p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition`}
          onClick={() => onNavigate('machines')}>
          <h3 className={`text-sm font-medium ${textSecondary}`}>{t('dashboard.usaMachines')}</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.usa}</p>
        </div>
        <div className={`${cardBg} p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition`}
          onClick={() => onNavigate('machines')}>
          <h3 className={`text-sm font-medium ${textSecondary}`}>{t('dashboard.mexicoMachines')}</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.mexico}</p>
        </div>
        <div className={`${cardBg} p-6 rounded-lg shadow`}>
          <h3 className={`text-sm font-medium ${textSecondary}`}>{t('dashboard.manufacturers')}</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{stats.manufacturers}</p>
        </div>
      </div>

      <div className={`${cardBg} p-6 rounded-lg shadow`}>
        <h3 className={`text-xl font-bold mb-4 ${textPrimary}`}>{t('dashboard.quickActions')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('machines')}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
          >
            {t('dashboard.viewAllMachines')}
          </button>
          <button
            onClick={() => onNavigate('finder')}
            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition"
          >
            {t('dashboard.machineFinder')}
          </button>
          {user?.role === 'master' && (
            <button
              onClick={() => onNavigate('admin')}
              className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
            >
              {t('dashboard.adminPanel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
