import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const MAX_MESSAGE_LENGTH = 500;
const MIN_MESSAGE_LENGTH = 10;
const COOLDOWN_SECONDS = 30;

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  { question: "What is Tableaumanie?", answer: "(Write answer here)" },
  { question: "What is Manie Musicale?", answer: "(Write answer here)" },
  { question: "What problems does Tableaumanie solve?", answer: "(Write answer here)" },
  { question: "How do students use Tableaumanie?", answer: "(Write answer here)" },
  { question: "How do teachers use Tableaumanie?", answer: "(Write answer here)" },
  { question: "How can I request changes or new features?", answer: "(Write answer here)" },
  { question: "Will Tableaumanie be around next year?", answer: "(Write answer here)" },
  { question: "What other projects are you working on?", answer: "(Write answer here)" },
];

export default function InstructionsPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (cooldownUntil == null || Date.now() >= cooldownUntil) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const canSend =
    message.trim().length >= MIN_MESSAGE_LENGTH &&
    message.trim().length <= MAX_MESSAGE_LENGTH &&
    !sending &&
    (cooldownUntil === null || Date.now() > cooldownUntil);

  const handleSubmit = async () => {
    if (!canSend) return;
    const trimmed = message.trim();
    if (trimmed.length < MIN_MESSAGE_LENGTH || trimmed.length > MAX_MESSAGE_LENGTH) return;
    setSending(true);
    setError(null);
    try {
      const client = supabase.supabase as unknown as {
        from: (table: string) => {
          insert: (values: { message: string }) => Promise<{ error: { message?: string } | null }>;
        };
      };
      const { error: insertError } = await client.from("public_feedback").insert({ message: trimmed });
      if (insertError) {
        setError(insertError.message ?? "Failed to send");
        setSending(false);
        return;
      }
      setMessage("");
      setSuccess(true);
      setCooldownUntil(Date.now() + COOLDOWN_SECONDS * 1000);
      setTimeout(() => setSuccess(false), 4000);
    } finally {
      setSending(false);
    }
  };

  const cooldownRemaining =
    cooldownUntil != null && Date.now() < cooldownUntil
      ? Math.ceil((cooldownUntil - Date.now()) / 1000)
      : 0;

  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "24px 20px",
      }}
    >
      <h1 style={{ marginBottom: "8px", fontSize: "1.5rem" }}>Informations</h1>
      <p style={{ marginBottom: "24px", fontSize: "15px", color: "#4B5563" }}>
        FAQ and support for Tableaumanie.
      </p>

      {FAQ_ITEMS.map((item, i) => (
        <details
          key={i}
          style={{
            marginBottom: "12px",
            border: "1px solid #E5E7EB",
            borderRadius: "10px",
            backgroundColor: "#FFFFFF",
            overflow: "hidden",
          }}
        >
          <summary
            style={{
              padding: "14px 16px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "15px",
              color: "#111827",
              listStyle: "none",
            }}
          >
            {item.question}
          </summary>
          <div
            style={{
              padding: "12px 16px 16px",
              borderTop: "1px solid #E5E7EB",
              fontSize: "14px",
              color: "#374151",
              lineHeight: 1.5,
            }}
          >
            {item.answer}
          </div>
        </details>
      ))}

      <div
        style={{
          marginTop: "32px",
          padding: "20px",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          backgroundColor: "#F9FAFB",
        }}
      >
        <h2 style={{ marginBottom: "8px", fontSize: "1.1rem", fontWeight: 600, color: "#111827" }}>
          Send feedback
        </h2>
        <p style={{ marginBottom: "12px", fontSize: "14px", color: "#6B7280" }}>
          Suggestions, bugs, or feature requests. We do not display submissions publicly.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
          placeholder="Your message (10–500 characters)"
          rows={4}
          maxLength={MAX_MESSAGE_LENGTH}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #D1D5DB",
            borderRadius: "8px",
            fontSize: "14px",
            boxSizing: "border-box",
            marginBottom: "10px",
            resize: "vertical",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={!canSend}
            onClick={handleSubmit}
            style={{
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 600,
              backgroundColor: "#7C3AED",
              color: "#FFF",
              border: "none",
              borderRadius: "6px",
              cursor: canSend ? "pointer" : "not-allowed",
              opacity: canSend ? 1 : 0.6,
            }}
          >
            {sending ? "Sending..." : cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : "Send"}
          </button>
          {message.length > 0 && (
            <span style={{ fontSize: "13px", color: "#6B7280" }}>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        {success && (
          <p style={{ marginTop: "12px", marginBottom: 0, fontSize: "14px", color: "#059669" }}>
            Thank you. Your feedback has been sent.
          </p>
        )}
        {error && (
          <p style={{ marginTop: "12px", marginBottom: 0, fontSize: "14px", color: "#DC2626" }}>
            Error: {error}
          </p>
        )}
      </div>
    </div>
  );
}
