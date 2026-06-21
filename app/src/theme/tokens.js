// ViralShort design tokens — dark + light palettes (violet accent).
// Keys match the legacy `colors` object so screens migrate by swapping the source.

export const darkTheme = {
  mode: 'dark',
  bg: '#0A0A0B',
  surface: '#161618',
  card: '#1C1C1F',
  elevated: '#232327',
  text: '#FFFFFF',
  textMuted: '#8E8E93',
  primary: '#7C5CFF',     // violet
  primaryDim: 'rgba(124,92,255,0.15)',
  accent: '#9B82FF',
  success: '#2ECC71',
  danger: '#FF4D4F',
  coin: '#F5C518',
  diamond: '#5B8DEF',
  border: '#262628',
  overlay: 'rgba(0,0,0,0.6)',
};

export const lightTheme = {
  mode: 'light',
  bg: '#FFFFFF',
  surface: '#F7F7FA',
  card: '#F1F1F5',
  elevated: '#FFFFFF',
  text: '#0A0A0B',
  textMuted: '#6B6B70',
  primary: '#7C5CFF',
  primaryDim: 'rgba(124,92,255,0.12)',
  accent: '#6C4DF0',
  success: '#23A65A',
  danger: '#E0344B',
  coin: '#C9A211',
  diamond: '#2C82C9',
  border: '#E5E5EA',
  overlay: 'rgba(0,0,0,0.45)',
};

// Spacing / radii / type scale (theme-independent).
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 30 };
export const type = {
  h1: { fontSize: 24, fontWeight: '800' },
  h2: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 15, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '500' },
};
