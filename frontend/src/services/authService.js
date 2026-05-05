import api from './api';

export async function login(credentials) {
  const { data } = await api.post('/auth/login/', credentials);
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('authUser', JSON.stringify(data.user));
  return data;
}

export async function logout() {
  try {
    await api.post('/auth/logout/');
  } finally {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
  }
}

export function getStoredUser() {
  const rawUser = localStorage.getItem('authUser');
  return rawUser ? JSON.parse(rawUser) : null;
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem('authToken'));
}

export async function validateSession() {
  if (!isAuthenticated()) {
    return null;
  }
  const { data } = await api.get('/auth/me/');
  localStorage.setItem('authUser', JSON.stringify(data));
  return data;
}

export function clearSession() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
}
