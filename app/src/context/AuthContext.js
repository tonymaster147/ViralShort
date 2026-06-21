import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signupRequest, loginRequest, fetchMe } from '../api/auth';
import { onClientEvent } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // initial token restore

  // On app start, restore token and load the user.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          const me = await fetchMe();
          setUser(me);
        }
      } catch (_) {
        await AsyncStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signup = useCallback(async (username, email, password) => {
    const data = await signupRequest(username, email, password);
    await AsyncStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(async (emailOrUsername, password) => {
    const data = await loginRequest(emailOrUsername, password);
    await AsyncStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('token');
    setUser(null);
  }, []);

  // Auto sign-out if the server rejects our token (expired/invalid).
  useEffect(() => {
    const off = onClientEvent('unauthorized', () => { logout(); });
    return off;
  }, [logout]);

  // Let screens refresh/replace the cached user (after profile edits etc).
  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    return me;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, loading, signup, login, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
