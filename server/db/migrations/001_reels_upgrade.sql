-- ============================================================
--  Migration 001 — Reel upgrade (Phase 1: processing, cover, drafts)
--  Idempotent: safe to run multiple times (MariaDB IF NOT EXISTS).
--  Run:  "C:/xampp/mysql/bin/mysql.exe" -u root viralshort < db/migrations/001_reels_upgrade.sql
-- ============================================================
USE viralshort;

-- --- videos: metadata + processing status + cover + permissions ---
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS duration       DECIMAL(8,2) DEFAULT NULL,                 -- seconds
  ADD COLUMN IF NOT EXISTS width          INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS height         INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS file_size      BIGINT DEFAULT NULL,                        -- bytes
  ADD COLUMN IF NOT EXISTS cover_path     VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hls_path       VARCHAR(255) DEFAULT NULL,                  -- reserved for streaming phase
  ADD COLUMN IF NOT EXISTS status         ENUM('processing','ready','failed') NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS allow_comments TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allow_remix    TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS allow_download TINYINT(1) NOT NULL DEFAULT 0,
  -- filter already added earlier; included here so a fresh DB stays consistent
  ADD COLUMN IF NOT EXISTS filter         VARCHAR(30) DEFAULT NULL;

-- Existing rows are already published; keep them visible.
UPDATE videos SET status = 'ready' WHERE status IS NULL;

-- Index for feed filtering by status.
ALTER TABLE videos ADD INDEX IF NOT EXISTS idx_videos_status (status);

-- --- drafts: server-side draft of an in-progress reel (optional sync) ---
-- Local offline drafts live on-device; this table is for cross-device sync.
CREATE TABLE IF NOT EXISTS drafts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  payload     JSON NOT NULL,                 -- caption, filter, soundId, trim, permissions, coverTime…
  thumb_path  VARCHAR(255) DEFAULT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_drafts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_drafts_user (user_id)
) ENGINE=InnoDB;

-- --- sounds: enrich for search / trending / saved ---
ALTER TABLE sounds
  ADD COLUMN IF NOT EXISTS duration    DECIMAL(8,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS art_path    VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS usage_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_trending TINYINT(1) NOT NULL DEFAULT 0;
