-- Migration: Add Multilingual Columns and Tables
-- Database: Cloudflare D1 (SQLite)

-- 1. Create devotion translations metadata table (for searching devotions in different languages)
CREATE TABLE IF NOT EXISTS devotion_translations (
    devotion_id TEXT,
    language_code TEXT, -- 'id', 'en', 'zh'
    title TEXT NOT NULL,
    excerpt TEXT DEFAULT '',
    PRIMARY KEY (devotion_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_devotion_trans_lang ON devotion_translations(language_code);

-- 2. Add columns to articles table for language support
ALTER TABLE articles ADD COLUMN title_en TEXT DEFAULT '';
ALTER TABLE articles ADD COLUMN title_zh TEXT DEFAULT '';
ALTER TABLE articles ADD COLUMN excerpt_en TEXT DEFAULT '';
ALTER TABLE articles ADD COLUMN excerpt_zh TEXT DEFAULT '';

-- 3. Add columns to encyclopedia table for language support
ALTER TABLE encyclopedia ADD COLUMN title_en TEXT DEFAULT '';
ALTER TABLE encyclopedia ADD COLUMN title_zh TEXT DEFAULT '';

-- 4. Create cell_groups table for Komsel groups
CREATE TABLE IF NOT EXISTS cell_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    language_code TEXT DEFAULT 'id'
);

-- 5. Create user_notes table for personal Bible notes & bookmarks
CREATE TABLE IF NOT EXISTS user_notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    verse_id TEXT NOT NULL, -- Format: translationId-book-chapter-verse
    translation_id TEXT NOT NULL, -- 'ind_web', 'web', 'zh_web'
    note_text TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user ON user_notes(user_id);
