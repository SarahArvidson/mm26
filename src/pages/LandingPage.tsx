import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        maxWidth: "560px",
        margin: "0 auto",
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <style>{`
        @keyframes landingMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
      <h1
        style={{
          fontSize: "2.5rem",
          fontWeight: 700,
          color: "#111827",
          marginBottom: "32px",
        }}
      >
        Tableaumanie
      </h1>
      <div
        style={{ fontSize: "1.1rem", color: "#374151", marginBottom: "16px" }}
      >
        Un outil simple pour faire ton tableau et suivre la compétition
      </div>
      <p
        style={{ fontSize: "1.1rem", color: "#374151", marginBottom: "40px" }}
      ></p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          alignItems: "center",
          marginBottom: "40px",
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
      <div
        style={{
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderTop: "1px solid #E5E7EB",
          borderBottom: "1px solid #E5E7EB",
          overflow: "hidden",
          color: "#6B7280",
          fontSize: "12px",
          marginTop: "8px",
        }}
      >
        <div style={{ width: "100%", overflow: "hidden" }}>
          <div
            style={{
              display: "inline-flex",
              whiteSpace: "nowrap",
              animation: "landingMarquee 20s linear infinite",
            }}
          >
            <span style={{ paddingRight: "32px" }}>
              Choisis le vainqueur • Vois ton rang • Regarde les clips • Vote en
              direct • Choisis le vainqueur • Vois ton rang • Regarde les clips
              • Vote en direct
            </span>
            <span style={{ paddingRight: "32px" }}>
              Choisis le vainqueur • Vois ton rang • Regarde les clips • Vote en
              direct • Choisis le vainqueur • Vois ton rang • Regarde les clips
              • Vote en direct
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
