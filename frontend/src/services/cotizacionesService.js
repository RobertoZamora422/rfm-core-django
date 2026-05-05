import api from './api';
import { createResourceService } from './resourceService';

export const cotizacionesService = createResourceService('/cotizaciones/');

export async function cambiarEstadoCotizacion(id, payload) {
  const { data } = await api.post(`/cotizaciones/${id}/cambiar-estado/`, payload);
  return data;
}

export async function convertirCotizacionContrato(id, payload) {
  const { data } = await api.post(`/cotizaciones/${id}/convertir-contrato/`, payload);
  return data;
}

export async function calcularPreCotizacion(payload) {
  const { data } = await api.post('/pre-cotizacion/', payload, { skipAuth: true });
  return data;
}
