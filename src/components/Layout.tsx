import { useState, useEffect } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function Layout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isTeacher, setIsTeacher] = useState<boolean | null>(null);
  const { user, studentSession, signOut } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      setIsTeacher(false);
      return;
    }
    supabase.supabase
      .from('teachers')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setIsTeacher(!!data));
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
    setMenuOpen(false);
    navigate('/login');
  };

  return (
    <div>
      <header>
        <button onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
        {menuOpen && (
          <nav>
            <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link to="/student-bracket" onClick={() => setMenuOpen(false)}>Student Bracket</Link>
            {isTeacher === true && (
              <Link to="/teacher-dashboard" onClick={() => setMenuOpen(false)}>Teacher Dashboard</Link>
            )}
            <Link to="/master-bracket" onClick={() => setMenuOpen(false)}>Master Bracket</Link>
            <Link to="/video-library" onClick={() => setMenuOpen(false)}>Video Library</Link>
            <Link to="/instructions" onClick={() => setMenuOpen(false)}>Instructions</Link>
            <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>
            {(user || studentSession) && (
              <button onClick={handleLogout}>Logout</button>
            )}
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
