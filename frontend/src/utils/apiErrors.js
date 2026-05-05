function flattenMessages(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flattenMessages);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([field, messages]) => (
      flattenMessages(messages).map((message) => `${field}: ${message}`)
    ));
  }
  if (value === null || value === undefined || value === '') {
    return [];
  }
  return [String(value)];
}

export function extractApiError(error, fallback = 'No se pudo completar la operacion.') {
  const data = error?.response?.data;
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;

  const messages = Object.entries(data).flatMap(([field, value]) => (
    flattenMessages(value).map((message) => `${field}: ${message}`)
  ));
  return messages.length ? messages.join(' ') : fallback;
}
