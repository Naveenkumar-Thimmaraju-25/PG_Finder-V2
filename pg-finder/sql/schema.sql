-- PG Finder database schema (MySQL 8+ / MariaDB 10.5+)
-- Run:  mysql -u root -p < sql/schema.sql
-- Or:   npm run db:init   (also creates demo users and sample listings)

CREATE DATABASE IF NOT EXISTS pg_finder
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pg_finder;

-- ---------------------------------------------------------------
-- Users (tenants who search, owners who list, admins who moderate)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name            VARCHAR(100)  NOT NULL,
  email                VARCHAR(150)  NOT NULL,
  username             VARCHAR(40)   NOT NULL,
  phone                VARCHAR(15)   NULL,
  password_hash        VARCHAR(255)  NOT NULL,
  role                 ENUM('tenant','owner','admin') NOT NULL DEFAULT 'tenant',
  recovery_question    VARCHAR(200)  NULL,
  recovery_answer_hash VARCHAR(255)  NULL,
  created_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email    (email),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_phone    (phone)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Password reset links (emailed token, stored hashed, single use)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  CHAR(64)     NOT NULL,
  expires_at  DATETIME     NOT NULL,
  used_at     DATETIME     NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reset_token (token_hash),
  KEY idx_reset_user (user_id),
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- One-time codes for the "other ways" recovery (phone OTP)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_codes (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME     NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  used_at     DATETIME     NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_otp_user (user_id, created_at),
  CONSTRAINT fk_otp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- PG listings
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pgs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id        INT UNSIGNED  NOT NULL,
  title           VARCHAR(150)  NOT NULL,
  description     TEXT          NULL,
  city            VARCHAR(80)   NOT NULL,
  area            VARCHAR(100)  NOT NULL,
  address         VARCHAR(255)  NULL,
  landmark        VARCHAR(150)  NULL,
  latitude        DECIMAL(9,6)  NULL,
  longitude       DECIMAL(9,6)  NULL,
  rent            INT UNSIGNED  NOT NULL,            -- per month, INR
  deposit         INT UNSIGNED  NOT NULL DEFAULT 0,
  gender          ENUM('male','female','unisex') NOT NULL DEFAULT 'unisex',
  sharing         ENUM('single','double','triple','quad') NOT NULL DEFAULT 'double',
  food_included   TINYINT(1)    NOT NULL DEFAULT 0,
  rooms_available TINYINT UNSIGNED NOT NULL DEFAULT 1,
  contact_phone   VARCHAR(15)   NULL,
  is_verified     TINYINT(1)    NOT NULL DEFAULT 0,
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_pgs_rent CHECK (rent > 0),
  KEY idx_pgs_city_area (city, area),
  KEY idx_pgs_rent (rent),
  KEY idx_pgs_filters (is_active, gender, sharing),
  KEY idx_pgs_owner (owner_id),
  CONSTRAINT fk_pgs_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Amenities (many-to-many with PGs)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amenities (
  id    SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(60) NOT NULL,
  icon  VARCHAR(10) NOT NULL DEFAULT '✔',
  UNIQUE KEY uq_amenity_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pg_amenities (
  pg_id       INT UNSIGNED      NOT NULL,
  amenity_id  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (pg_id, amenity_id),
  KEY idx_pga_amenity (amenity_id),
  CONSTRAINT fk_pga_pg      FOREIGN KEY (pg_id)      REFERENCES pgs(id)       ON DELETE CASCADE,
  CONSTRAINT fk_pga_amenity FOREIGN KEY (amenity_id) REFERENCES amenities(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Photos
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pg_images (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pg_id       INT UNSIGNED NOT NULL,
  url         VARCHAR(500) NOT NULL,
  is_cover    TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  KEY idx_img_pg (pg_id, sort_order),
  CONSTRAINT fk_img_pg FOREIGN KEY (pg_id) REFERENCES pgs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Favourites / shortlist
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  user_id    INT UNSIGNED NOT NULL,
  pg_id      INT UNSIGNED NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, pg_id),
  KEY idx_fav_pg (pg_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_pg   FOREIGN KEY (pg_id)   REFERENCES pgs(id)   ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Reviews (one per user per PG)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pg_id       INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  rating      TINYINT UNSIGNED NOT NULL,
  comment     VARCHAR(1000) NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_review_once (pg_id, user_id),
  KEY idx_review_user (user_id),
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_review_pg   FOREIGN KEY (pg_id)   REFERENCES pgs(id)   ON DELETE CASCADE,
  CONSTRAINT fk_review_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Enquiries sent to PG owners
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiries (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pg_id       INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NULL,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  phone       VARCHAR(15)  NULL,
  message     VARCHAR(1000) NOT NULL,
  move_in     DATE NULL,
  status      ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_enq_pg (pg_id, created_at),
  KEY idx_enq_user (user_id),
  CONSTRAINT fk_enq_pg   FOREIGN KEY (pg_id)   REFERENCES pgs(id)   ON DELETE CASCADE,
  CONSTRAINT fk_enq_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Contact-us form messages
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(150) NOT NULL,
  message     VARCHAR(2000) NOT NULL,
  is_read     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_contact_created (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- Convenience view: listing + cover photo + rating summary
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW v_pg_summary AS
SELECT
  p.*,
  (SELECT i.url FROM pg_images i
     WHERE i.pg_id = p.id
     ORDER BY i.is_cover DESC, i.sort_order ASC, i.id ASC
     LIMIT 1)                                         AS cover_image,
  COALESCE((SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.pg_id = p.id), 0) AS avg_rating,
  (SELECT COUNT(*) FROM reviews r WHERE r.pg_id = p.id)                             AS review_count
FROM pgs p;
