-- Migration: Create Tables for Articles and Encyclopedia
-- Database: Cloudflare D1 (SQLite)

-- 1. Create articles metadata table
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  r2_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  tags TEXT
);

CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_title ON articles(title);

-- 2. Create encyclopedia metadata table
CREATE TABLE IF NOT EXISTS encyclopedia (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  keyword TEXT NOT NULL,
  title TEXT,
  kategori TEXT NOT NULL,
  r2_path TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_encyclopedia_kategori ON encyclopedia(kategori);
CREATE INDEX IF NOT EXISTS idx_encyclopedia_keyword ON encyclopedia(keyword);
