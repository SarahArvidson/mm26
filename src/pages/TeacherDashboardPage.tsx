import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import {
  resolveActiveSeason,
  getValidMasterOptionsForMatchup,
  type Season,
  type BracketMatchup,
  type StudentBracket,
  type StudentPick,
  type MasterResult,
  type Song,
  type ClassMatchupVoting,
  type StudentVote,
  type UUID,
} from "../utils/bracketLogic";
import {
  computePerStudentScores,
  createLeaderboard,
  type StudentScore,
} from "../utils/scoring";
import RoundAccuracyPie from "../components/charts/RoundAccuracyPie";
import PredictionDistributionPie from "../components/charts/PredictionDistributionPie";
import EmbedGeneratorPanel from "../components/EmbedGeneratorPanel";
import { exportVotesToCSV, downloadCSV } from "../utils/exportVotesToCSV";

interface Class {
  id: UUID;
  name: string;
  teacher_id: UUID;
  join_code: string;
}

export default function TeacherDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<UUID | null>(null);
  const [leaderboard, setLeaderboard] = useState<StudentScore[]>([]);
  const [matchups, setMatchups] = useState<BracketMatchup[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [classBrackets, setClassBrackets] = useState<StudentBracket[]>([]);
  const [allPicks, setAllPicks] = useState<StudentPick[]>([]);
  const [masterResults, setMasterResults] = useState<MasterResult[]>([]);
  const [teacherBrackets, setTeacherBrackets] = useState<StudentBracket[]>([]);
  const [teacherPicks, setTeacherPicks] = useState<StudentPick[]>([]);
  const [newClassName, setNewClassName] = useState("");
  const [generatedJoinCode, setGeneratedJoinCode] = useState<string | null>(
    null,
  );
  const [classStudents, setClassStudents] = useState<
    Array<{
      id: UUID;
      name: string;
      username: string;
      auth_email?: string;
      created_at?: string;
    }>
  >([]);
  const [deletingStudentId, setDeletingStudentId] = useState<UUID | null>(null);
  const [showDeleteConfirmer, setShowDeleteConfirmer] = useState<UUID | null>(
    null,
  );
  const [resetPwStudentId, setResetPwStudentId] = useState<UUID | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [resetPwConfirmerValue, setResetPwConfirmerValue] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [studentActionStatus, setStudentActionStatus] = useState<
    Record<string, { type: "success" | "error"; message: string }>
  >({});
  const [votingGates, setVotingGates] = useState<ClassMatchupVoting[]>([]);
  const [classVotes, setClassVotes] = useState<StudentVote[]>([]);
  const [expandedMatchupId, setExpandedMatchupId] = useState<string | null>(
    null,
  );
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackList, setFeedbackList] = useState<
    Array<{ id: string; message: string; created_at: string }>
  >([]);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    class: true,
    voting: true,
    results: false,
    tools: false,
  });
  const [showStudents, setShowStudents] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const loadFeedback = async () => {
    if (!user?.id) return;
    const { data } = await supabase.supabase
      .from("teacher_feedback")
      .select("id, message, created_at")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    setFeedbackList(
      (data as Array<{ id: string; message: string; created_at: string }>) ||
        [],
    );
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      navigate("/login", { replace: true });
      return;
    }

    const checkTeacherProfile = async () => {
      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (teacherError) {
        setError(teacherError.message || "Failed to check teacher profile");
        setLoading(false);
        return;
      }

      if (!teacherData) {
        setLoading(false);
        navigate("/login", { replace: true, state: { teacherOnly: true } });
        return;
      }

      loadData();
      loadFeedback();
    };

    checkTeacherProfile();
  }, [user, navigate]);

  useEffect(() => {
    if (selectedClassId && activeSeason) {
      loadClassLeaderboard();
      loadClassStudents();
    }
  }, [selectedClassId, activeSeason]);

  const loadClassStudents = async () => {
    if (!selectedClassId) return;

    const client = supabase.supabase;
    const {
      data: { session },
      error: sessErr,
    } = await client.auth.getSession();
    console.log("teacher diag: session err", sessErr);
    console.log("teacher diag: session exists", !!session);
    console.log(
      "teacher diag: access token prefix",
      session?.access_token?.slice(0, 20),
    );
    const { data: userData, error: userErr } = await client.auth.getUser();
    console.log("teacher diag: getUser err", userErr);
    console.log("teacher diag: getUser id", userData?.user?.id);
    if (session?.access_token) {
      const [h, p] = session.access_token.split(".");
      const header = JSON.parse(atob(h.replace(/-/g, "+").replace(/_/g, "/")));
      const payload = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
      console.log("teacher diag: jwt alg", header?.alg);
      console.log("teacher diag: jwt iss", payload?.iss);
      console.log("teacher diag: jwt aud", payload?.aud);
    }
    if (!session?.access_token) {
      setError("No active session token. Please log in again.");
      return;
    }
    console.log(
      "teacher invoke",
      "list-class-students",
      "token prefix",
      session.access_token.slice(0, 16),
    );
    const { data, error: fnError } = await supabase.supabase.functions.invoke(
      "list-class-students",
      {
        body: { class_id: selectedClassId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      },
    );
    if (!fnError) {
      const payload = data as {
        students?: Array<{ id: string; name: string; username: string }>;
      } | null;
      const list = payload?.students ?? [];
      setClassStudents(
        list as Array<{
          id: UUID;
          name: string;
          username: string;
          auth_email?: string;
          created_at?: string;
        }>,
      );
      return;
    }
    setError(fnError.message ?? "Failed to load students");
  };

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch all seasons
      const { data: seasonsData, error: seasonsError } = await supabase
        .from("seasons")
        .select("*");

      if (seasonsError) throw seasonsError;
      if (!seasonsData) throw new Error("No seasons found");

      const active = resolveActiveSeason(seasonsData as Season[]);
      if (!active) {
        setError("No active season found");
        setLoading(false);
        return;
      }

      setActiveSeason(active);

      // Fetch teacher's classes
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", user.id);

      if (classesError) throw classesError;
      setClasses((classesData || []) as Class[]);

      if (classesData && classesData.length > 0) {
        setSelectedClassId(classesData[0].id);
      }

      // Fetch all students across all teacher classes
      const classIds = (classesData || []).map((c: Class) => c.id);
      if (classIds.length > 0) {
        const { data: allStudentsData, error: allStudentsError } =
          await supabase.from("students").select("id").in("class_id", classIds);

        if (allStudentsError) throw allStudentsError;
        const allStudentIds = (allStudentsData || []).map((s: any) => s.id);

        // Fetch all student brackets for those students for active season
        if (allStudentIds.length > 0) {
          const { data: teacherBracketsData, error: teacherBracketsError } =
            await supabase
              .from("student_brackets")
              .select("*")
              .eq("season_id", active.id)
              .in("student_id", allStudentIds);

          if (teacherBracketsError) throw teacherBracketsError;
          setTeacherBrackets((teacherBracketsData || []) as StudentBracket[]);

          // Fetch all student picks for those brackets
          const teacherBracketIds = (teacherBracketsData || []).map(
            (b: any) => b.id,
          );
          if (teacherBracketIds.length > 0) {
            const { data: teacherPicksData, error: teacherPicksError } =
              await supabase
                .from("student_picks")
                .select("*")
                .in("student_bracket_id", teacherBracketIds);

            if (teacherPicksError) throw teacherPicksError;
            setTeacherPicks((teacherPicksData || []) as StudentPick[]);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadClassLeaderboard = async () => {
    if (!selectedClassId || !activeSeason) return;

    try {
      setError(null);

      // Fetch master results
      const { data: masterResultsData, error: masterResultsError } =
        await supabase
          .from("master_results")
          .select("*")
          .eq("season_id", activeSeason.id);

      if (masterResultsError) throw masterResultsError;
      const masterResults = (masterResultsData || []) as MasterResult[];
      setMasterResults(masterResults);

      // Fetch bracket matchups
      const { data: matchupsData, error: matchupsError } = await supabase
        .from("bracket_matchups")
        .select("*")
        .eq("season_id", activeSeason.id);

      if (matchupsError) throw matchupsError;
      const matchupsDataTyped = (matchupsData || []) as BracketMatchup[];
      setMatchups(matchupsDataTyped);

      // Fetch songs for active season
      const { data: songsData, error: songsError } = await supabase
        .from("songs")
        .select("*")
        .eq("season_id", activeSeason.id);

      if (songsError) throw songsError;
      setSongs((songsData || []) as Song[]);

      // Fetch all students in the class
      const { data: classStudentsData, error: classStudentsError } =
        await supabase
          .from("students")
          .select("id, username")
          .eq("class_id", selectedClassId);

      if (classStudentsError) throw classStudentsError;
      const studentNames = new Map<UUID, string>();
      (classStudentsData || []).forEach((s: any) => {
        studentNames.set(s.id, s.username);
      });

      // Fetch all student brackets for the class
      const { data: classBracketsData, error: classBracketsError } =
        await supabase
          .from("student_brackets")
          .select("*")
          .eq("season_id", activeSeason.id)
          .in("student_id", Array.from(studentNames.keys()));

      if (classBracketsError) throw classBracketsError;
      const classBracketsDataTyped = (classBracketsData ||
        []) as StudentBracket[];
      setClassBrackets(classBracketsDataTyped);

      // Fetch all student picks for these brackets
      const bracketIds = classBracketsDataTyped.map((b) => b.id);
      const { data: allPicksData, error: allPicksError } = await supabase
        .from("student_picks")
        .select("*")
        .in("student_bracket_id", bracketIds);

      if (allPicksError) throw allPicksError;
      const allPicksDataTyped = (allPicksData || []) as StudentPick[];
      setAllPicks(allPicksDataTyped);

      // Compute scores and leaderboard
      const scores = computePerStudentScores(
        classBracketsDataTyped,
        allPicksDataTyped,
        masterResults,
        matchupsDataTyped,
        studentNames,
      );
      const sortedLeaderboard = createLeaderboard(scores);
      setLeaderboard(sortedLeaderboard);

      const { data: gatesData, error: gatesError } = await supabase
        .from("class_matchup_voting")
        .select("*")
        .eq("class_id", selectedClassId)
        .eq("season_id", activeSeason.id);
      if (!gatesError)
        setVotingGates((gatesData || []) as ClassMatchupVoting[]);

      const { data: votesData, error: votesError } = await supabase
        .from("student_votes")
        .select("*")
        .eq("class_id", selectedClassId)
        .eq("season_id", activeSeason.id);
      if (!votesError) setClassVotes((votesData || []) as StudentVote[]);
    } catch (err: any) {
      setError(err.message || "Failed to load leaderboard");
    }
  };

  const openVoting = async (bracketMatchupId: UUID) => {
    if (!selectedClassId || !activeSeason || !user) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from("class_matchup_voting").upsert(
      {
        season_id: activeSeason.id,
        class_id: selectedClassId,
        bracket_matchup_id: bracketMatchupId,
        is_open: true,
        opened_by: user.id,
        opened_at: now,
        closed_at: null,
        updated_at: now,
      },
      { onConflict: "season_id,class_id,bracket_matchup_id" },
    );
    if (!error) await loadClassLeaderboard();
    else setError(error.message);
  };

  const closeVoting = async (bracketMatchupId: UUID) => {
    if (!selectedClassId || !activeSeason) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("class_matchup_voting")
      .update({ is_open: false, closed_at: now, updated_at: now })
      .eq("class_id", selectedClassId)
      .eq("season_id", activeSeason.id)
      .eq("bracket_matchup_id", bracketMatchupId);
    if (!error) await loadClassLeaderboard();
    else setError(error.message);
  };

  const deleteStudentVote = async (studentId: UUID, bracketMatchupId: UUID) => {
    if (!selectedClassId || !activeSeason) return;
    const { error } = await supabase
      .from("student_votes")
      .delete()
      .eq("student_id", studentId)
      .eq("bracket_matchup_id", bracketMatchupId)
      .eq("class_id", selectedClassId)
      .eq("season_id", activeSeason.id);
    if (!error) await loadClassLeaderboard();
    else setError(error.message);
  };

  const renderPanel = (
    id: string,
    title: string,
    content: React.ReactNode,
  ) => {
    const isOpen = openPanels[id] ?? false;
    return (
      <div
        key={id}
        style={{
          border: "1px solid #E5E7EB",
          borderRadius: "8px",
          backgroundColor: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setOpenPanels((p) => ({ ...p, [id]: !p[id] }))
          }
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            border: "none",
            backgroundColor: "#FFFFFF",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: 600,
            color: "#111827",
            textAlign: "left",
          }}
        >
          {title}
          <span style={{ fontSize: "14px", color: "#6B7280" }}>
            {isOpen ? "▾" : "▸"}
          </span>
        </button>
        {isOpen && (
          <div style={{ padding: "0 18px 18px", borderTop: "1px solid #E5E7EB" }}>
            {content}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  if (error && !activeSeason) {
    return <div>Erreur : {error}</div>;
  }

  if (!activeSeason) {
    return <div>No active season</div>;
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "24px" }}>
      <h1>Tableaumanie Teacher - {activeSeason.name}</h1>
      {error && <div>Erreur : {error}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {renderPanel(
          "class",
          "Ma classe",
          <>
            <div
              style={{
                display: "flex",
                gap: "24px",
                flexWrap: "wrap",
                marginBottom: "16px",
              }}
            >
        {/* Select Class Card */}
        <div
          style={{
            padding: "20px",
            border: "1px solid #E5E7EB",
            borderRadius: "8px",
            backgroundColor: "#FFFFFF",
            minWidth: "300px",
            flex: 1,
          }}
        >
          <label
            style={{
              display: "block",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "8px",
              fontSize: "14px",
            }}
          >
            Choisir une classe
          </label>
          <select
            value={selectedClassId || ""}
            onChange={(e) => {
              setSelectedClassId(e.target.value as UUID);
              setGeneratedJoinCode(null);
            }}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
              backgroundColor: "#FFFFFF",
              color: "#111827",
              fontSize: "14px",
              cursor: "pointer",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#7C3AED";
              e.target.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.1)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#D1D5DB";
              e.target.style.boxShadow = "none";
            }}
          >
            <option value="">-- Choisir une classe --</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
          {selectedClassId &&
            (() => {
              const selectedClass = classes.find(
                (c) => c.id === selectedClassId,
              );
              return selectedClass?.join_code ? (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    backgroundColor: "#F0FDF4",
                    border: "1px solid #86EFAC",
                    borderRadius: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#166534",
                          marginBottom: "4px",
                        }}
                      >
                        Code d’accès : {selectedClass.join_code}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#15803D",
                          marginTop: "4px",
                        }}
                      >
                        Partager ce code avec les élèves pour qu’ils rejoignent
                        la classe
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        marginTop: "4px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !selectedClassId ||
                            !window.confirm(
                              "Générer un nouveau code ? L'ancien ne fonctionnera plus.",
                            )
                          )
                            return;
                          try {
                            const {
                              data: { session },
                            } = await supabase.supabase.auth.getSession();
                            if (!session?.access_token) {
                              setError(
                                "No active session. Please log in again.",
                              );
                              return;
                            }
                            console.log(
                              "teacher invoke",
                              "reset-class-code",
                              "token prefix",
                              session.access_token.slice(0, 16),
                            );
                            const { data, error: fnError } =
                              await supabase.supabase.functions.invoke(
                                "reset-class-code",
                                {
                                  body: { class_id: selectedClassId },
                                  headers: {
                                    Authorization: `Bearer ${session.access_token}`,
                                    apikey: import.meta.env
                                      .VITE_SUPABASE_ANON_KEY,
                                  },
                                },
                              );
                            if (fnError) throw fnError;
                            const result = data as {
                              success?: boolean;
                              join_code?: string;
                            } | null;
                            if (result?.success && result?.join_code) {
                              setClasses((prev) =>
                                prev.map((c) =>
                                  c.id === selectedClassId
                                    ? { ...c, join_code: result.join_code! }
                                    : c,
                                ),
                              );
                              setGeneratedJoinCode(null);
                            }
                          } catch (err) {
                            setError(
                              err instanceof Error
                                ? err.message
                                : "Failed to reset join code",
                            );
                          }
                        }}
                        style={{
                          padding: "6px 12px",
                          fontSize: "13px",
                          fontWeight: "500",
                          color: "#166534",
                          backgroundColor: "#DCFCE7",
                          border: "1px solid #86EFAC",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Réinitialiser le code de la classe
                      </button>
                    </div>
                  </div>
                </div>
              ) : null;
            })()}
        </div>

        {/* Create New Class Card */}
        <div
          style={{
            padding: "20px",
            border: "1px solid #E5E7EB",
            borderRadius: "8px",
            backgroundColor: "#FFFFFF",
            minWidth: "300px",
            flex: 1,
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: "16px",
              fontWeight: "600",
              color: "#374151",
              fontSize: "16px",
            }}
          >
            Créer une nouvelle classe
          </h3>
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="Nom de la classe"
            required
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
              backgroundColor: "#FFFFFF",
              color: "#111827",
              fontSize: "14px",
              marginBottom: "12px",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={async () => {
              if (!newClassName.trim() || !user) return;

              // Generate 6 uppercase random letters
              const generateJoinCode = () => {
                const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
                let code = "";
                for (let i = 0; i < 6; i++) {
                  code += letters.charAt(
                    Math.floor(Math.random() * letters.length),
                  );
                }
                return code;
              };

              const joinCode = generateJoinCode();

              try {
                const { data: newClass, error } = await supabase
                  .from("classes")
                  .insert({
                    name: newClassName.trim(),
                    teacher_id: user.id,
                    join_code: joinCode,
                  })
                  .select()
                  .single();

                if (error) throw error;

                // Refresh class list
                const { data: classesData, error: classesError } =
                  await supabase
                    .from("classes")
                    .select("*")
                    .eq("teacher_id", user.id);

                if (classesError) throw classesError;
                setClasses((classesData || []) as Class[]);

                // Auto-select newly created class
                if (newClass) {
                  setSelectedClassId(newClass.id);
                }

                // Store and display join code, clear input
                setGeneratedJoinCode(joinCode);
                setNewClassName("");
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Impossible de créer la classe.",
                );
              }
            }}
            disabled={!newClassName.trim()}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#7C3AED",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: newClassName.trim() ? "pointer" : "not-allowed",
              opacity: newClassName.trim() ? 1 : 0.5,
              boxSizing: "border-box",
            }}
          >
            Créer
          </button>
          {generatedJoinCode && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                backgroundColor: "#F0FDF4",
                border: "1px solid #86EFAC",
                borderRadius: "6px",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#166534",
                  marginBottom: "4px",
                }}
              >
                Code d’accès : {generatedJoinCode}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#15803D",
                  marginTop: "4px",
                }}
              >
                Partage ce code avec les élèves pour qu’ils rejoignent la classe
              </div>
            </div>
          )}
        </div>
            </div>
            <button
              type="button"
              onClick={() => setShowStudents((s) => !s)}
              style={{
                padding: "8px 12px",
                marginBottom: "12px",
                fontSize: "14px",
                fontWeight: 500,
                color: "#374151",
                backgroundColor: "#F3F4F6",
                border: "1px solid #D1D5DB",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {showStudents ? "▾" : "▸"} Gérer les élèves
            </button>
            {showStudents && selectedClassId && (
        <>
          {/* Students in this Class */}
          <div
            style={{
              marginBottom: "32px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
            }}
          >
            <h2
              style={{
                color: "#7C3AED",
                marginTop: "0",
                marginBottom: "16px",
                fontSize: "20px",
                fontWeight: "600",
              }}
            >
              Élèves de cette classe
            </h2>
            {classStudents.length === 0 ? (
              <p style={{ color: "#6B7280", margin: 0 }}>
                Aucun élève dans cette classe pour le moment.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                }}
              >
                {classStudents.map((student) => (
                  <div
                    key={student.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      padding: "12px",
                      border: "1px solid #E5E7EB",
                      borderRadius: "6px",
                      backgroundColor: "#F9FAFB",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ minWidth: 0, textAlign: "left" }}>
                        <div
                          style={{
                            fontWeight: "600",
                            color: "#111827",
                            margin: 0,
                            marginBottom: "4px",
                          }}
                        >
                          {student.name}
                        </div>
                        <div
                          style={{
                            fontSize: "14px",
                            color: "#6B7280",
                            margin: 0,
                          }}
                        >
                          {student.username}
                        </div>
                      </div>
                      {resetPwStudentId === student.id ? (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: "8px",
                          }}
                        >
                          <input
                            type="password"
                            placeholder="Nouveau mot de passe"
                            value={resetPwValue}
                            onChange={(e) => setResetPwValue(e.target.value)}
                            style={{
                              padding: "6px 10px",
                              fontSize: "14px",
                              border: "1px solid #D1D5DB",
                              borderRadius: "4px",
                              minWidth: "160px",
                            }}
                          />
                          <input
                            type="password"
                            placeholder="Confirmerer le mot de passe"
                            value={resetPwConfirmerValue}
                            onChange={(e) =>
                              setResetPwConfirmerValue(e.target.value)
                            }
                            style={{
                              padding: "6px 10px",
                              fontSize: "14px",
                              border: "1px solid #D1D5DB",
                              borderRadius: "4px",
                              minWidth: "160px",
                            }}
                          />
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={async () => {
                                if (resetPwValue.length < 8) {
                                  setStudentActionStatus((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      type: "error",
                                      message:
                                        "Password must be at least 8 characters",
                                    },
                                  }));
                                  return;
                                }
                                if (resetPwValue !== resetPwConfirmerValue) {
                                  setStudentActionStatus((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      type: "error",
                                      message: "Passwords do not match",
                                    },
                                  }));
                                  return;
                                }
                                const {
                                  data: { session },
                                } = await supabase.supabase.auth.getSession();
                                if (!session?.access_token) {
                                  setStudentActionStatus((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      type: "error",
                                      message:
                                        "No active session. Please log in again.",
                                    },
                                  }));
                                  return;
                                }
                                setResettingPw(true);
                                try {
                                  const { data, error: fnError } =
                                    await supabase.supabase.functions.invoke(
                                      "reset-student-password",
                                      {
                                        body: {
                                          student_id: student.id,
                                          new_password: resetPwValue,
                                        },
                                        headers: {
                                          Authorization: `Bearer ${session.access_token}`,
                                          apikey: import.meta.env
                                            .VITE_SUPABASE_ANON_KEY,
                                        },
                                      },
                                    );
                                  if (fnError) throw fnError;
                                  const result = data as {
                                    success?: boolean;
                                    error?: string;
                                  } | null;
                                  if (result?.error)
                                    throw new Error(result.error);
                                  setStudentActionStatus((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      type: "success",
                                      message: "Mot de passe mis à jour",
                                    },
                                  }));
                                  setResetPwStudentId(null);
                                  setResetPwValue("");
                                  setResetPwConfirmerValue("");
                                  setTimeout(() => {
                                    setStudentActionStatus((prev) => {
                                      const next = { ...prev };
                                      delete next[student.id];
                                      return next;
                                    });
                                  }, 4000);
                                } catch (err) {
                                  setStudentActionStatus((prev) => ({
                                    ...prev,
                                    [student.id]: {
                                      type: "error",
                                      message:
                                        err instanceof Error
                                          ? err.message
                                          : "Failed to reset password",
                                    },
                                  }));
                                }
                                setResettingPw(false);
                              }}
                              disabled={resettingPw}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#7C3AED",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "14px",
                                cursor: resettingPw ? "not-allowed" : "pointer",
                                opacity: resettingPw ? 0.5 : 1,
                              }}
                            >
                              Confirmer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setResetPwStudentId(null);
                                setResetPwValue("");
                                setResetPwConfirmerValue("");
                                setStudentActionStatus((prev) => {
                                  const next = { ...prev };
                                  delete next[student.id];
                                  return next;
                                });
                              }}
                              disabled={resettingPw}
                              style={{
                                padding: "6px 12px",
                                backgroundColor: "#E5E7EB",
                                color: "#374151",
                                border: "none",
                                borderRadius: "4px",
                                fontSize: "14px",
                                cursor: resettingPw ? "not-allowed" : "pointer",
                              }}
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : showDeleteConfirmer === student.id ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: "14px", color: "#DC2626" }}>
                            Supprimer ?
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              setDeletingStudentId(student.id);
                              try {
                                const {
                                  data: { session },
                                } = await supabase.supabase.auth.getSession();
                                if (!session?.access_token) {
                                  setError(
                                    "No active session. Please log in again.",
                                  );
                                  setDeletingStudentId(null);
                                  return;
                                }
                                console.log(
                                  "teacher invoke",
                                  "delete-student",
                                  "token prefix",
                                  session.access_token.slice(0, 16),
                                );
                                const { data, error: fnError } =
                                  await supabase.supabase.functions.invoke(
                                    "delete-student",
                                    {
                                      body: { student_id: student.id },
                                      headers: {
                                        Authorization: `Bearer ${session.access_token}`,
                                        apikey: import.meta.env
                                          .VITE_SUPABASE_ANON_KEY,
                                      },
                                    },
                                  );
                                if (fnError) throw fnError;
                                const result = data as {
                                  success?: boolean;
                                  error?: string;
                                } | null;
                                if (result?.error)
                                  throw new Error(result.error);
                                await loadClassStudents();
                                setShowDeleteConfirmer(null);
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Failed to delete student",
                                );
                              }
                              setDeletingStudentId(null);
                            }}
                            disabled={deletingStudentId === student.id}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#DC2626",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "14px",
                              cursor:
                                deletingStudentId === student.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                deletingStudentId === student.id ? 0.5 : 1,
                            }}
                          >
                            Confirmer
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirmer(null)}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#E5E7EB",
                              color: "#374151",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "14px",
                              cursor: "pointer",
                            }}
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            alignItems: "center",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setResetPwStudentId(student.id);
                              setResetPwValue("");
                              setResetPwConfirmerValue("");
                              setStudentActionStatus((prev) => {
                                const next = { ...prev };
                                delete next[student.id];
                                return next;
                              });
                            }}
                            disabled={resetPwStudentId !== null}
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#7C3AED",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "14px",
                              cursor:
                                resetPwStudentId !== null
                                  ? "not-allowed"
                                  : "pointer",
                              opacity: resetPwStudentId !== null ? 0.5 : 1,
                            }}
                          >
                            Réinitialiser le mot de passe
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirmer(student.id)}
                            disabled={
                              deletingStudentId !== null ||
                              resetPwStudentId !== null
                            }
                            style={{
                              padding: "6px 12px",
                              backgroundColor: "#EF4444",
                              color: "#FFFFFF",
                              border: "none",
                              borderRadius: "4px",
                              fontSize: "14px",
                              cursor:
                                deletingStudentId !== null ||
                                resetPwStudentId !== null
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                deletingStudentId !== null ||
                                resetPwStudentId !== null
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                    {studentActionStatus[student.id] && (
                      <div
                        style={{
                          fontSize: "13px",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          backgroundColor:
                            studentActionStatus[student.id].type === "success"
                              ? "#DCFCE7"
                              : "#FEE2E2",
                          color:
                            studentActionStatus[student.id].type === "success"
                              ? "#166534"
                              : "#991B1B",
                        }}
                      >
                        {studentActionStatus[student.id].message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
          </>)}
        {renderPanel(
          "voting",
          "Votes en direct",
          selectedClassId &&
            activeSeason &&
            matchups.length > 0 && (
        <>
          {/* Live Voting */}
          {matchups.length > 0 && (
            <div
              style={{
                marginBottom: "32px",
                padding: "20px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                backgroundColor: "#FFFFFF",
              }}
            >
              <h2
                style={{
                  color: "#7C3AED",
                  marginTop: 0,
                  marginBottom: "16px",
                  fontSize: "20px",
                  fontWeight: 600,
                }}
              >
                Votes en direct
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6B7280",
                  marginBottom: "16px",
                }}
              >
                Ouvre ou ferme un match pour les votes en direct. Les élèves
                votent dans le lobby.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {matchups
                  .sort((a, b) => a.matchup_number - b.matchup_number)
                  .map((matchup) => {
                    const gate = votingGates.find(
                      (g) => g.bracket_matchup_id === matchup.id,
                    );
                    const isOpen = gate?.is_open ?? false;
                    const votesForMatchup = classVotes.filter(
                      (v) => v.bracket_matchup_id === matchup.id,
                    );
                    const totalVotes = votesForMatchup.length;
                    const songCounts = votesForMatchup.reduce<
                      Record<string, number>
                    >((acc, v) => {
                      acc[v.picked_song_id] = (acc[v.picked_song_id] || 0) + 1;
                      return acc;
                    }, {});
                    const participation =
                      classStudents.length > 0
                        ? `${totalVotes}/${classStudents.length}`
                        : "0/0";
                    const optionSongIds = isOpen
                      ? matchup.round === 1 &&
                        (matchup.song1_id || matchup.song2_id)
                        ? ([matchup.song1_id, matchup.song2_id].filter(
                            Boolean,
                          ) as UUID[])
                        : getValidMasterOptionsForMatchup(
                            matchup,
                            matchups,
                            masterResults,
                          )
                      : [];
                    const songLabels = optionSongIds
                      .map((id) => {
                        const s = songs.find((x) => x.id === id);
                        return s ? `« ${s.title} » – ${s.artist}` : "";
                      })
                      .filter(Boolean);
                    const isExpanded = expandedMatchupId === matchup.id;
                    return (
                      <div
                        key={matchup.id}
                        style={{
                          padding: "12px 16px",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          backgroundColor: "#F9FAFB",
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "12px",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ flex: "1 1 200px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              flexWrap: "wrap",
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "#111827" }}>
                              Match {matchup.matchup_number}
                            </div>
                            <span
                              style={{
                                fontSize: "12px",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                backgroundColor: isOpen ? "#DCFCE7" : "#FEE2E2",
                                color: isOpen ? "#166534" : "#991B1B",
                                fontWeight: 500,
                              }}
                            >
                              {isOpen ? "Ouvert" : "Fermé"}
                            </span>
                            <div
                              style={{
                                fontSize: "13px",
                                color: "#6B7280",
                                marginLeft: "4px",
                              }}
                            >
                              Participation : {participation}
                            </div>
                          </div>

                          {isExpanded && (
                            <div style={{ width: "100%", marginTop: "10px" }}>
                              {isOpen && songLabels.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#6B7280",
                                    marginBottom: "6px",
                                  }}
                                >
                                  {songLabels.join(" vs ")}
                                </div>
                              )}

                              {isOpen && totalVotes > 0 && (
                                <div
                                  style={{
                                    fontSize: "13px",
                                    color: "#6B7280",
                                    marginBottom: "8px",
                                  }}
                                >
                                  {Object.entries(songCounts).map(
                                    ([songId, count]) => {
                                      const s = songs.find(
                                        (x) => x.id === songId,
                                      );
                                      const pct =
                                        totalVotes > 0
                                          ? Math.round(
                                              (count / totalVotes) * 100,
                                            )
                                          : 0;
                                      return (
                                        <span
                                          key={songId}
                                          style={{ marginRight: "12px" }}
                                        >
                                          {s
                                            ? `${s.title}: ${count} (${pct}%)`
                                            : songId}
                                        </span>
                                      );
                                    },
                                  )}
                                </div>
                              )}

                              {isOpen && votesForMatchup.length > 0 && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#6B7280",
                                  }}
                                >
                                  {votesForMatchup.map((v) => {
                                    const stu = classStudents.find(
                                      (c) => c.id === v.student_id,
                                    );
                                    const song = songs.find(
                                      (s) => s.id === v.picked_song_id,
                                    );
                                    return (
                                      <span
                                        key={v.id}
                                        style={{
                                          marginRight: "8px",
                                          display: "inline-block",
                                        }}
                                      >
                                        {stu?.name ?? v.student_id}:{" "}
                                        {song?.title ?? v.picked_song_id}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteStudentVote(
                                              v.student_id,
                                              matchup.id,
                                            )
                                          }
                                          style={{
                                            marginLeft: "4px",
                                            fontSize: "11px",
                                            padding: "2px 6px",
                                            cursor: "pointer",
                                          }}
                                        >
                                          Supprimer le vote
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {!isOpen && (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#6B7280",
                                  }}
                                >
                                  Vote fermé.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedMatchupId((prev) =>
                                prev === matchup.id ? null : matchup.id,
                              )
                            }
                            style={{
                              padding: "6px 10px",
                              fontSize: "14px",
                              backgroundColor: "#FFFFFF",
                              color: "#374151",
                              border: "1px solid #D1D5DB",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            {isExpanded ? "Masquer" : "Détails"}
                          </button>
                          {isOpen ? (
                            <button
                              type="button"
                              onClick={() => closeVoting(matchup.id)}
                              style={{
                                padding: "6px 12px",
                                fontSize: "14px",
                                backgroundColor: "#DC2626",
                                color: "#FFF",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                              }}
                            >
                              Fermer
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openVoting(matchup.id)}
                              style={{
                                padding: "6px 12px",
                                fontSize: "14px",
                                backgroundColor: "#16A34A",
                                color: "#FFF",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                              }}
                            >
                              Ouvrir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
            )
          )}
        {renderPanel(
          "results",
          "Résultats",
          selectedClassId &&
            activeSeason && (
        <>
          {/* Section 1: Classement de la classe */}
          <div
            style={{
              marginBottom: "32px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
            }}
          >
            <div
              style={{
                maxWidth: "900px",
                margin: "0 auto",
                textAlign: "center",
              }}
            >
              <h2
                style={{
                  color: "#7C3AED",
                  marginTop: "0",
                  marginBottom: "16px",
                  fontSize: "24px",
                  fontWeight: "600",
                }}
              >
                Classement de la classe
              </h2>
              <button
                onClick={loadClassLeaderboard}
                style={{
                  marginBottom: "16px",
                  padding: "8px 16px",
                  backgroundColor: "#7C3AED",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  display: "inline-block",
                }}
              >
                Refresh Leaderboard
              </button>
              {leaderboard.length > 0 ? (
                <div style={{ overflowX: "auto", textAlign: "left" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      backgroundColor: "#FFFFFF",
                      margin: "0 auto",
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: "#374151" }}>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            color: "#FFFFFF",
                            fontWeight: "600",
                            fontSize: "14px",
                          }}
                        >
                          Rank
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            color: "#FFFFFF",
                            fontWeight: "600",
                            fontSize: "14px",
                          }}
                        >
                          Nom d'utilisateur
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            color: "#FFFFFF",
                            fontWeight: "600",
                            fontSize: "14px",
                          }}
                        >
                          Total Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((score) => (
                        <tr
                          key={score.student_id}
                          style={{
                            borderBottom: "1px solid #E5E7EB",
                          }}
                        >
                          <td
                            style={{
                              padding: "12px",
                              color: "#111827",
                              fontSize: "14px",
                            }}
                          >
                            {score.rank}
                          </td>
                          <td
                            style={{
                              padding: "12px",
                              color: "#111827",
                              fontSize: "14px",
                            }}
                          >
                            {score.student_name}
                          </td>
                          <td
                            style={{
                              padding: "12px",
                              color: "#111827",
                              fontSize: "14px",
                              fontWeight: "600",
                            }}
                          >
                            {score.total_score}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  style={{
                    padding: "16px",
                    backgroundColor: "#F9FAFB",
                    border: "1px solid #E5E7EB",
                    borderRadius: "6px",
                    color: "#6B7280",
                    fontSize: "14px",
                  }}
                >
                  No students have finalized their brackets yet.
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAnalytics((a) => !a)}
            style={{
              padding: "8px 12px",
              marginBottom: "12px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#374151",
              backgroundColor: "#F3F4F6",
              border: "1px solid #D1D5DB",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            {showAnalytics ? "▾" : "▸"} Voir les analyses
          </button>
          {showAnalytics && (
          <div
            style={{
              marginBottom: "32px",
            }}
          >
            <h2
              style={{
                color: "#7C3AED",
                marginTop: "0",
                marginBottom: "24px",
                fontSize: "24px",
                fontWeight: "600",
              }}
            >
              Analytics
            </h2>

            {masterResults.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  backgroundColor: "#F9FAFB",
                  border: "2px solid #E5E7EB",
                  borderRadius: "6px",
                  color: "#374151",
                  fontSize: "14px",
                  lineHeight: "1.5",
                }}
              >
                No master results available yet. Master bracket winners must be
                set before analytics can be displayed.
              </div>
            ) : (
              <>
                {/* Card A: All Classes Combined */}
                {activeSeason && matchups.length > 0 && (
                  <div
                    style={{
                      marginBottom: "24px",
                      padding: "20px",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "900px",
                        margin: "0 auto",
                        textAlign: "center",
                      }}
                    >
                      <h3
                        style={{
                          color: "#7C3AED",
                          marginTop: "0",
                          marginBottom: "20px",
                          fontSize: "18px",
                          fontWeight: "600",
                        }}
                      >
                        All Classes Combined
                      </h3>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(300px, 1fr))",
                          gap: "20px",
                        }}
                      >
                        {[1, 2, 3, 4].map((round) => (
                          <RoundAccuracyPie
                            key={round}
                            round={round}
                            classStudentBrackets={teacherBrackets}
                            allStudentPicks={teacherPicks}
                            masterResults={masterResults}
                            allMatchups={matchups}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Card B: Selected Class */}
                {selectedClassId && (
                  <div
                    style={{
                      padding: "20px",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      backgroundColor: "#FFFFFF",
                    }}
                  >
                    <h3
                      style={{
                        color: "#7C3AED",
                        marginTop: "0",
                        marginBottom: "20px",
                        fontSize: "18px",
                        fontWeight: "600",
                      }}
                    >
                      Class:{" "}
                      {classes.find((c) => c.id === selectedClassId)?.name ||
                        "Selected Class"}
                    </h3>

                    {/* Round Accuracy Charts */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(300px, 1fr))",
                        gap: "20px",
                        marginBottom: "32px",
                      }}
                    >
                      {Array.from(new Set(matchups.map((m) => m.round)))
                        .sort((a, b) => a - b)
                        .map((round) => (
                          <RoundAccuracyPie
                            key={round}
                            round={round}
                            classStudentBrackets={classBrackets}
                            allStudentPicks={allPicks}
                            masterResults={masterResults}
                            allMatchups={matchups}
                          />
                        ))}
                    </div>

                    {/* Divider */}
                    <div
                      style={{
                        borderTop: "1px solid #E5E7EB",
                        marginBottom: "24px",
                      }}
                    />

                    {/* Prediction Distribution Subsection */}
                    <div>
                      <h4
                        style={{
                          color: "#374151",
                          marginTop: "0",
                          marginBottom: "20px",
                          fontSize: "16px",
                          fontWeight: "600",
                        }}
                      >
                        Répartition des pronos par match
                      </h4>
                      {Array.from(new Set(matchups.map((m) => m.round)))
                        .sort((a, b) => a - b)
                        .map((round) => {
                          const roundMatchups = matchups.filter(
                            (m) => m.round === round,
                          );
                          return (
                            <div key={round} style={{ marginBottom: "24px" }}>
                              {roundMatchups.map((matchup) => (
                                <div
                                  key={matchup.id}
                                  style={{ marginBottom: "20px" }}
                                >
                                  <h5
                                    style={{
                                      color: "#374151",
                                      marginBottom: "12px",
                                      fontSize: "14px",
                                      fontWeight: "600",
                                    }}
                                  >
                                    Match {matchup.matchup_number}
                                  </h5>
                                  <PredictionDistributionPie
                                    matchupId={matchup.id}
                                    classStudentBrackets={classBrackets}
                                    allStudentPicks={allPicks}
                                    songs={songs}
                                  />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </>
            )
          )}
        {renderPanel(
          "tools",
          "Outils",
          <>
          {/* Section 3: Export Data */}
          <div
            style={{
              marginBottom: "32px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              backgroundColor: "#FFFFFF",
            }}
          >
            <div
              style={{
                maxWidth: "900px",
                margin: "0 auto",
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  color: "#7C3AED",
                  marginTop: "0",
                  marginBottom: "16px",
                  fontSize: "18px",
                  fontWeight: "600",
                }}
              >
                Export Data
              </h3>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <button
                  onClick={() => {
                    if (activeSeason && selectedClassId) {
                      const csv = exportVotesToCSV(
                        classBrackets,
                        allPicks,
                        matchups,
                        songs,
                        classes.find((c) => c.id === selectedClassId)?.name,
                      );
                      downloadCSV(
                        csv,
                        `bracket-votes-${classes.find((c) => c.id === selectedClassId)?.name || "class"}-${activeSeason.name}.csv`,
                      );
                    }
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#7C3AED",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  Exporter les votes (CSV)
                </button>
                <button
                  onClick={() => {
                    if (activeSeason) {
                      const csv = exportVotesToCSV(
                        teacherBrackets,
                        teacherPicks,
                        matchups,
                        songs,
                        "All Classes",
                      );
                      downloadCSV(
                        csv,
                        `bracket-votes-all-classes-${activeSeason.name}.csv`,
                      );
                    }
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#7C3AED",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                  }}
                >
                  Export All Classes Votes (CSV)
                </button>
              </div>

              <div
                style={{
                  height: "1px",
                  backgroundColor: "#E5E7EB",
                  margin: "20px 0",
                }}
              />

              <div>
                <h4
                  style={{
                    marginBottom: "12px",
                    color: "#374151",
                    fontWeight: 600,
                    fontSize: "16px",
                  }}
                >
                  Printable Resources
                </h4>
                <a
                  href="/manie-musicale-2026-bracket.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ textDecoration: "none" }}
                >
                  <button
                    style={{
                      backgroundColor: "#FFFFFF",
                      color: "#7C3AED",
                      border: "1px solid #7C3AED",
                      borderRadius: "6px",
                      padding: "10px 16px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500",
                    }}
                  >
                    Ouvrir le tableau vierge (PDF)
                  </button>
                </a>
              </div>
            </div>
          </div>

          {/* Section 4: Embed Generator */}
          {activeSeason && (
            <div
              style={{
                padding: "20px",
                border: "1px solid #E5E7EB",
                borderRadius: "8px",
                backgroundColor: "#F9FAFB",
              }}
            >
              <h3
                style={{
                  color: "#6B7280",
                  marginTop: "0",
                  marginBottom: "12px",
                  fontSize: "16px",
                  fontWeight: "500",
                }}
              >
                Intégration iframe (optionnel)
              </h3>
              <EmbedGeneratorPanel seasonId={activeSeason.id} />
            </div>
          )}
          {/* Commentaires pour le développeur */}
          <div
            style={{
              marginTop: "16px",
              padding: "20px",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              backgroundColor: "#F9FAFB",
            }}
          >
            <h3
              style={{
                color: "#6B7280",
                marginTop: 0,
                marginBottom: "12px",
                fontSize: "16px",
                fontWeight: 500,
              }}
            >
              Commentaires pour le développeur
            </h3>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Votre problème ou suggestion..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #D1D5DB",
                borderRadius: "8px",
                fontSize: "14px",
                boxSizing: "border-box",
                marginBottom: "8px",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              disabled={!feedbackMessage.trim() || feedbackSubmitting}
              onClick={async () => {
                if (!user?.id || !feedbackMessage.trim() || feedbackSubmitting)
                  return;
                setFeedbackSubmitting(true);
                setError(null);
                const client = supabase.supabase as unknown as {
                  from: (table: string) => {
                    insert: (
                      values: object,
                    ) => Promise<{ error: { message: string } | null }>;
                  };
                };
                const { error: insertErr } = await client
                  .from("teacher_feedback")
                  .insert({
                    teacher_id: user.id,
                    season_id: activeSeason?.id ?? null,
                    message: feedbackMessage.trim(),
                  });
                setFeedbackSubmitting(false);
                if (insertErr) {
                  setError(insertErr.message);
                  return;
                }
                setFeedbackMessage("");
                loadFeedback();
              }}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 600,
                backgroundColor: "#7C3AED",
                color: "#FFF",
                border: "none",
                borderRadius: "6px",
                cursor:
                  feedbackMessage.trim() && !feedbackSubmitting
                    ? "pointer"
                    : "not-allowed",
                opacity: feedbackMessage.trim() && !feedbackSubmitting ? 1 : 0.6,
              }}
            >
              {feedbackSubmitting ? "Envoi..." : "Envoyer"}
            </button>
            {feedbackList.length > 0 && (
              <div
                style={{ marginTop: "16px", fontSize: "14px", color: "#374151" }}
              >
                <div style={{ fontWeight: 600, marginBottom: "8px" }}>
                  Vos derniers messages
                </div>
                {feedbackList.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      marginBottom: "8px",
                      padding: "8px",
                      backgroundColor: "#FFFFFF",
                      borderRadius: "6px",
                      border: "1px solid #E5E7EB",
                    }}
                  >
                    <div style={{ marginBottom: "4px" }}>{f.message}</div>
                    <div style={{ fontSize: "12px", color: "#6B7280" }}>
                      {new Date(f.created_at).toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>)}
      </div>
    </div>
  );
}
