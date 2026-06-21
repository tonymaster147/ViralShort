-- ============================================================
--  Migration 003 — Publish extras (location, schedule, mentions)
--  Idempotent. Run after 002.
-- ============================================================
USE viralshort;

-- videos: location + scheduling
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS location_name VARCHAR(150) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_lat  DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_lng  DECIMAL(10,7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at  DATETIME DEFAULT NULL;

-- add a 'scheduled' state to the status enum (safe to re-run)
ALTER TABLE videos
  MODIFY COLUMN status ENUM('processing','ready','failed','scheduled') NOT NULL DEFAULT 'ready';

ALTER TABLE videos ADD INDEX IF NOT EXISTS idx_videos_scheduled (scheduled_at);

-- @mentions on a video
CREATE TABLE IF NOT EXISTS mentions (
  video_id   INT NOT NULL,
  user_id    INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (video_id, user_id),
  CONSTRAINT fk_mentions_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
  CONSTRAINT fk_mentions_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  INDEX idx_mentions_user (user_id)
) ENGINE=InnoDB;
