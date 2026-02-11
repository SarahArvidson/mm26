import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

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
            <Link to="/teacher-dashboard" onClick={() => setMenuOpen(false)}>Teacher Dashboard</Link>
            <Link to="/master-bracket" onClick={() => setMenuOpen(false)}>Master Bracket</Link>
            <Link to="/video-library" onClick={() => setMenuOpen(false)}>Video Library</Link>
            <Link to="/instructions" onClick={() => setMenuOpen(false)}>Instructions</Link>
            <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
