import { createResourceService } from './resourceService';
import api from './api';

export const eventosService = createResourceService('/tipos-evento/');

export async function listarEventosPublicos(params = {}) {
  const { data } = await api.get('/tipos-evento/', { params, skipAuth: true });
  return data;
}
