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

export default client;

// Simple health check used on the Phase 0 screen.
export async function checkHealth() {
  const res = await client.get('/health');
  return res.data;
}
