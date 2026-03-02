import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

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
      .from("teachers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setIsTeacher(!!data));
  }, [user?.id]);

  const [isWideScreen, setIsWideScreen] = useState(
    typeof window !== "undefined" && window.innerWidth >= 768
  );
  useEffect(() => {
    const onResize = () => setIsWideScreen(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleLogout = async () => {
    await signOut();
    setMenuOpen(false);
    navigate("/login");
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          padding: "8px 0 16px",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        {isWideScreen && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div />
            <nav
              style={{
                display: "flex",
                flexDirection: "row",
                flexWrap: "wrap",
                gap: "16px",
                alignItems: "center",
              }}
            >
              <Link to="/accueil" onClick={() => setMenuOpen(false)}>
                Accueil
              </Link>
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                Connexion
              </Link>
              {studentSession && (
                <Link to="/student-bracket" onClick={() => setMenuOpen(false)}>
                  Mon tableau
                </Link>
              )}
              {isTeacher === true && (
                <Link to="/teacher-dashboard" onClick={() => setMenuOpen(false)}>
                  Tableau de bord
                </Link>
              )}
              <Link to="/master-bracket" onClick={() => setMenuOpen(false)}>
                Tableau maître
              </Link>
              <Link to="/video-library" onClick={() => setMenuOpen(false)}>
                Vidéos
              </Link>
              <Link to="/instructions" onClick={() => setMenuOpen(false)}>
                Instructions
              </Link>
              <Link to="/settings" onClick={() => setMenuOpen(false)}>
                Paramètres
              </Link>
            </nav>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {(user || studentSession) && (
                <button onClick={handleLogout}>Déconnexion</button>
              )}
            </div>
          </div>
        )}
        {!isWideScreen && (
          <button onClick={() => setMenuOpen(!menuOpen)}>☰</button>
        )}
      </header>
      {!isWideScreen && menuOpen && (
        <div
          style={{
            marginTop: "12px",
            border: "1px solid #E5E7EB",
            borderRadius: "12px",
            padding: "10px",
            backgroundColor: "#FFFFFF",
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Link to="/accueil" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
              Accueil
            </Link>
            <Link to="/login" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
              Connexion
            </Link>
            {studentSession && (
              <Link to="/student-bracket" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
                Mon tableau
              </Link>
            )}
            {isTeacher === true && (
              <Link to="/teacher-dashboard" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
                Tableau de bord
              </Link>
            )}
            <Link to="/master-bracket" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
              Tableau maître
            </Link>
            <Link to="/video-library" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
              Vidéos
            </Link>
            <Link to="/instructions" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
              Instructions
            </Link>
            <Link to="/settings" onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "10px 12px" }}>
              Paramètres
            </Link>
            {(user || studentSession) && (
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: "none",
                  border: "none",
                  textAlign: "left",
                  font: "inherit",
                  padding: "10px 12px",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Déconnexion
              </button>
            )}
          </nav>
        </div>
      )}
      <main style={{ padding: "24px 0", minHeight: "60vh" }}>
        <Outlet />
      </main>
      <footer
        style={{
          marginTop: "2rem",
          padding: "1.5rem 0",
          textAlign: "center",
          fontSize: "14px",
          color: "#6B7280",
          borderTop: "1px solid #E5E7EB",
        }}
      >
        <p style={{ margin: "0 0 8px 0" }}>
          © 2026 Sarah Arvidson. Tous droits réservés.
        </p>
        <p style={{ margin: 0 }}>
          <a
            href="https://github.com/SarahArvidson"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginRight: "12px" }}
          >
            GitHub
          </a>
          <a
            href="https://maniemusicale.info"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginRight: "12px" }}
          >
            Maniemusicale.info
          </a>
          <a
            href="https://www.venmo.com/u/Sarah-Arvidson"
            target="_blank"
            rel="noopener noreferrer"
          >
            Laisser un pourboire
          </a>
        </p>
      </footer>
    </div>
  );
}
