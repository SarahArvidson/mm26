import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';

console.log('AUTH CONTEXT MODULE LOADED');

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
  signInStudent: (username: string, password: string, joinCode: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STUDENT_SESSION_KEY = 'mm26_student_session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [studentSession, setStudentSession] = useState<StudentSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load student session from localStorage
    const storedStudentSession = localStorage.getItem(STUDENT_SESSION_KEY);
    if (storedStudentSession) {
      try {
        const parsed = JSON.parse(storedStudentSession);
        if (parsed.type === 'student' && parsed.student_id && parsed.class_id) {
          setStudentSession(parsed);
        }
      } catch (e) {
        // Invalid session, clear it
        localStorage.removeItem(STUDENT_SESSION_KEY);
      }
    }

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

  const signInStudent = async (username: string, password: string, joinCode: string) => {
    console.log('signInStudent FUNCTION ENTERED');
    try {
      // Look up class by join_code
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('join_code', joinCode)
        .maybeSingle();

      console.log('CLASS LOOKUP RESULT:', classData);
      console.log('CLASS LOOKUP ERROR:', classError);

      if (classError || !classData) {
        return { error: { message: 'Invalid credentials' } };
      }

      // Find student by class_id and username
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, class_id, password_hash')
        .eq('class_id', classData.id)
        .eq('username', username)
        .maybeSingle();

      console.log('STUDENT LOOKUP RESULT:', studentData);
      console.log('STUDENT LOOKUP ERROR:', studentError);

      if (studentError || !studentData) {
        return { error: { message: 'Invalid credentials' } };
      }

      // Verify password using bcryptjs
      const bcrypt = await import('bcryptjs');

      console.log('LOGIN DEBUG START');
      console.log('Join code provided:', joinCode);
      console.log('Username provided:', username);
      console.log('Password provided:', password);

      console.log('Class lookup result:', classData);
      console.log('Student lookup result:', studentData);

      if (studentData) {
        console.log('Stored hash:', studentData.password_hash);
      }

      const isValid = studentData
        ? await bcrypt.compare(password, studentData.password_hash)
        : false;

      console.log('bcrypt comparison result:', isValid);
      console.log('LOGIN DEBUG END');

      if (!isValid) {
        return { error: { message: 'Invalid credentials' } };
      }

      // Create student session
      const studentSession: StudentSession = {
        type: 'student',
        student_id: studentData.id,
        class_id: studentData.class_id,
      };

      // Store in localStorage
      localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(studentSession));
      setStudentSession(studentSession);

      return { error: null };
    } catch (error) {
      return { error: { message: 'Login failed. Please try again.' } };
    }
  };

  const signOut = async () => {
    // Clear Supabase session
    await supabase.signOut();
    setUser(null);
    setSession(null);

    // Clear student session
    localStorage.removeItem(STUDENT_SESSION_KEY);
    setStudentSession(null);
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
        signInStudent,
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
