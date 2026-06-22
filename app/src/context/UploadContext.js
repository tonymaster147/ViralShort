import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { uploadVideo } from '../api/videos';

const UploadContext = createContext(null);

// Runs the reel upload in the background so the user can keep browsing.
// Exposes progress + a retry on failure via a global pill.
export function UploadProvider({ children }) {
  const [status, setStatus] = useState('idle'); // idle | uploading | done | failed
  const [progress, setProgress] = useState(0);
  const payloadRef = useRef(null);

  const run = useCallback(async (payload) => {
    setStatus('uploading');
    setProgress(0);
    try {
      await uploadVideo(payload.asset, payload.caption, setProgress, payload.opts);
      setStatus('done');
      setTimeout(() => setStatus((s) => (s === 'done' ? 'idle' : s)), 3500);
    } catch (err) {
      console.warn('[upload] failed:', err?.message);
      setStatus('failed');
    }
  }, []);

  const start = useCallback((payload) => {
    payloadRef.current = payload;
    run(payload);
  }, [run]);

  const retry = useCallback(() => {
    if (payloadRef.current) run(payloadRef.current);
  }, [run]);

  const dismiss = useCallback(() => setStatus('idle'), []);

  return (
    <UploadContext.Provider value={{ status, progress, start, retry, dismiss }}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error('useUpload must be used within UploadProvider');
  return ctx;
}
