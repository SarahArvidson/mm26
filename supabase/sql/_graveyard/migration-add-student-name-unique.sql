-- Stage 11 Part 3: Add UNIQUE constraint on (class_id, name) for students table
-- This ensures no duplicate names within the same class

-- Check if constraint already exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'students_class_id_name_key'
  ) THEN
    ALTER TABLE students
    ADD CONSTRAINT students_class_id_name_key
    UNIQUE (class_id, name);
  END IF;
END $$;
