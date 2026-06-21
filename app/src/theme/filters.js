// Lightweight visual filters applied as a tinted overlay on the video.
// (Real GPU filters need native modules; this is an MVP color-grade overlay.)
export const FILTERS = [
  { key: 'none',    label: 'Normal',  overlay: 'transparent' },
  { key: 'warm',    label: 'Warm',    overlay: 'rgba(255,150,50,0.18)' },
  { key: 'cool',    label: 'Cool',    overlay: 'rgba(50,150,255,0.18)' },
  { key: 'vintage', label: 'Vintage', overlay: 'rgba(160,120,60,0.25)' },
  { key: 'pink',    label: 'Blush',   overlay: 'rgba(255,80,140,0.18)' },
  { key: 'mono',    label: 'B&W',     overlay: 'rgba(128,128,128,0.35)' },
];

export function filterOverlay(key) {
  const f = FILTERS.find((x) => x.key === key);
  return f ? f.overlay : 'transparent';
}
