import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(id) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    setProfile(data);
    setLoading(false);
  }

  async function signUp(email, password, name) {
    return supabase.auth.signUp({ email, password, options: { data: { name } } });
  }
  async function signIn(email, password) {
    return supabase.auth.signInWithPassword({ email, password });
  }
  async function signOut() { await supabase.auth.signOut(); }
  async function refreshProfile() { if (user) await fetchProfile(user.id); }
  async function resetPassword(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
  }
  async function updatePassword(password) {
    return supabase.auth.updateUser({ password });
  }

  return (
    <Ctx.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile, resetPassword, updatePassword, recoveryMode, clearRecoveryMode: () => setRecoveryMode(false) }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
