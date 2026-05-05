import { useEffect, useState } from 'react';
import { extractApiError } from '../utils/apiErrors';

export default function useApiData(loader, initialData, deps = []) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function reload() {
    setLoading(true);
    setError('');
    try {
      const response = await loader();
      setData(response);
      return response;
    } catch (err) {
      setError(extractApiError(err, 'No se pudo cargar informacion desde la API.'));
      setData(initialData);
      return initialData;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loader()
      .then((response) => {
        if (alive) {
          setData(response);
        }
      })
      .catch((err) => {
        if (alive) {
          setData(initialData);
          setError(extractApiError(err, 'No se pudo cargar informacion desde la API.'));
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, deps);

  return { data, loading, error, reload };
}
