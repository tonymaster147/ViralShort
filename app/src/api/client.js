import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

// Shared axios instance for the whole app.
// Generous default timeout; uploads override this with timeout: 0 (no limit).
const client = axios.create({
  baseURL: API_URL,
  timeout: 60000,
});

// Attach JWT token (set after login) to every request.
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Simple event bridge so non-React modules can signal auth/network state.
const listeners = { unauthorized: [], network: [] };
export function onClientEvent(type, cb) {
  listeners[type]?.push(cb);
  return () => { listeners[type] = (listeners[type] || []).filter((f) => f !== cb); };
}
function emitClientEvent(type, payload) {
  (listeners[type] || []).forEach((cb) => cb(payload));
}

// Global response handling: 401 -> sign out; network error -> offline signal.
client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      emitClientEvent('unauthorized');
    } else if (!error.response) {
      // No response = network/server unreachable.
      emitClientEvent('network', { offline: true });
    }
    return Promise.reject(error);
  }
);

export default client;

// Simple health check used on the Phase 0 screen.
export async function checkHealth() {
  const res = await client.get('/health');
  return res.data;
}
