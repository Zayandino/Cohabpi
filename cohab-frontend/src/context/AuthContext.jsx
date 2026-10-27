import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('cohab_profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      // PGRST116 = no rows found (usuario recién creado antes del trigger)
      if (error && error.code !== 'PGRST116') throw error;
      setProfile(data || null);
    } catch (error) {
      console.error('Error fetching profile:', error.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Timeout de seguridad: previene pantalla negra indefinida si Supabase tarda o la red falla
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2500);

    // Check active sessions and sets the user
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error al inicializar sesión:', err);
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);



  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  // Registra un nuevo usuario en Supabase Auth
  // El trigger handle_new_user() crea automáticamente la fila en cohab_profiles
  const signUp = async (email, password) => {
    return await supabase.auth.signUp({ email, password });
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const value = {
    signIn,
    signUp,
    signOut,
    user,
    profile,
    loading,
    refreshProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
};
