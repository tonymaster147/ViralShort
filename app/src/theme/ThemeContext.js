import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, spacing, radius, type } from './tokens';

const KEY = 'theme_mode_v1';
const ThemeContext = createContext(null);

// mode: 'system' | 'dark' | 'light'
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');
  const [system, setSystem] = useState(Appearance.getColorScheme() || 'dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((m) => { if (m) setModeState(m); setReady(true); });
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme || 'dark'));
    return () => sub.remove();
  }, []);

  const setMode = useCallback((m) => {
    setModeState(m);
    AsyncStorage.setItem(KEY, m).catch(() => {});
  }, []);

  const resolved = mode === 'system' ? system : mode;
  const colors = resolved === 'light' ? lightTheme : darkTheme;
  const isDark = resolved !== 'light';

  return (
    <ThemeContext.Provider value={{ colors, mode, setMode, isDark, spacing, radius, type, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback so non-wrapped usage still works (dark).
    return { colors: darkTheme, mode: 'dark', setMode: () => {}, isDark: true, spacing, radius, type, ready: true };
  }
  return ctx;
}
