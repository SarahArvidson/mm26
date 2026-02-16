import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  const [isTeacher, setIsTeacher] = useState(true);
  const [isTeacherSignUp, setIsTeacherSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [generatedUsername, setGeneratedUsername] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, resetPassword } = useAuth();

  // Username generation word banks
  const artistNames = [
    'NuitIncolore',
    'MissyD',
    'MagicSystem',
    'LesMaryann',
    'GIMS',
    'LeFLOFRANCO',
    'Vitaa',
    'ClaudeBégin',
    'ClaudiaBouvette',
    'MIKA',
    'Lékho',
    'BlackM',
    'Amir',
    'BaladjiKawata',
    'Vianney',
    'KendjiGirac',
    'Soprano',
    'JulienCanaby',
    'Ouidad',
    'AnishaJo',
    'Lubiana',
    'Floran',
    'Eloïz',
    'Ridsa',
    'Salebarbes',
    'Corneille',
    'Soolking',
    'TALI',
    'YanissOdua',
    'FNX',
    'OneLove',
    'MCSolaar',
    'MarieFlore',
    'Kimberose',
    'WEREVANA',
    'RenéGEOFFROY',
    'MargotAbate',
    'KeenV',
    'LeVentDuNord',
    'Mentissa',
    'Wejdene',
    'Zaho',
    'Tayc',
    'Smarty',
    'Zeynab',
    'Toofan',
    'JoyceJonathan',
    'Zaz',
    'Nassi',
    'DANAKIL',
    'JulienGranel',
    'Céphaz',
    'Fredz',
    'PortAuxPoutines',
    'Maheva',
    'MPL',
    'EloïshaIza',
    'RichyJay',
    'Oli',
    'CharlieOz',
    'BoulevardDesAirs',
    'KellyBado',
    'Lenaïg',
    'Luiza',
    'BillieDuPage',
    'Jyeuhair',
    'Saël'
  ];

  const musicWords = [
    'Rythme',
    'Mélodie',
    'Artiste',
    'Rappeur',
    'Orchestre',
    'Concert',
    'Entraînant',
    'Chanteur',
    'Chanson',
    'Temps',
    'Spectacle',
    'Doué',
    'Talentueux'
  ];

  // Generate username utility
  const generateUsername = () => {
    const randomArtist = artistNames[Math.floor(Math.random() * artistNames.length)];
    const randomMusicWord = musicWords[Math.floor(Math.random() * musicWords.length)];
    const randomNumber = Math.floor(Math.random() * 1000); // 0-999
    const paddedNumber = randomNumber.toString().padStart(3, '0'); // 000-999
    return `${randomArtist}${randomMusicWord}${paddedNumber}`;
  };

  // Check if username exists in class
  const checkUsernameExists = async (usernameToCheck: string, classId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('students')
      .select('id')
      .eq('class_id', classId)
      .eq('username', usernameToCheck)
      .maybeSingle();
    return !!data;
  };

  // Generate unique username for class
  const generateUniqueUsername = async (classId: string): Promise<string> => {
    let attempts = 0;
    let newUsername = generateUsername();
    
    while (await checkUsernameExists(newUsername, classId) && attempts < 50) {
      newUsername = generateUsername();
      attempts++;
    }
    
    return newUsername;
  };

  const handleTeacherSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Email confirmation required
        setMessage('Vérifie ton email pour confirmer ton compte');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsTeacherSignUp(false);
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setLoading(false);
    }
  };

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
          // No teacher row exists, redirect to complete profile
          navigate('/complete-profile');
        }
      }
      setLoading(false);
    }, 100);
  };

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      // Construct email from username
      const email = `${username}@class.student`;

      // Sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || 'Invalid credentials');
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Login failed');
        setLoading(false);
        return;
      }

      // Query students table to verify student exists
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('id', authData.user.id)
        .single();

      if (studentError || !studentData) {
        setError('Student record not found');
        setLoading(false);
        return;
      }

      // Success - redirect to student bracket
      // studentSession will be set automatically by AuthContext useEffect
      navigate('/student-bracket');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    if (!isTeacher) {
      setError('Password reset is not available for students. Please contact your teacher.');
      setLoading(false);
      return;
    }

    const { error } = await resetPassword(email);
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
        {error && (
          <div style={{
            marginTop: '16px',
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
        {message && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#D1FAE5',
            border: '1px solid #6EE7B7',
            borderRadius: '8px',
            color: '#065F46',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: '480px',
      margin: '0 auto',
      padding: '40px 20px',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      {/* Branding Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '32px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 8px 0',
          letterSpacing: '-0.5px'
        }}>
          Tableaumanie
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6B7280',
          margin: '0',
          fontWeight: '400'
        }}>
          Crée ton tableau, vote en classe, et vois ton rang
        </p>
      </div>

      {/* Teacher/Student Toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', justifyContent: 'center' }}>
        <button 
          onClick={() => setIsTeacher(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: isTeacher ? '#7C3AED' : '#E5E7EB',
            color: isTeacher ? '#FFFFFF' : '#374151',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          Teacher
        </button>
        <button 
          onClick={() => setIsTeacher(false)}
          style={{
            padding: '10px 20px',
            backgroundColor: !isTeacher ? '#7C3AED' : '#E5E7EB',
            color: !isTeacher ? '#FFFFFF' : '#374151',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          Student
        </button>
      </div>
      {isTeacher ? (
        isTeacherSignUp ? (
          <form onSubmit={handleTeacherSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Email:
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Password:
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Confirm Password:
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
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
            {message && (
              <div style={{
                padding: '12px',
                backgroundColor: '#D1FAE5',
                border: '1px solid #6EE7B7',
                borderRadius: '8px',
                color: '#065F46',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {message}
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
              {loading ? 'Creating...' : 'Créer mon compte'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsTeacherSignUp(false);
                  setError(null);
                  setMessage(null);
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  padding: '4px 0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                  e.currentTarget.style.color = '#6B7280';
                }}
              >
                Déjà un compte ? Se connecter
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleTeacherLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Email:
              </label>
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
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
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Password:
              </label>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
            {message && (
              <div style={{
                padding: '12px',
                backgroundColor: '#D1FAE5',
                border: '1px solid #6EE7B7',
                borderRadius: '8px',
                color: '#065F46',
                fontSize: '14px',
                textAlign: 'center'
              }}>
                {message}
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
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <button 
              type="button" 
              onClick={() => setShowForgotPassword(true)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'transparent',
                color: '#7C3AED',
                border: 'none',
                fontSize: '14px',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Forgot Password?
            </button>
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsTeacherSignUp(true);
                  setError(null);
                  setMessage(null);
                }}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#6B7280',
                  fontSize: '14px',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  padding: '4px 0'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = 'underline';
                  e.currentTarget.style.color = '#374151';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = 'none';
                  e.currentTarget.style.color = '#6B7280';
                }}
              >
                Pas encore de compte ? Créer un compte enseignant
              </button>
            </div>
          </form>
        )
      ) : (
        <>
          {!isSignUp ? (
            <form onSubmit={handleStudentLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Username:
                </label>
                <input
                  type="text"
                  name="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
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
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                  Password:
                </label>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
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
                {loading ? 'Logging in...' : 'Login'}
              </button>
              <div style={{ textAlign: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                    setGeneratedUsername('');
                    setFullName('');
                    setPassword('');
                    setConfirmPassword('');
                    setShowConfirmation(false);
                  }}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#6B7280',
                    fontSize: '14px',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    padding: '4px 0'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                    e.currentTarget.style.color = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                    e.currentTarget.style.color = '#6B7280';
                  }}
                >
                  Pas encore inscrit(e) ? Créer un compte
                </button>
              </div>
            </form>
          ) : (
            <>
              {showConfirmation ? (
                <div style={{
                  padding: '20px',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  backgroundColor: '#FFFFFF',
                  maxWidth: '400px',
                  textAlign: 'center'
                }}>
                  <p style={{ marginBottom: '16px', fontSize: '16px' }}>
                    T'es content(e) avec ton nom d'utilisateur ? Tu ne peux pas le changer plus tard.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                    <button
                      type="button"
                      onClick={() => setShowConfirmation(false)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#E5E7EB',
                        color: '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        margin: 0
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setShowConfirmation(false);
                        setLoading(true);
                        setError(null);

                        try {
                          // Look up class by join_code
                          const { data: classData, error: classError } = await supabase
                            .from('classes')
                            .select('id')
                            .eq('join_code', joinCode.toUpperCase())
                            .maybeSingle();

                          if (classError || !classData) {
                            setError('Invalid join code');
                            setLoading(false);
                            return;
                          }

                          // Check if name already exists in class
                          const { data: existingName } = await supabase
                            .from('students')
                            .select('id')
                            .eq('class_id', classData.id)
                            .eq('name', fullName.trim())
                            .maybeSingle();

                          if (existingName) {
                            setError('This name is already used in this class');
                            setLoading(false);
                            return;
                          }

                          // Call Edge Function to create student
                          const { data: functionData, error: functionError } = await supabase.supabase.functions.invoke('create-student', {
                            body: {
                              join_code: joinCode.toUpperCase(),
                              full_name: fullName.trim(),
                              username: generatedUsername,
                              password: password,
                            },
                          });

                          if (functionError || !functionData) {
                            setError(functionError?.message || functionData?.error || 'Registration failed');
                            setLoading(false);
                            return;
                          }

                          // Sign in student using Supabase auth
                          const studentEmail = `${generatedUsername}@class.student`;
                          const { error: signInError } = await supabase.supabase.auth.signInWithPassword({
                            email: studentEmail,
                            password,
                          });

                          if (signInError) {
                            setError(signInError.message || 'Registration succeeded but login failed. Please log in manually.');
                            setLoading(false);
                            return;
                          }

                          // Success - navigate to student bracket
                          navigate('/student-bracket');
                          setLoading(false);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Registration failed');
                        }
                        setLoading(false);
                      }}
                      disabled={loading}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#7C3AED',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.5 : 1,
                        margin: 0
                      }}
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);

                  if (!joinCode || !fullName || !generatedUsername || !password || !confirmPassword) {
                    setError('Please fill in all fields');
                    return;
                  }

                  if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    return;
                  }

                  if (password.length < 6) {
                    setError('Password must be at least 6 characters');
                    return;
                  }

                  // Validate class exists
                  const { data: classData, error: classError } = await supabase
                    .from('classes')
                    .select('id')
                    .eq('join_code', joinCode.toUpperCase())
                    .maybeSingle();

                  if (classError || !classData) {
                    setError('Invalid join code');
                    return;
                  }

                  // Check if name already exists
                  const { data: existingName } = await supabase
                    .from('students')
                    .select('id')
                    .eq('class_id', classData.id)
                    .eq('name', fullName.trim())
                    .maybeSingle();

                  if (existingName) {
                    setError('This name is already used in this class');
                    return;
                  }

                  // Check if username already exists
                  const usernameExists = await checkUsernameExists(generatedUsername, classData.id);
                  if (usernameExists) {
                    setError('Username already taken. Please regenerate.');
                    return;
                  }

                  // Show confirmation
                  setShowConfirmation(true);
                }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Class Join Code:
                    </label>
                    <input
                      type="text"
                      name="joinCode"
                      value={joinCode}
                      onChange={async (e) => {
                        const newCode = e.target.value.toUpperCase();
                        setJoinCode(newCode);
                        // Auto-generate username when join code is entered
                        if (newCode.length === 6 && !generatedUsername) {
                          const { data: classData } = await supabase
                            .from('classes')
                            .select('id')
                            .eq('join_code', newCode)
                            .maybeSingle();
                          
                          if (classData) {
                            const uniqueUsername = await generateUniqueUsername(classData.id);
                            setGeneratedUsername(uniqueUsername);
                          }
                        }
                      }}
                      required
                      autoComplete="off"
                      placeholder="Enter class code"
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
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Full Name:
                    </label>
                    <input
                      type="text"
                      name="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Your full name"
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
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Username:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        name="username"
                        value={generatedUsername || 'Click Regenerate to generate username'}
                        readOnly
                        required
                        autoComplete="username"
                        style={{
                          flex: 1,
                          padding: '10px 12px',
                          backgroundColor: '#F3F4F6',
                          border: '1px solid #D1D5DB',
                          borderRadius: '8px',
                          fontSize: '14px',
                          cursor: 'not-allowed',
                          color: generatedUsername ? '#111827' : '#9CA3AF',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!joinCode) {
                            setError('Please enter join code first');
                            return;
                          }
                          setError(null);
                          
                          // Look up class
                          const { data: classData, error: classError } = await supabase
                            .from('classes')
                            .select('id')
                            .eq('join_code', joinCode.toUpperCase())
                            .maybeSingle();

                          if (classError || !classData) {
                            setError('Invalid join code');
                            return;
                          }

                          // Generate unique username
                          const uniqueUsername = await generateUniqueUsername(classData.id);
                          setGeneratedUsername(uniqueUsername);
                        }}
                        disabled={!joinCode}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: '#10B981',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '600',
                          cursor: !joinCode ? 'not-allowed' : 'pointer',
                          opacity: !joinCode ? 0.5 : 1,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {generatedUsername ? 'Regenerate' : 'Generate'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Password:
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
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
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                      Confirm Password:
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
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
                  <button 
                    type="submit" 
                    disabled={loading || !generatedUsername}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#7C3AED',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: (loading || !generatedUsername) ? 'not-allowed' : 'pointer',
                      opacity: (loading || !generatedUsername) ? 0.6 : 1,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    {loading ? 'Creating...' : 'Créer mon compte'}
                  </button>
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setError(null);
                        setGeneratedUsername('');
                        setFullName('');
                        setPassword('');
                        setConfirmPassword('');
                        setShowConfirmation(false);
                      }}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#6B7280',
                        fontSize: '14px',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        padding: '4px 0'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.textDecoration = 'underline';
                        e.currentTarget.style.color = '#374151';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.textDecoration = 'none';
                        e.currentTarget.style.color = '#6B7280';
                      }}
                    >
                      Déjà inscrit(e) ? Se connecter
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}
      {error && (
        <div style={{
          marginTop: '16px',
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
    </div>
  );
}
