import React, { useState } from 'react';
import { machineService } from '../services/api';

interface MachineFinderProps {
  onNavigate: (page: string, params?: any) => void;
}

export const MachineFinder: React.FC<MachineFinderProps> = ({ onNavigate }) => {
  const [requirements, setRequirements] = useState({
    clamping_force_kn: 0,
    mold_width: 0,
    mold_height: 0,
    shot_weight_g: 0,
    core_pulls_nozzle: 0,
    centering_ring_nozzle_mm: 0,
  });
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await machineService.finder(requirements);
      setResults(res.data);
      setSearched(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSuitabilityColor = (suitability: string) => {
    switch (suitability) {
      case 'full':
        return 'bg-green-100 border-green-500 text-green-900';
      case 'near':
        return 'bg-yellow-100 border-yellow-500 text-yellow-900';
      default:
        return 'bg-red-100 border-red-500 text-red-900';
    }
  };

  const getSuitabilityLabel = (suitability: string) => {
    switch (suitability) {
      case 'full':
        return '✓ Full Match';
      case 'near':
        return '⚠ Near Match';
      default:
        return '✗ Not Suitable';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-6 text-gray-800">Machine Finder</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-24">
            <h3 className="text-xl font-bold mb-4 text-gray-800">Tool Requirements</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clamping Force (kN)</label>
                <input
                  type="number"
                  value={requirements.clamping_force_kn}
                  onChange={(e) => setRequirements({ ...requirements, clamping_force_kn: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mold Width (mm)</label>
                <input
                  type="number"
                  value={requirements.mold_width}
                  onChange={(e) => setRequirements({ ...requirements, mold_width: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mold Height (mm)</label>
                <input
                  type="number"
                  value={requirements.mold_height}
                  onChange={(e) => setRequirements({ ...requirements, mold_height: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Shot Weight (g)</label>
                <input
                  type="number"
                  value={requirements.shot_weight_g}
                  onChange={(e) => setRequirements({ ...requirements, shot_weight_g: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Core Pulls (Nozzle)</label>
                <input
                  type="number"
                  value={requirements.core_pulls_nozzle}
                  onChange={(e) => setRequirements({ ...requirements, core_pulls_nozzle: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Centering Ring Nozzle (mm)</label>
                <input
                  type="number"
                  value={requirements.centering_ring_nozzle_mm}
                  onChange={(e) => setRequirements({ ...requirements, centering_ring_nozzle_mm: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {!searched ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              <p className="mb-4">Enter tool requirements and click Search to find suitable machines</p>
              <p className="text-sm">Results will be ranked by suitability: Full Match (Green) → Near Match (Yellow) → Not Suitable (Red)</p>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-gray-600">Searching machines...</div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">No machines found matching your criteria</div>
          ) : (
            <div className="space-y-4">
              {results.map((machine) => (
                <div
                  key={machine.id}
                  className={`border-l-4 rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition ${getSuitabilityColor(machine.suitability)}`}
                  onClick={() => onNavigate('machine', machine.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-lg">{machine.internal_name}</p>
                      <p className="text-sm opacity-75">{machine.manufacturer} {machine.model}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{getSuitabilityLabel(machine.suitability)}</p>
                      <p className="text-sm opacity-75">Score: {machine.matchScore.toFixed(0)}%</p>
                    </div>
                  </div>

                  {machine.gaps.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-current border-opacity-20">
                      <p className="text-xs font-semibold opacity-75 mb-2">What needs upgrading:</p>
                      <ul className="text-sm space-y-1">
                        {machine.gaps.slice(0, 3).map((gap: string, idx: number) => (
                          <li key={idx}>• {gap}</li>
                        ))}
                        {machine.gaps.length > 3 && <li>• ... and {machine.gaps.length - 3} more</li>}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs opacity-50 mt-3">Plant: {machine.plant_location} | Year: {machine.year_of_construction}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
