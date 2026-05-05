import api from './api';

export async function obtenerReporte(tipo, params) {
  const { data } = await api.get(`/reportes/${tipo}/`, { params });
  return data;
}
