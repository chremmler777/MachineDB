import React, { useEffect, useState } from 'react';
import { machineService } from '../services/api';

interface DashboardPageProps {
  darkMode?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ darkMode = false }) => {
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await machineService.list({ limit: 1000 });
      const machines = res.data.machines;

      const usaMachines = machines.filter((m: any) => m.plant_location === 'USA');
      const mexicoMachines = machines.filter((m: any) => m.plant_location === 'Mexico');

      setStats({
        total: machines.length,
        usa: usaMachines.length,
        mexico: mexicoMachines.length,
        manufacturers: [...new Set(machines.map((m: any) => m.manufacturer))].length,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const navigate = (page: string) => {
    window.location.hash = `#/${page}`;
    window.location.reload();
  };

  return (
    <div className={`p-6 max-w-6xl mx-auto ${darkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <h2 className={`text-3xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition`} onClick={() => navigate('machines?plant=')}>
          <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Machines</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{stats.total}</p>
        </div>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition`} onClick={() => navigate('machines?plant=USA')}>
          <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>USA Machines</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{stats.usa}</p>
        </div>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition`} onClick={() => navigate('machines?plant=Mexico')}>
          <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Mexico Machines</h3>
          <p className="text-3xl font-bold text-orange-600 mt-2">{stats.mexico}</p>
        </div>
        <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
          <h3 className={`text-sm font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Manufacturers</h3>
          <p className="text-3xl font-bold text-purple-600 mt-2">{stats.manufacturers}</p>
        </div>
      </div>

      <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
        <h3 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('machines')}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition"
          >
            View All Machines
          </button>
          <button
            onClick={() => navigate('finder')}
            className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition"
          >
            Machine Finder
          </button>
          <button
            onClick={() => navigate('admin')}
            className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
          >
            Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
};
