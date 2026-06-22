// Side-channel to hand editor/clip results back to the Create screen WITHOUT
// re-navigating to it (which would lose the in-progress video/asset state).
// The editor screens set a pending value, then goBack(); Create reads it on focus.
let pendingOverlay = null;
let pendingClipItems = null;

export function setPendingOverlay(v) { pendingOverlay = v; }
export function takePendingOverlay() { const v = pendingOverlay; pendingOverlay = null; return v; }

export function setPendingClipItems(v) { pendingClipItems = v; }
export function takePendingClipItems() { const v = pendingClipItems; pendingClipItems = null; return v; }
