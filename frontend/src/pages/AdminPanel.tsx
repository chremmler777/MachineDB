import React, { useState } from 'react';
import { importService } from '../services/api';

export const AdminPanel: React.FC = () => {
  const [tab, setTab] = useState<'import' | 'users'>('import');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleImportFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    try {
      const res = await importService.uploadExcel(importFile);
      setMessage(`✓ ${res.data.message}`);
      setImportFile(null);
    } catch (error: any) {
      setMessage(`✗ Error: ${error.response?.data?.error || 'Upload failed'}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Admin Panel</h2>

      <div className="flex border-b mb-6">
        <button
          onClick={() => setTab('import')}
          className={`px-4 py-2 ${tab === 'import' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Import Data
        </button>
        <button
          onClick={() => setTab('users')}
          className={`px-4 py-2 ${tab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          User Management
        </button>
      </div>

      {tab === 'import' && (
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <h3 className="text-xl font-bold mb-4 text-gray-800">Import Machines from Excel</h3>

          <form onSubmit={handleImportFile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Excel File</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              <p className="text-xs text-gray-600 mt-1">Expected format: MachineDataBase.xlsx or MachineList_USA.xlsx</p>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm ${message.startsWith('✓') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={!importFile || importing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
            >
              {importing ? 'Importing...' : 'Import Machines'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> This will import machines from the Excel file. The file should have the standard machine specification columns.
              Duplicate internal names will be skipped.
            </p>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-800">User Management</h3>
          <p className="text-gray-600 mb-4">User management features coming soon. Currently, users are seeded in the database.</p>

          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="font-medium mb-2">Demo Users:</p>
            <ul className="text-sm space-y-1">
              <li>• <strong>master</strong> (password: master123) - Full access</li>
              <li>• <strong>viewer_usa</strong> (password: viewer123) - View only, USA plant</li>
              <li>• <strong>viewer_mexico</strong> (password: viewer123) - View only, Mexico plant</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
