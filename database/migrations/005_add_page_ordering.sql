-- Migration: Update page ordering
-- Description: Ensures display_order is properly set for all pages
-- Author: System
-- Date: 2025-10-20
-- Note: display_order column already exists from migration 003

-- Ensure display_order column exists (should already exist from 003)
ALTER TABLE pages
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create additional index if needed (different name from 003's idx_pages_order)
CREATE INDEX IF NOT EXISTS idx_pages_display_order ON pages(display_order);

-- Set initial display_order values based on current id
-- This ensures existing pages have a default order if not set
UPDATE pages
SET display_order = id * 10
WHERE display_order = 0;

-- Add comment to column
COMMENT ON COLUMN pages.display_order IS 'Order in which the page should be displayed (lower numbers appear first)';

-- Verification query
SELECT id, name, path, display_order
FROM pages
ORDER BY display_order, name;
