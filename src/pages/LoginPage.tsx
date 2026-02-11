import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
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
    }
    setLoading(false);
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
    }
    setLoading(false);
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
