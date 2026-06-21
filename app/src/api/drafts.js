// Offline, on-device drafts for the reel creator.
// Stores the creation state in AsyncStorage and copies the picked video into
// the app's document directory so it survives app restarts.
import AsyncStorage from '@react-native-async-storage/async-storage';
// Use the legacy FS API (copyAsync/documentDirectory/getInfoAsync) — stable in SDK 54.
import * as FileSystem from 'expo-file-system/legacy';

const KEY = 'reel_drafts_v1';
const DRAFT_DIR = FileSystem.documentDirectory + 'drafts/';

async function ensureDir() {
  try {
    const info = await FileSystem.getInfoAsync(DRAFT_DIR);
    if (!info.exists) await FileSystem.makeDirectoryAsync(DRAFT_DIR, { intermediates: true });
  } catch (_) {}
}

export async function listDrafts() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return arr.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (_) {
    return [];
  }
}

async function writeAll(drafts) {
  await AsyncStorage.setItem(KEY, JSON.stringify(drafts));
}

// Save (or update) a draft. `state` holds caption/filter/sound/trim/cover/etc.
// `videoUri` is copied into persistent storage. Returns the saved draft.
export async function saveDraft(state, videoUri, existingId) {
  await ensureDir();
  const id = existingId || `d_${Date.now()}`;
  let persistedUri = videoUri;
  try {
    if (videoUri && !videoUri.startsWith(DRAFT_DIR)) {
      const dest = `${DRAFT_DIR}${id}.mp4`;
      await FileSystem.copyAsync({ from: videoUri, to: dest });
      persistedUri = dest;
    }
  } catch (_) {
    // if copy fails, keep the original uri (may not survive restart)
  }

  const drafts = await listDrafts();
  const draft = {
    id,
    videoUri: persistedUri,
    state,
    updatedAt: Date.now(),
  };
  const next = [draft, ...drafts.filter((d) => d.id !== id)];
  await writeAll(next);
  return draft;
}

export async function deleteDraft(id) {
  const drafts = await listDrafts();
  const found = drafts.find((d) => d.id === id);
  if (found?.videoUri?.startsWith(DRAFT_DIR)) {
    try { await FileSystem.deleteAsync(found.videoUri, { idempotent: true }); } catch (_) {}
  }
  await writeAll(drafts.filter((d) => d.id !== id));
}

export async function getDraft(id) {
  const drafts = await listDrafts();
  return drafts.find((d) => d.id === id) || null;
}
