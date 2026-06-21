import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../api/config';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Connect when a user is logged in; disconnect on logout.
  useEffect(() => {
    let active = true;
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setConnected(false);
      setUnreadMessages(0);
      setUnreadNotifications(0);
      return;
    }
    (async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token || !active) return;
      const s = io(API_BASE_URL, { auth: { token }, transports: ['websocket'] });
      socketRef.current = s;
      s.on('connect', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      s.on('notification:new', () => setUnreadNotifications((n) => n + 1));
      // message:new handled here only to bump the inbox badge; chat screen
      // attaches its own listener for live messages.
      s.on('message:new', () => setUnreadMessages((n) => n + 1));
    })();
    return () => { active = false; socketRef.current?.disconnect(); socketRef.current = null; };
  }, [user]);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const emit = useCallback((event, payload, ack) => {
    socketRef.current?.emit(event, payload, ack);
  }, []);

  const clearMessageBadge = useCallback(() => setUnreadMessages(0), []);
  const clearNotificationBadge = useCallback(() => setUnreadNotifications(0), []);
  const setMessageBadge = useCallback((n) => setUnreadMessages(n), []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef, connected, on, emit,
        unreadMessages, unreadNotifications,
        clearMessageBadge, clearNotificationBadge, setMessageBadge,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
