-- Migration: Add image_url and excerpt columns to articles table
-- Also add banner_url to encyclopedia table

-- Add missing columns to articles table
ALTER TABLE articles ADD COLUMN image_url TEXT DEFAULT '';
ALTER TABLE articles ADD COLUMN excerpt TEXT DEFAULT '';

-- Add banner_url to encyclopedia table
ALTER TABLE encyclopedia ADD COLUMN banner_url TEXT DEFAULT '';
