import api from './api';
import type { CapacityClass, Modification, Tool, Machine } from '../types/capacity';

export async function fetchOverview(
  yearFrom: number,
  yearTo: number,
  plant?: string,
): Promise<CapacityClass[]> {
  const r = await api.get<CapacityClass[]>('/capacity/overview', {
    params: { year_from: yearFrom, year_to: yearTo, ...(plant ? { plant } : {}) },
  });
  return r.data;
}

export async function simulateOverview(
  modifications: Modification[],
  yearFrom: number,
  yearTo: number,
  plant?: string,
): Promise<{ before: CapacityClass[]; after: CapacityClass[] }> {
  const r = await api.post<{ before: CapacityClass[]; after: CapacityClass[] }>(
    '/capacity/simulate',
    { modifications, year_from: yearFrom, year_to: yearTo, ...(plant ? { plant } : {}) },
  );
  return r.data;
}

export async function fetchTools(): Promise<Tool[]> {
  const r = await api.get<Tool[]>('/im-tools');
  return r.data;
}

export async function fetchMachines(): Promise<Machine[]> {
  const r = await api.get<Machine[]>('/machines');
  return r.data;
}

export async function moveTool(toolId: number, machineId: number): Promise<Tool> {
  const r = await api.put<Tool>(`/im-tools/${toolId}`, { assigned_machine_id: machineId });
  return r.data;
}

export async function saveScenario(
  name: string,
  modifications: Modification[],
): Promise<unknown> {
  const r = await api.post<unknown>('/scenarios', { name, modifications });
  return r.data;
}

export async function listScenarios(): Promise<unknown[]> {
  const r = await api.get<unknown[]>('/scenarios');
  return r.data;
}

export async function loadScenario(id: number): Promise<unknown> {
  const r = await api.get<unknown>(`/scenarios/${id}`);
  return r.data;
}
