import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface StudentSession {
  type: 'student';
  student_id: string;
  class_id: string;
}

interface AuthContextType {
  user: any;
  session: any;
  studentSession: StudentSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Load student session when user changes
  useEffect(() => {
    let cancelled = false;

    const updateStudentSession = async () => {
      if (!user?.id) {
        if (!cancelled) setStudentSession(null);
        return;
      }

      // Check if user email ends with @class.student to identify student
      const email = user.email || '';
      if (!email.endsWith('@class.student')) {
        if (!cancelled) setStudentSession(null);
        return;
      }

      // Load student data
      const { data: studentData } = await supabase
        .from('students')
        .select('id, class_id')
        .eq('id', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (studentData) {
        setStudentSession({
          type: 'student',
          student_id: studentData.id,
          class_id: studentData.class_id,
        });
      } else {
        setStudentSession(null);
      }
    };

    updateStudentSession();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    // Get initial Supabase session
    supabase.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.signIn({ email, password });
    return { error };
  };

  const signOut = async () => {
    // Clear Supabase session
    await supabase.signOut();
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.resetPassword({ email, redirectTo });
    return { error };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        studentSession,
        loading,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
