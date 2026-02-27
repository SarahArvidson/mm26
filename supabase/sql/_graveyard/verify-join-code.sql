-- Verification query: Confirm join_code columns and constraint exist in Supabase
-- Run this in Supabase SQL Editor after migration

-- Check columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'classes'
  AND column_name IN ('join_code', 'join_code_created_at')
ORDER BY ordinal_position;

-- Check UNIQUE constraint exists
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  a.attname AS column_name
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
WHERE n.nspname = 'public'
  AND t.relname = 'classes'
  AND conname = 'classes_join_code_unique';

-- Verify all existing classes have join_code populated
SELECT 
  id,
  name,
  join_code,
  join_code_created_at,
  CASE 
    WHEN join_code IS NULL THEN 'MISSING'
    ELSE 'OK'
  END AS status
FROM public.classes;
