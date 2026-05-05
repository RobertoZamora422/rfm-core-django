import api from './api';

export async function obtenerConfiguracion({ publico = false } = {}) {
  const { data } = await api.get('/configuracion/', { skipAuth: publico });
  return data;
}

export async function guardarConfiguracion(payload) {
  const { data } = await api.put('/configuracion/', payload);
  return data;
}
