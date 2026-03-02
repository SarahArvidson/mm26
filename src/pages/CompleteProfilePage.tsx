import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const MIN_LEVELS_LENGTH = 10;
const TEACHER_REQUEST_COOLDOWN_SECONDS = 30;

export default function CompleteProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessStatus, setAccessStatus] = useState<'loading' | 'approved' | 'unapproved'>('loading');

  const [teacherFullName, setTeacherFullName] = useState('');
  const [teacherSchoolName, setTeacherSchoolName] = useState('');
  const [teacherSchoolEmail, setTeacherSchoolEmail] = useState('');
  const [teacherLevels, setTeacherLevels] = useState('');
  const [teacherClassCount, setTeacherClassCount] = useState('');
  const [teacherStudentCount, setTeacherStudentCount] = useState('');
  const [teacherMessage, setTeacherMessage] = useState('');
  const [teacherSending, setTeacherSending] = useState(false);
  const [teacherSuccess, setTeacherSuccess] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherCooldownUntil, setTeacherCooldownUntil] = useState<number | null>(null);
  const [, setTeacherCooldownTick] = useState(0);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    const checkAccess = async () => {
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (teacherData) {
        navigate('/teacher-dashboard', { replace: true });
        return;
      }

      const { data: studentData } = await supabase
        .from('students')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (studentData) {
        navigate('/login', { replace: true, state: { teacherOnly: true } });
        return;
      }

      const { data: allowlistData } = await supabase
        .from('teacher_allowlist')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      setAccessStatus(allowlistData ? 'approved' : 'unapproved');
    };

    checkAccess();
  }, [user, navigate]);

  useEffect(() => {
    if (teacherCooldownUntil == null || Date.now() >= teacherCooldownUntil) return;
    const id = setInterval(() => setTeacherCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [teacherCooldownUntil]);

  const teacherCooldownRemaining =
    teacherCooldownUntil != null && Date.now() < teacherCooldownUntil
      ? Math.ceil((teacherCooldownUntil - Date.now()) / 1000)
      : 0;

  const teacherFormValid =
    teacherFullName.trim().length > 0 &&
    teacherFullName.trim().length <= 120 &&
    teacherSchoolName.trim().length > 0 &&
    teacherSchoolName.trim().length <= 120 &&
    teacherSchoolEmail.trim().length > 0 &&
    teacherSchoolEmail.trim().length <= 120 &&
    teacherLevels.trim().length >= MIN_LEVELS_LENGTH &&
    teacherLevels.trim().length <= 200 &&
    teacherMessage.length <= 800 &&
    !teacherSending &&
    (teacherCooldownUntil === null || Date.now() > teacherCooldownUntil);

  const handleTeacherRequestSubmit = async () => {
    if (!user?.id || !teacherFormValid) return;
    if (teacherLevels.trim().length < MIN_LEVELS_LENGTH) {
      setTeacherError('Please enter at least 10 characters for levels taught.');
      return;
    }
    setTeacherSending(true);
    setTeacherError(null);
    try {
      type Table = {
        select: (c: string) => { eq: (a: string, b: string) => { eq: (a2: string, b2: string) => { limit: (n: number) => Promise<{ data: { id: string }[] | null }> } } };
        insert: (v: object) => Promise<{ error: { message?: string } | null }>;
      };
      const table = (supabase.supabase as unknown as { from: (t: string) => Table }).from('teacher_access_requests');
      const { data: existing } = await table.select('id').eq('user_id', user.id).eq('status', 'pending').limit(1);
      if (existing && existing.length > 0) {
        setTeacherError('You already have a pending request.');
        setTeacherSending(false);
        return;
      }
      const classCount = teacherClassCount.trim() === '' ? null : parseInt(teacherClassCount, 10);
      const studentCount = teacherStudentCount.trim() === '' ? null : parseInt(teacherStudentCount, 10);
      const { error: insertErr } = await table.insert({
        user_id: user.id,
        full_name: teacherFullName.trim().slice(0, 120),
        school_name: teacherSchoolName.trim().slice(0, 120),
        school_email: teacherSchoolEmail.trim().slice(0, 120),
        levels: teacherLevels.trim().slice(0, 200),
        class_count: Number.isNaN(classCount) ? null : classCount,
        student_count: Number.isNaN(studentCount) ? null : studentCount,
        message: teacherMessage.trim().slice(0, 800) || null,
      });
      if (insertErr) {
        setTeacherError(insertErr.message ?? 'Failed to submit request.');
        setTeacherSending(false);
        return;
      }
      setTeacherFullName('');
      setTeacherSchoolName('');
      setTeacherSchoolEmail('');
      setTeacherLevels('');
      setTeacherClassCount('');
      setTeacherStudentCount('');
      setTeacherMessage('');
      setTeacherSuccess(true);
      setTeacherCooldownUntil(Date.now() + TEACHER_REQUEST_COOLDOWN_SECONDS * 1000);
      setTimeout(() => setTeacherSuccess(false), 4000);
    } finally {
      setTeacherSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!user) {
      navigate('/login');
      return;
    }

    if (!fullName.trim()) {
      setError('Please enter your full name');
      setLoading(false);
      return;
    }

    try {
      // Insert into teachers table
      const { error: insertError } = await supabase
        .from('teachers')
        .insert({
          id: user.id,
          name: fullName.trim(),
        });

      if (insertError) {
        // If duplicate (teacher already exists), just navigate to dashboard
        if (insertError.code === '23505') {
          navigate('/teacher-dashboard');
          return;
        }
        setError(insertError.message || 'Failed to create profile');
        setLoading(false);
        return;
      }

      // Success - redirect to teacher dashboard
      navigate('/teacher-dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
      setLoading(false);
    }
  };

  const cardStyle = {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '40px 20px',
    minHeight: '100vh',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    justifyContent: 'center' as const,
  };

  if (accessStatus === 'loading') {
    return (
      <div style={cardStyle}>
        <div style={{ padding: '32px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: '#FFFFFF', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (accessStatus === 'unapproved') {
    return (
      <div style={cardStyle}>
        <div style={{
          padding: '32px',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          textAlign: 'left',
        }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
            Request teacher access
          </h1>
          <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 12px 0' }}>
            Teacher accounts require approval to prevent student spoilers.
          </p>
          <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 24px 0' }}>
            Submit the form below. We'll email you once approved.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="text"
              placeholder="Full name (required, max 120)"
              value={teacherFullName}
              onChange={(e) => setTeacherFullName(e.target.value.slice(0, 120))}
              maxLength={120}
              style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
            />
            <input
              type="text"
              placeholder="School name (required, max 120)"
              value={teacherSchoolName}
              onChange={(e) => setTeacherSchoolName(e.target.value.slice(0, 120))}
              maxLength={120}
              style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
            />
            <input
              type="email"
              placeholder="School email (required, max 120)"
              value={teacherSchoolEmail}
              onChange={(e) => setTeacherSchoolEmail(e.target.value.slice(0, 120))}
              maxLength={120}
              style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
            />
            <input
              type="text"
              placeholder="Levels taught (required, 10–200 chars)"
              value={teacherLevels}
              onChange={(e) => setTeacherLevels(e.target.value.slice(0, 200))}
              maxLength={200}
              style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
            />
            <input
              type="number"
              placeholder="Number of classes (optional)"
              value={teacherClassCount}
              onChange={(e) => setTeacherClassCount(e.target.value)}
              min={0}
              style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
            />
            <input
              type="number"
              placeholder="Number of students (optional)"
              value={teacherStudentCount}
              onChange={(e) => setTeacherStudentCount(e.target.value)}
              min={0}
              style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const }}
            />
            <textarea
              placeholder="Message (optional, max 800 chars)"
              value={teacherMessage}
              onChange={(e) => setTeacherMessage(e.target.value.slice(0, 800))}
              maxLength={800}
              rows={3}
              style={{ padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' as const, resize: 'vertical' as const }}
            />
            {teacherLevels.trim().length > 0 && teacherLevels.trim().length < MIN_LEVELS_LENGTH && (
              <p style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>Please enter at least 10 characters for levels taught.</p>
            )}
            <button
              type="button"
              disabled={!teacherFormValid}
              onClick={handleTeacherRequestSubmit}
              style={{
                padding: '12px 20px',
                fontSize: '16px',
                fontWeight: 600,
                backgroundColor: '#7C3AED',
                color: '#FFF',
                border: 'none',
                borderRadius: '8px',
                cursor: teacherFormValid ? 'pointer' : 'not-allowed',
                opacity: teacherFormValid ? 1 : 0.6,
              }}
            >
              {teacherSending ? 'Sending...' : teacherCooldownRemaining > 0 ? `Wait ${teacherCooldownRemaining}s` : 'Submit request'}
            </button>
            {teacherSuccess && <p style={{ fontSize: '14px', color: '#059669', margin: 0 }}>Request sent. Thanks!</p>}
            {teacherError && <p style={{ fontSize: '14px', color: '#DC2626', margin: 0 }}>{teacherError}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{
        padding: '32px',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        backgroundColor: '#FFFFFF',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
          Complete Your Profile
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 8px 0' }}>
          You're approved. Continue setup.
        </p>
        <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px 0' }}>
          Please enter your full name to continue
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151', textAlign: 'left' }}>
              Full Name:
            </label>
            <input
              type="text"
              name="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoComplete="name"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: '#FEE2E2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#DC2626',
              fontSize: '14px',
              textAlign: 'center'
            }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#7C3AED',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s ease'
            }}
          >
            {loading ? 'Creating...' : 'Create Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
