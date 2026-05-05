import api from './api';

export function createResourceService(path) {
  return {
    async list(params = {}) {
      const { data } = await api.get(path, { params });
      return data;
    },
    async get(id) {
      const { data } = await api.get(`${path}${id}/`);
      return data;
    },
    async create(payload) {
      const { data } = await api.post(path, payload);
      return data;
    },
    async update(id, payload) {
      const { data } = await api.put(`${path}${id}/`, payload);
      return data;
    },
    async remove(id) {
      await api.delete(`${path}${id}/`);
    },
  };
}
