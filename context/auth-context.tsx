import { supabase } from '@/config/supabase';
import { User } from '@/types';
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';

type AuthContextType = {
  session: Session | null;
  currentUser: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  currentUser: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setCurrentUser(data as User);
  };

  const refreshUser = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const uid = currentSession?.user?.id ?? session?.user?.id;
    if (uid) await fetchUser(uid);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) fetchUser(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) fetchUser(session.user.id);
      else setCurrentUser(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ session, currentUser, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
