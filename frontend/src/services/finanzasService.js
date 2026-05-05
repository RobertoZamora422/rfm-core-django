import api from './api';
import { createResourceService } from './resourceService';

export const costosDirectosService = createResourceService('/costos-directos/');
export const gastosFijosService = createResourceService('/gastos-fijos/');

export async function obtenerDashboardFinanciero(params) {
  const { data } = await api.get('/dashboard-financiero/', { params });
  return data;
}
