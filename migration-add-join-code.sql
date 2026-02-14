-- Stage 11: Add join_code and join_code_created_at to classes table
-- Migration: Add join_code columns with backfill for existing rows

-- Step 1: Add join_code_created_at column (nullable first, then set defaults)
ALTER TABLE public.classes
ADD COLUMN join_code_created_at TIMESTAMPTZ DEFAULT now();

-- Step 2: Add join_code column (nullable first for backfill)
ALTER TABLE public.classes
ADD COLUMN join_code TEXT;

-- Step 3: Backfill existing classes with unique join codes
-- Generate 6-character alphanumeric codes (uppercase letters + numbers)
UPDATE public.classes
SET join_code = UPPER(
  SUBSTRING(
    REPLACE(gen_random_uuid()::TEXT, '-', ''),
    1,
    6
  )
),
join_code_created_at = created_at
WHERE join_code IS NULL;

-- Step 4: Make join_code NOT NULL
ALTER TABLE public.classes
ALTER COLUMN join_code SET NOT NULL;

-- Step 5: Add UNIQUE constraint on join_code
ALTER TABLE public.classes
ADD CONSTRAINT classes_join_code_unique UNIQUE (join_code);
