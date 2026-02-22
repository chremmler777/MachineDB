import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Debug logging
if (typeof window !== 'undefined') {
  console.log('[API] VITE_API_URL env:', import.meta.env.VITE_API_URL);
  console.log('[API] Using baseURL:', API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me'),
};

export const machineService = {
  list: (params?: any) => api.get('/machines', { params }),
  get: (id: number) => api.get(`/machines/${id}`),
  create: (data: any) => api.post('/machines', data),
  update: (id: number, data: any) => api.put(`/machines/${id}`, data),
  delete: (id: number) => api.delete(`/machines/${id}`),
  getRevisions: (id: number) => api.get(`/machines/${id}/revisions`),
  compare: (ids: number[]) => api.get(`/machines/compare/${ids.join(',')}`),
  finder: (requirements: any) => api.post('/machines/finder/search', requirements),
};

export const fileService = {
  list: (machineId: number) => api.get(`/files/machine/${machineId}`),
  upload: (machineId: number, file: File, fileType: string, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);
    if (description) formData.append('description', description);
    return api.post(`/files/machine/${machineId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  download: (fileId: number) => api.get(`/files/download/${fileId}`, { responseType: 'blob' }),
  delete: (fileId: number) => api.delete(`/files/${fileId}`),
};

export const importService = {
  uploadExcel: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import/excel', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default api;
