import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isTeacher, setIsTeacher] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, resetPassword } = useAuth();

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Wait for auth state to update, then check role
    setTimeout(async () => {
      const { data: { session } } = await supabase.supabase.auth.getSession();
      if (session?.user) {
        // Check if user is admin
        if (session.user.app_metadata?.role === 'admin') {
          navigate('/master-bracket');
          setLoading(false);
          return;
        }
        
        // Check if user is a teacher
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (teacherData) {
          navigate('/teacher-dashboard');
        } else {
          setError('User not found in teachers table');
        }
      }
      setLoading(false);
    }, 100);
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Map username to internal email format
    const studentEmail = `${username}@students.internal`;
    const { error } = await signIn(studentEmail, password);
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Wait for auth state to update, then check role
    setTimeout(async () => {
      const { data: { session } } = await supabase.supabase.auth.getSession();
      if (session?.user) {
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (studentData) {
          navigate('/student-bracket');
        } else {
          setError('User not found in students table');
        }
      }
      setLoading(false);
    }, 100);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const emailToReset = isTeacher ? email : `${username}@students.internal`;
    const { error } = await resetPassword(emailToReset);
    if (error) {
      setError(error.message);
    } else {
      setMessage('Password reset email sent. Please check your inbox.');
      setShowForgotPassword(false);
    }
    setLoading(false);
  };

  if (showForgotPassword) {
    return (
      <div>
        <h1>Reset Password</h1>
        <form onSubmit={handleForgotPassword}>
          {isTeacher ? (
            <div>
              <label>
                Email:
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            </div>
          ) : (
            <div>
              <label>
                Username:
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </label>
            </div>
          )}
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Email'}
          </button>
          <button type="button" onClick={() => setShowForgotPassword(false)}>
            Back to Login
          </button>
        </form>
        {error && <div>{error}</div>}
        {message && <div>{message}</div>}
      </div>
    );
  }

  return (
    <div>
      <h1>Login</h1>
      <div>
        <button onClick={() => setIsTeacher(true)}>Teacher</button>
        <button onClick={() => setIsTeacher(false)}>Student</button>
      </div>
      {isTeacher ? (
        <form onSubmit={handleTeacherLogin}>
          <div>
            <label>
              Email:
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
          </div>
          <div>
            <label>
              Password:
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" onClick={() => setShowForgotPassword(true)}>
            Forgot Password?
          </button>
        </form>
      ) : (
        <form onSubmit={handleStudentLogin}>
          <div>
            <label>
              Username:
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
          </div>
          <div>
            <label>
              Password:
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <button type="button" onClick={() => setShowForgotPassword(true)}>
            Forgot Password?
          </button>
        </form>
      )}
      {error && <div>{error}</div>}
    </div>
  );
}
