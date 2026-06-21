-- ============================================================
--  Migration 002 — Audio module (saved sounds, voice-over)
--  Idempotent. Run after 001.
-- ============================================================
USE viralshort;

-- Sounds a user has saved/favorited for quick reuse.
CREATE TABLE IF NOT EXISTS saved_sounds (
  user_id    INT NOT NULL,
  sound_id   INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, sound_id),
  CONSTRAINT fk_ss_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ss_sound FOREIGN KEY (sound_id) REFERENCES sounds(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- videos: remember a user-recorded voice-over file (optional, for reference).
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS has_voiceover TINYINT(1) NOT NULL DEFAULT 0;
