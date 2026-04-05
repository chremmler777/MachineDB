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

  const statCards = [
    { label: t('dashboard.totalMachines'), value: stats.total, color: '#3b82f6', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))', clickable: true },
    { label: t('dashboard.usaMachines'), value: stats.usa, color: '#22c55e', gradient: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))', clickable: true },
    { label: t('dashboard.mexicoMachines'), value: stats.mexico, color: '#f97316', gradient: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.05))', clickable: true },
    { label: t('dashboard.manufacturers'), value: stats.manufacturers, color: '#a855f7', gradient: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))', clickable: false },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className={`text-2xl font-semibold mb-6 ${textPrimary}`} style={{ letterSpacing: '-0.01em' }}>{t('dashboard.title')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        {statCards.map(({ label, value, color, gradient, clickable }) => (
          <div
            key={label}
            className={`rounded-xl shadow-sm transition-all duration-200 ${clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
            style={{
              background: darkMode ? gradient : '#ffffff',
              border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
              borderLeft: `4px solid ${color}`,
              padding: '20px 20px',
            }}
            onClick={clickable ? () => onNavigate('machines') : undefined}
          >
            <h3 className={`text-xs font-medium uppercase tracking-wider ${textSecondary}`} style={{ letterSpacing: '0.05em' }}>{label}</h3>
            <p className="text-4xl font-bold mt-3" style={{ color, letterSpacing: '-0.02em' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl shadow-sm" style={{
        background: darkMode ? 'linear-gradient(135deg, rgba(30,41,59,0.8), rgba(30,41,59,0.5))' : '#ffffff',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.06)' : '#e5e7eb'}`,
        padding: '24px',
      }}>
        <h3 className={`text-lg font-semibold mb-5 ${textPrimary}`}>{t('dashboard.quickActions')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('machines')}
            className="px-4 py-3.5 text-white rounded-lg font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}
          >
            {t('dashboard.viewAllMachines')}
          </button>
          <button
            onClick={() => onNavigate('finder')}
            className="px-4 py-3.5 text-white rounded-lg font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)' }}
          >
            {t('dashboard.machineFinder')}
          </button>
          {user?.role === 'master' && (
            <button
              onClick={() => onNavigate('admin')}
              className="px-4 py-3.5 text-white rounded-lg font-medium transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              {t('dashboard.adminPanel')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
