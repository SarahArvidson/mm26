import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const MAX_MESSAGE_LENGTH = 500;
const MIN_MESSAGE_LENGTH = 10;
const COOLDOWN_SECONDS = 30;

const MIN_LEVELS_LENGTH = 10;
const TEACHER_REQUEST_COOLDOWN_SECONDS = 30;

const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: "What is Tableaumanie?",
    answer:
      "Tableaumanie is all about having no more lost brackets, providing centralized live voting for teachers who want it, and giving students the ability to know where they stand in the competition. It's a set of tools for students and teachers to help them enjoy Manie Musicale a little bit more.",
  },
  {
    question: "What is Manie Musicale?",
    answer:
      "Manie musicale is an annual competition in which students who are acquiring French as a foreign or second language engage with sixteen songs and related content from the francophone world. Each registered student completes a March Madness style bracket before the competition begins. Students attempt to correctly guess the winners of each head-to-head musical matchup, ultimately guessing the Manie Musicale championship winner. Every couple of days in March and April, students vote. The votes are tallied. If a student has correctly predicted who won a given matchup, they receive the corresponding number of points, with the stakes getting higher and higher as the competition progresses. As of March 2nd, 2026, there are over 7,600 schools and universities participating. There are over 930,000 students registered to compete.",
  },
  {
    question: "What problems does Tableaumanie solve?",
    answer:
      "Tableaumanie is the answer to my own middle and high school educator quandaries: how can I easily track my students' progress and rank in the Manie Musicale competition every March? Students would lose their paper brackets, or they'd write in pencil and change their minds. I would struggle to locate the reveal videos and to land on an easy way to collect votes from each of my classes. When online voting disappeared from the official Manie Musicale website, I was guttered! I left my full-time middle and high-school teaching job this year, and I knew that I wanted to participate in Manie Musicale with my college students. How was I going to keep track of all of their brackets and tally their points when I visit campus just once a week and one of my classes is fully online? Tableaumanie is the solution that I was able to build now that I have started learning to develop the edTech tools I always wanted to have.",
  },
  {
    question: "Is Tableaumanie free to use?",
    answer:
      "Yeah, absolutely. To be honest, I wanted to give it as a gift to my former students. Making it free is the best way to make that happen. It's true that I took a major pay cut to change my life so I can do things like this, so I won't say know to gifting me a cup of coffee or something small like that. You'll find my Venmo linked in the footer.",
  },
  {
    question: "How do students use Tableaumanie?",
    answer: "(Write answer here)",
  },
  {
    question: "How do teachers use Tableaumanie?",
    answer: "(Write answer here)",
  },
  {
    question: "How can I request changes or new features?",
    answer:
      "There's a feedback area at the bottom of this page that you can use. If you're a teacher, and you want me to be able to respond to your request, use the feedback area in the teacher tools area of your dashboard.",
  },
  {
    question: "Will Tableaumanie be around next year?",
    answer:
      "Definitely. I am a big fan of Manie Musicale. When I started this project, I made sure to build it in such a way that the data is stored by the year. This means that setting up for next year won't involve much more work than updating song titles and YouTube URLs. ",
  },
  {
    question: "What other projects are you working on?",
    answer:
      "I have been interested in computers and coding for a very long time. When I left my teaching job last year, I wanted instead to shift to part-time work while I started a small business and improved my software engineering skills. I'm not sure I want to keep the small business, but I am loving coding, and the full-stack software engineer course that I have been working through actually led me to creating Tableaumanie. I've also created some fun little personal web apps, like a habit tracker that my husband and I use to complete 'quests' and earn 'rewards.' For example, we recently stayed well below our grocery store budget, which was a quest. The reward was a new board game we been wanting. I have also built a couple of date night generators and automated tech stacks for my small business clients. If you have an idea for something that I might like to try building, let me know in the feedback!",
  },
];

export default function InstructionsPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [teacherFullName, setTeacherFullName] = useState("");
  const [teacherSchoolName, setTeacherSchoolName] = useState("");
  const [teacherSchoolEmail, setTeacherSchoolEmail] = useState("");
  const [teacherLevels, setTeacherLevels] = useState("");
  const [teacherClassCount, setTeacherClassCount] = useState<string>("");
  const [teacherStudentCount, setTeacherStudentCount] = useState<string>("");
  const [teacherMessage, setTeacherMessage] = useState("");
  const [teacherSending, setTeacherSending] = useState(false);
  const [teacherSuccess, setTeacherSuccess] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherCooldownUntil, setTeacherCooldownUntil] = useState<
    number | null
  >(null);
  const [, setTeacherCooldownTick] = useState(0);

  useEffect(() => {
    if (cooldownUntil == null || Date.now() >= cooldownUntil) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    supabase.supabase.auth
      .getSession()
      .then(({ data: { session: s } }) =>
        setSession(s ? { user: { id: s.user.id } } : null),
      );
    const {
      data: { subscription },
    } = supabase.supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s ? { user: { id: s.user.id } } : null),
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (teacherCooldownUntil == null || Date.now() >= teacherCooldownUntil)
      return;
    const id = setInterval(() => setTeacherCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [teacherCooldownUntil]);

  const canSend =
    message.trim().length >= MIN_MESSAGE_LENGTH &&
    message.trim().length <= MAX_MESSAGE_LENGTH &&
    !sending &&
    (cooldownUntil === null || Date.now() > cooldownUntil);

  const handleSubmit = async () => {
    if (!canSend) return;
    const trimmed = message.trim();
    if (
      trimmed.length < MIN_MESSAGE_LENGTH ||
      trimmed.length > MAX_MESSAGE_LENGTH
    )
      return;
    setSending(true);
    setError(null);
    try {
      const client = supabase.supabase as unknown as {
        from: (table: string) => {
          insert: (values: {
            message: string;
          }) => Promise<{ error: { message?: string } | null }>;
        };
      };
      const { error: insertError } = await client
        .from("public_feedback")
        .insert({ message: trimmed });
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
    if (!session?.user?.id || !teacherFormValid) return;
    if (teacherLevels.trim().length < MIN_LEVELS_LENGTH) {
      setTeacherError("Please enter at least 10 characters for levels taught.");
      return;
    }
    setTeacherSending(true);
    setTeacherError(null);
    try {
      type Table = {
        select: (c: string) => {
          eq: (
            a: string,
            b: string,
          ) => {
            eq: (
              a2: string,
              b2: string,
            ) => {
              limit: (n: number) => Promise<{ data: { id: string }[] | null }>;
            };
          };
        };
        insert: (v: object) => Promise<{ error: { message?: string } | null }>;
      };
      const table = (
        supabase.supabase as unknown as { from: (t: string) => Table }
      ).from("teacher_access_requests");
      const { data: existing } = await table
        .select("id")
        .eq("user_id", session.user.id)
        .eq("status", "pending")
        .limit(1);
      if (existing && existing.length > 0) {
        setTeacherError("You already have a pending request.");
        setTeacherSending(false);
        return;
      }
      const classCount =
        teacherClassCount.trim() === ""
          ? null
          : parseInt(teacherClassCount, 10);
      const studentCount =
        teacherStudentCount.trim() === ""
          ? null
          : parseInt(teacherStudentCount, 10);
      const { error: insertErr } = await table.insert({
        user_id: session.user.id,
        full_name: teacherFullName.trim().slice(0, 120),
        school_name: teacherSchoolName.trim().slice(0, 120),
        school_email: teacherSchoolEmail.trim().slice(0, 120),
        levels: teacherLevels.trim().slice(0, 200),
        class_count: Number.isNaN(classCount) ? null : classCount,
        student_count: Number.isNaN(studentCount) ? null : studentCount,
        message: teacherMessage.trim().slice(0, 800) || null,
      });
      if (insertErr) {
        setTeacherError(insertErr.message ?? "Failed to submit request.");
        setTeacherSending(false);
        return;
      }
      setTeacherFullName("");
      setTeacherSchoolName("");
      setTeacherSchoolEmail("");
      setTeacherLevels("");
      setTeacherClassCount("");
      setTeacherStudentCount("");
      setTeacherMessage("");
      setTeacherSuccess(true);
      setTeacherCooldownUntil(
        Date.now() + TEACHER_REQUEST_COOLDOWN_SECONDS * 1000,
      );
      setTimeout(() => setTeacherSuccess(false), 4000);
    } finally {
      setTeacherSending(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "720px",
        margin: "0 auto",
        padding: "24px 20px",
      }}
    >
      <h1 style={{ marginBottom: "8px", fontSize: "1.5rem" }}>Information</h1>
      <p style={{ marginBottom: "24px", fontSize: "15px", color: "#4B5563" }}>
        Hi! Thanks for visiting Tableaumanie. I created Tableaumanie as a tool
        to be used by students and educators participating in Manie Musicale.
      </p>
      <p style={{ marginBottom: "24px", fontSize: "15px", color: "#4B5563" }}>
        I hope you enjoy it.
      </p>
      <p style={{ marginBottom: "24px", fontSize: "15px", color: "#4B5563" }}>
        Warmly,
        <br /> Sarah Arvidson
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
        <h2
          style={{
            marginBottom: "8px",
            fontSize: "1.1rem",
            fontWeight: 600,
            color: "#111827",
          }}
        >
          Send feedback
        </h2>
        <p style={{ marginBottom: "12px", fontSize: "14px", color: "#6B7280" }}>
          Suggestions, bugs, or feature requests. We do not display submissions
          publicly.
        </p>
        <textarea
          value={message}
          onChange={(e) =>
            setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
          }
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
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
            {sending
              ? "Sending..."
              : cooldownRemaining > 0
                ? `Wait ${cooldownRemaining}s`
                : "Send"}
          </button>
          {message.length > 0 && (
            <span style={{ fontSize: "13px", color: "#6B7280" }}>
              {message.length}/{MAX_MESSAGE_LENGTH}
            </span>
          )}
        </div>
        {success && (
          <p
            style={{
              marginTop: "12px",
              marginBottom: 0,
              fontSize: "14px",
              color: "#059669",
            }}
          >
            Thank you. Your feedback has been sent.
          </p>
        )}
        {error && (
          <p
            style={{
              marginTop: "12px",
              marginBottom: 0,
              fontSize: "14px",
              color: "#DC2626",
            }}
          >
            Error: {error}
          </p>
        )}
      </div>

      <details
        style={{
          marginTop: "16px",
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
          Request teacher access
        </summary>
        <div
          style={{
            padding: "12px 16px 16px",
            borderTop: "1px solid #E5E7EB",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {!session ? (
            <>
              <p style={{ fontSize: "14px", color: "#374151", margin: 0 }}>
                Log in to request teacher access.
              </p>
              <Link
                to="/login"
                style={{
                  display: "inline-block",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  backgroundColor: "#7C3AED",
                  color: "#FFF",
                  borderRadius: "6px",
                  textDecoration: "none",
                  width: "fit-content",
                }}
              >
                Log in
              </Link>
            </>
          ) : (
            <>
              <input
                type="text"
                placeholder="Full name (required, max 120)"
                value={teacherFullName}
                onChange={(e) =>
                  setTeacherFullName(e.target.value.slice(0, 120))
                }
                maxLength={120}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="text"
                placeholder="School name (required, max 120)"
                value={teacherSchoolName}
                onChange={(e) =>
                  setTeacherSchoolName(e.target.value.slice(0, 120))
                }
                maxLength={120}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="email"
                placeholder="School email (required, max 120)"
                value={teacherSchoolEmail}
                onChange={(e) =>
                  setTeacherSchoolEmail(e.target.value.slice(0, 120))
                }
                maxLength={120}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="text"
                placeholder="Levels taught (required, 10–200 chars)"
                value={teacherLevels}
                onChange={(e) => setTeacherLevels(e.target.value.slice(0, 200))}
                maxLength={200}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="number"
                placeholder="Number of classes (optional)"
                value={teacherClassCount}
                onChange={(e) => setTeacherClassCount(e.target.value)}
                min={0}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <input
                type="number"
                placeholder="Number of students (optional)"
                value={teacherStudentCount}
                onChange={(e) => setTeacherStudentCount(e.target.value)}
                min={0}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
              <textarea
                placeholder="Message (optional, max 800 chars)"
                value={teacherMessage}
                onChange={(e) =>
                  setTeacherMessage(e.target.value.slice(0, 800))
                }
                maxLength={800}
                rows={3}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #D1D5DB",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
              {teacherLevels.trim().length > 0 &&
                teacherLevels.trim().length < MIN_LEVELS_LENGTH && (
                  <p style={{ fontSize: "13px", color: "#DC2626", margin: 0 }}>
                    Please enter at least 10 characters for levels taught.
                  </p>
                )}
              <button
                type="button"
                disabled={!teacherFormValid}
                onClick={handleTeacherRequestSubmit}
                style={{
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 600,
                  backgroundColor: "#7C3AED",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "6px",
                  cursor: teacherFormValid ? "pointer" : "not-allowed",
                  opacity: teacherFormValid ? 1 : 0.6,
                  alignSelf: "flex-start",
                }}
              >
                {teacherSending
                  ? "Sending..."
                  : teacherCooldownRemaining > 0
                    ? `Wait ${teacherCooldownRemaining}s`
                    : "Submit request"}
              </button>
              {teacherSuccess && (
                <p style={{ fontSize: "14px", color: "#059669", margin: 0 }}>
                  Request sent. Thanks!
                </p>
              )}
              {teacherError && (
                <p style={{ fontSize: "14px", color: "#DC2626", margin: 0 }}>
                  {teacherError}
                </p>
              )}
            </>
          )}
        </div>
      </details>
    </div>
  );
}
