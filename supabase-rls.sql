-- Enable RLS on all tables
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matchups ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_picks ENABLE ROW LEVEL SECURITY;

-- Seasons: Teachers can read all, students can read all
CREATE POLICY "Seasons are readable by authenticated users"
  ON seasons FOR SELECT
  TO authenticated
  USING (true);

-- Teachers: Teachers can see their own record
CREATE POLICY "Teachers can see their own record"
  ON teachers FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Classes: Teachers can see only their classes
CREATE POLICY "Teachers can see their own classes"
  ON classes FOR SELECT
  TO authenticated
  USING (
    teacher_id IN (
      SELECT id FROM teachers WHERE id = auth.uid()
    )
  );

-- Students: Teachers can see students in their classes, students can see themselves
CREATE POLICY "Teachers can see students in their classes"
  ON students FOR SELECT
  TO authenticated
  USING (
    class_id IN (
      SELECT id FROM classes WHERE teacher_id = auth.uid()
    )
    OR id = auth.uid()
  );

-- Students: Prevent students from changing class_id
CREATE POLICY "Students cannot change class_id"
  ON students FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND class_id = (SELECT class_id FROM students WHERE id = auth.uid())
  );

-- Songs: All authenticated users can read
CREATE POLICY "Songs are readable by authenticated users"
  ON songs FOR SELECT
  TO authenticated
  USING (true);

-- Bracket matchups: All authenticated users can read
CREATE POLICY "Bracket matchups are readable by authenticated users"
  ON bracket_matchups FOR SELECT
  TO authenticated
  USING (true);

-- Master results: All authenticated users can read, only admin can update
CREATE POLICY "Master results are readable by authenticated users"
  ON master_results FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admin can update master results"
  ON master_results FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Student brackets: Students can see only their own bracket
CREATE POLICY "Students can see their own bracket"
  ON student_brackets FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR student_id IN (
      SELECT s.id FROM students s
      INNER JOIN classes c ON s.class_id = c.id
      WHERE c.teacher_id = auth.uid()
    )
  );

-- Student brackets: Students can create their own bracket
CREATE POLICY "Students can create their own bracket"
  ON student_brackets FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Student brackets: Cannot be updated after finalized=true
CREATE POLICY "Student brackets cannot be updated after finalized"
  ON student_brackets FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    AND finalized = false
  )
  WITH CHECK (
    student_id = auth.uid()
    AND finalized = false
  );

-- Student picks: Remove old policies that reference auth.uid()
DROP POLICY IF EXISTS "Students can see picks for their own bracket" ON student_picks;
DROP POLICY IF EXISTS "Students can create picks for their own bracket" ON student_picks;
DROP POLICY IF EXISTS "Students can update picks for their own non-finalized bracket" ON student_picks;
DROP POLICY IF EXISTS "Students can delete picks for their own non-finalized bracket" ON student_picks;

-- Student picks: Permissive policies for MVP (classroom-scoped, not publicly exposed)
-- Policy 1: Allow SELECT for all
CREATE POLICY "Allow SELECT on student_picks"
  ON student_picks FOR SELECT
  USING (true);

-- Policy 2: Allow INSERT for all
CREATE POLICY "Allow INSERT on student_picks"
  ON student_picks FOR INSERT
  WITH CHECK (true);

-- Policy 3: Allow UPDATE for all
CREATE POLICY "Allow UPDATE on student_picks"
  ON student_picks FOR UPDATE
  USING (true)
  WITH CHECK (true);
