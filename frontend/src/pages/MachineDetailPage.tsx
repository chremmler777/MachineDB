import React, { useEffect, useState } from 'react';
import { machineService, fileService } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface MachineDetailPageProps {
  machineId: number;
  onNavigate: (page: string, params?: any) => void;
}

export const MachineDetailPage: React.FC<MachineDetailPageProps> = ({ machineId, onNavigate }) => {
  const [machine, setMachine] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [tab, setTab] = useState<'specs' | 'files' | 'revisions'>('specs');
  const [loading, setLoading] = useState(true);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, [machineId]);

  const loadData = async () => {
    try {
      const [machineRes, filesRes, revisionsRes] = await Promise.all([
        machineService.get(machineId),
        fileService.list(machineId),
        machineService.getRevisions(machineId),
      ]);
      setMachine(machineRes.data);
      setFiles(filesRes.data);
      setRevisions(revisionsRes.data);
    } catch (error) {
      console.error('Failed to load machine:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      await fileService.upload(machineId, uploadFile, 'document', 'Uploaded document');
      setUploadFile(null);
      await loadData();
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const handleFileDownload = async (fileId: number, fileName: string) => {
    try {
      const res = await fileService.download(fileId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!machine) {
    return <div className="p-6">Machine not found</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">{machine.internal_name}</h2>
        <button
          onClick={() => onNavigate('machines')}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          Back
        </button>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-600 text-sm">Manufacturer</p>
            <p className="font-medium">{machine.manufacturer}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Model</p>
            <p className="font-medium">{machine.model}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Year</p>
            <p className="font-medium">{machine.year_of_construction}</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Plant</p>
            <p className="font-medium">{machine.plant_location}</p>
          </div>
        </div>
      </div>

      <div className="flex border-b mb-6">
        <button
          onClick={() => setTab('specs')}
          className={`px-4 py-2 ${tab === 'specs' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Specifications
        </button>
        <button
          onClick={() => setTab('files')}
          className={`px-4 py-2 ${tab === 'files' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          Files ({files.length})
        </button>
        <button
          onClick={() => setTab('revisions')}
          className={`px-4 py-2 ${tab === 'revisions' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
        >
          History ({revisions.length})
        </button>
      </div>

      {tab === 'specs' && (
        <div className="bg-white rounded-lg shadow p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-800">Dimensions</h3>
            <table className="text-sm w-full">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Length</td>
                  <td className="py-2 font-medium">{machine.length_mm} mm</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Width</td>
                  <td className="py-2 font-medium">{machine.width_mm} mm</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Height</td>
                  <td className="py-2 font-medium">{machine.height_mm} mm</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Weight</td>
                  <td className="py-2 font-medium">{machine.weight_kg} kg</td>
                </tr>
              </tbody>
            </table>

            <h3 className="font-bold text-lg mt-6 mb-4 text-gray-800">Clamping Unit</h3>
            <table className="text-sm w-full">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Clamping Force</td>
                  <td className="py-2 font-medium">{machine.clamping_force_kn} kN</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Mold Height (Min-Max)</td>
                  <td className="py-2 font-medium">{machine.mold_height_min_mm} - {machine.mold_height_max_mm} mm</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Opening Stroke</td>
                  <td className="py-2 font-medium">{machine.opening_stroke_mm} mm</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">Rotary Table</td>
                  <td className="py-2 font-medium">{machine.rotary_table ? 'Yes' : 'No'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-4 text-gray-800">Injection Unit 1</h3>
            <table className="text-sm w-full">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Screw Diameter</td>
                  <td className="py-2 font-medium">{machine.iu1_screw_diameter_mm} mm</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Shot Volume</td>
                  <td className="py-2 font-medium">{machine.iu1_shot_volume_cm3} cm³</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 text-gray-600">Shot Weight</td>
                  <td className="py-2 font-medium">{machine.iu1_shot_weight_g} g</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-600">L/D Ratio</td>
                  <td className="py-2 font-medium">{machine.iu1_ld_ratio}</td>
                </tr>
              </tbody>
            </table>

            {machine.remarks && (
              <>
                <h3 className="font-bold text-lg mt-6 mb-4 text-gray-800">Remarks</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{machine.remarks}</p>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div className="bg-white rounded-lg shadow p-6">
          {user?.role === 'master' && (
            <form onSubmit={handleFileUpload} className="mb-6 p-4 border-2 border-dashed border-gray-300 rounded-lg">
              <input
                type="file"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="block mb-2"
              />
              <button
                type="submit"
                disabled={!uploadFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                Upload File
              </button>
            </form>
          )}

          {files.length === 0 ? (
            <p className="text-gray-600">No files attached</p>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div key={file.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{file.file_name}</p>
                    <p className="text-xs text-gray-600">
                      {file.file_type} • {(file.file_size / 1024).toFixed(0)} KB • {new Date(file.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFileDownload(file.id, file.file_name)}
                      className="px-3 py-1 text-blue-600 hover:text-blue-900 font-medium text-sm"
                    >
                      Download
                    </button>
                    {user?.role === 'master' && (
                      <button
                        onClick={() => fileService.delete(file.id).then(() => loadData())}
                        className="px-3 py-1 text-red-600 hover:text-red-900 font-medium text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'revisions' && (
        <div className="bg-white rounded-lg shadow p-6">
          {revisions.length === 0 ? (
            <p className="text-gray-600">No revision history</p>
          ) : (
            <div className="space-y-4">
              {revisions.map((rev) => (
                <div key={rev.id} className="border rounded p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-800">Revision {rev.revision_number}</p>
                      <p className="text-sm text-gray-600">{rev.change_type.toUpperCase()}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(rev.changed_at).toLocaleString()} by {rev.username || 'Unknown'}
                      </p>
                    </div>
                    <p className="text-sm text-gray-700">{rev.change_summary}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
