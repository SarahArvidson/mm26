import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "24px",
        }}
      >
        Tableaumanie
      </h1>
      <p style={{ fontSize: "1.1rem", color: "#374151", marginBottom: "12px" }}>
        Les élèves choisissent les gagnants de chaque match et suivent leur
        classement.
      </p>
      <p style={{ fontSize: "1.1rem", color: "#374151", marginBottom: "32px" }}>
        Les profs créent les classes, ouvrent les votes en direct et voient les
        résultats.
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <button
          type="button"
          onClick={() => navigate("/login")}
          style={{
            padding: "12px 24px",
            fontSize: "1rem",
            fontWeight: 600,
            backgroundColor: "#7C3AED",
            color: "#FFF",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            minWidth: "200px",
          }}
        >
          Connexion élève
        </button>
        <button
          type="button"
          onClick={() => navigate("/login")}
          style={{
            padding: "12px 24px",
            fontSize: "1rem",
            fontWeight: 600,
            backgroundColor: "#059669",
            color: "#FFF",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            minWidth: "200px",
          }}
        >
          Connexion prof
        </button>
      </div>
      <p style={{ fontSize: "0.9rem", color: "#6B7280" }}>
        Un seul vote par match.
      </p>
    </div>
  );
}
