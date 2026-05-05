import api from './api';
import { createResourceService } from './resourceService';

export const contratosService = createResourceService('/contratos/');

export async function obtenerCostosContrato(id) {
  const { data } = await api.get(`/contratos/${id}/costos/`);
  return data;
}
