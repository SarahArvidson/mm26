import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const MAX_MESSAGE_LENGTH = 500;
const MIN_MESSAGE_LENGTH = 10;
const COOLDOWN_SECONDS = 30;

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
      "Yeah, absolutely. To be honest, I wanted to give it as a gift to my former students. Making it free is the best way to make that happen. If you want to buy me a coffee, you can find my Venmo linked in the footer.",
  },
  {
    question: "How do students use Tableaumanie?",
    answer:
      "If you are a student and you want to use Tableaumanie, you'll need to ask your instructor to sign up and provide you with a class code. You can use the sign up form on the login page to create an account. Once you've logged in, you can create your own bracket. As Manie Musicale progresses, your instructor will open voting for you. You can vote for the song you think will win, and you can check out the performance and ranking areas to see how accurate your bracket predictions were as the month of March stomps on by.",
  },
  {
    question: "How do teachers use Tableaumanie?",
    answer:
      "If you're a teacher and you want to use Tableaumanie, you'll need to create a teacher account and verify it via email. Then, you'll need to fill out a super short access request form. I'll grant access and you'll be able to generate class codes, sort students, open and close voting, see match results and reveal videos, and publish those results with your students when you are ready to do so. You will also find some analytics about how your students are voting, an option to export votes via CSV, and a printable copy of the current official paper bracket.",
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
      "I have been interested in computers and coding for a very long time. When I left my teaching job last year, I wanted to start a small business and earn some software engineering skills. I am loving coding, and the full-stack software engineer course that I have been working through actually led me to creating Tableaumanie. I've also created some fun little personal web apps, like a habit tracker that my husband and I use to complete 'quests' and earn 'rewards.' We recently stayed well below our monthly grocery budget, which was a quest. The reward was a new board game we had been eyeing. I have also built a couple of date night generators and automated tech stacks for my small business clients. If you have an idea for something that I might like to try building, let me know in the feedback!",
  },
  {
    question:
      "What can't I just create a bracket on my own without joining a class?",
    answer:
      "The teachers who generously spend their time and devote their energy to running Manie Musicale work hard to ensure that students don't get access to spoilers before voting closes. With Tableaumanie, I tried to capture that same spirit. Students will not know what their rank is in their class until teachers mark that they are finished collecting votes and toggle student rankings to update. If I allowed anyone to create a bracket and see how many points they're earning as the competition progresses, they could screenshot their personal results and spoil the surprise for others. That's just not the vibe I'm seeking to cultivate, friends.",
  },
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
        Hi! Thanks for visiting Tableaumanie, a tool created specifically for
        students and educators participating in Manie Musicale.
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
    </div>
  );
}
