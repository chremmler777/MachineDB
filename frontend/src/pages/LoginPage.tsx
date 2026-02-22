import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from '../App';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('dashboard' as any);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md border border-gray-700">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="KTX Logo" className="h-16 mb-4" />
          <h1 className="text-3xl font-bold text-center text-white">MachineDB</h1>
        </div>
        <p className="text-gray-300 text-center mb-6">Injection Molding Machine Database</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 font-medium mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter username"
              disabled={loading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 font-medium mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password"
              disabled={loading}
            />
          </div>

          {error && <div className="mb-4 p-3 bg-red-900 text-red-200 rounded-lg text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-600"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-gray-700 rounded-lg border border-gray-600">
          <p className="text-xs text-gray-300 mb-2"><strong>Demo credentials:</strong></p>
          <p className="text-xs text-gray-400">Master: master / master123</p>
          <p className="text-xs text-gray-400">Viewer: viewer_usa / viewer123</p>
        </div>
      </div>
    </div>
  );
};
