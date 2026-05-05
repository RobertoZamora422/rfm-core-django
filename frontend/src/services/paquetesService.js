import api from './api';
import { createResourceService } from './resourceService';

export const paquetesService = createResourceService('/paquetes/');

export async function obtenerDesempenoPaquetes() {
  const { data } = await api.get('/paquetes/desempeno/');
  return data;
}

export async function listarPaquetesPublicos(params = {}) {
  const { data } = await api.get('/paquetes/', { params, skipAuth: true });
  return data;
}
