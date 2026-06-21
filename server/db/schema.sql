-- ============================================================
--  ViralShort — Full MySQL Schema
--  Import via phpMyAdmin (Import tab) or MySQL CLI.
--  XAMPP: user=root, password='' (empty)
-- ============================================================

CREATE DATABASE IF NOT EXISTS viralshort
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE viralshort;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50) NOT NULL UNIQUE,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) DEFAULT NULL,
  avatar_path   VARCHAR(255) DEFAULT NULL,
  bio           VARCHAR(300) DEFAULT NULL,
  coins         INT NOT NULL DEFAULT 0,
  diamonds      INT NOT NULL DEFAULT 0,
  last_login_at DATETIME DEFAULT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- SOUNDS (audio attached to videos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sounds (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  author_name VARCHAR(150) DEFAULT NULL,
  audio_path  VARCHAR(255) DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- VIDEOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  video_path  VARCHAR(255) NOT NULL,
  thumb_path  VARCHAR(255) DEFAULT NULL,
  caption     VARCHAR(500) DEFAULT NULL,
  sound_id    INT DEFAULT NULL,
  views       INT NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_videos_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_videos_sound FOREIGN KEY (sound_id) REFERENCES sounds(id) ON DELETE SET NULL,
  INDEX idx_videos_user (user_id),
  INDEX idx_videos_created (created_at)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- HASHTAGS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hashtags (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS video_hashtags (
  video_id   INT NOT NULL,
  hashtag_id INT NOT NULL,
  PRIMARY KEY (video_id, hashtag_id),
  CONSTRAINT fk_vh_video   FOREIGN KEY (video_id)   REFERENCES videos(id)   ON DELETE CASCADE,
  CONSTRAINT fk_vh_hashtag FOREIGN KEY (hashtag_id) REFERENCES hashtags(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- LIKES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  user_id    INT NOT NULL,
  video_id   INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, video_id),
  CONSTRAINT fk_likes_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_likes_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- COMMENTS (supports replies via parent_id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  video_id   INT NOT NULL,
  user_id    INT NOT NULL,
  parent_id  INT DEFAULT NULL,
  text       VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_video  FOREIGN KEY (video_id)  REFERENCES videos(id)   ON DELETE CASCADE,
  CONSTRAINT fk_comments_user   FOREIGN KEY (user_id)   REFERENCES users(id)    ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_comments_video (video_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- FOLLOWS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follows (
  follower_id  INT NOT NULL,
  following_id INT NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT fk_follows_follower  FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- MESSAGING
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_a_id   INT NOT NULL,
  user_b_id   INT NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_pair (user_a_id, user_b_id),
  CONSTRAINT fk_conv_a FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_conv_b FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_id       INT NOT NULL,
  text            VARCHAR(1000) NOT NULL,
  is_read         TINYINT(1) NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id)       REFERENCES users(id)         ON DELETE CASCADE,
  INDEX idx_msg_conv (conversation_id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,                 -- recipient
  actor_id   INT DEFAULT NULL,             -- who triggered it
  type       VARCHAR(30) NOT NULL,         -- like | comment | follow | gift | system
  video_id   INT DEFAULT NULL,
  message    VARCHAR(255) DEFAULT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notif_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_notif_user (user_id)
) ENGINE=InnoDB;

-- ============================================================
--  COINS / DIAMONDS ECONOMY
-- ============================================================

-- Ledger of every coin/diamond change.
CREATE TABLE IF NOT EXISTS coin_transactions (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  currency    ENUM('coins','diamonds') NOT NULL,
  amount      INT NOT NULL,                 -- positive = credit, negative = debit
  reason      VARCHAR(60) NOT NULL,         -- daily_login | like_reward | gift_sent | gift_received | purchase | contest_reward
  ref_id      INT DEFAULT NULL,             -- optional reference (video, gift, purchase...)
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ctx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_ctx_user (user_id)
) ENGINE=InnoDB;

-- Gift catalog (what viewers can send).
CREATE TABLE IF NOT EXISTS gift_types (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(60) NOT NULL,
  icon       VARCHAR(255) DEFAULT NULL,
  coin_cost  INT NOT NULL,                  -- coins the sender spends
  diamond_value INT NOT NULL                -- diamonds the creator receives
) ENGINE=InnoDB;

-- Gifts actually sent.
CREATE TABLE IF NOT EXISTS gifts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  gift_type_id INT NOT NULL,
  sender_id    INT NOT NULL,
  creator_id   INT NOT NULL,                -- video owner who receives diamonds
  video_id     INT DEFAULT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gift_type    FOREIGN KEY (gift_type_id) REFERENCES gift_types(id),
  CONSTRAINT fk_gift_sender  FOREIGN KEY (sender_id)    REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_gift_creator FOREIGN KEY (creator_id)   REFERENCES users(id)  ON DELETE CASCADE,
  CONSTRAINT fk_gift_video   FOREIGN KEY (video_id)     REFERENCES videos(id) ON DELETE SET NULL,
  INDEX idx_gift_creator (creator_id)
) ENGINE=InnoDB;

-- Coin/diamond packs for purchase (mock payment in MVP).
CREATE TABLE IF NOT EXISTS coin_packs (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(60) NOT NULL,
  coins       INT NOT NULL DEFAULT 0,
  diamonds    INT NOT NULL DEFAULT 0,
  price_cents INT NOT NULL                  -- price in USD cents
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchases (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  pack_id     INT NOT NULL,
  status      ENUM('pending','completed','failed') NOT NULL DEFAULT 'completed',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_purchase_user FOREIGN KEY (user_id) REFERENCES users(id)      ON DELETE CASCADE,
  CONSTRAINT fk_purchase_pack FOREIGN KEY (pack_id) REFERENCES coin_packs(id)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- WEEKLY CONTEST
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contests (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(150) NOT NULL,
  starts_at   DATETIME NOT NULL,
  ends_at     DATETIME NOT NULL,
  status      ENUM('active','closed') NOT NULL DEFAULT 'active',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contest_entries (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  contest_id  INT NOT NULL,
  video_id    INT NOT NULL,
  user_id     INT NOT NULL,
  score       INT NOT NULL DEFAULT 0,       -- computed from engagement
  rank        INT DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_entry (contest_id, video_id),
  CONSTRAINT fk_ce_contest FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
  CONSTRAINT fk_ce_video   FOREIGN KEY (video_id)   REFERENCES videos(id)   ON DELETE CASCADE,
  CONSTRAINT fk_ce_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA
-- ============================================================
INSERT INTO gift_types (name, coin_cost, diamond_value) VALUES
  ('Rose', 10, 5),
  ('Heart', 50, 25),
  ('Crown', 200, 120),
  ('Rocket', 1000, 650)
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO coin_packs (name, coins, diamonds, price_cents) VALUES
  ('Starter', 100, 0, 99),
  ('Popular', 600, 0, 499),
  ('Mega', 1500, 50, 999),
  ('Diamond Pouch', 0, 500, 1999)
ON DUPLICATE KEY UPDATE name = VALUES(name);
