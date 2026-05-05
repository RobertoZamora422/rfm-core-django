import api from './api';

export async function obtenerInicioResumen() {
  const { data } = await api.get('/inicio-resumen/');
  return data;
}
