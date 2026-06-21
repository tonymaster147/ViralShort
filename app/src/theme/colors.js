// Back-compat static palette. Screens not yet migrated to useTheme() read this
// (always the dark palette, now with the violet accent). New/migrated screens
// should use `useTheme()` from ../theme/ThemeContext for dark+light support.
import { darkTheme } from './tokens';

export const colors = darkTheme;
