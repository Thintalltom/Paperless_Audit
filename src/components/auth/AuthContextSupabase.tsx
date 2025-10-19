import React, { useEffect, useState, createContext, useContext } from 'react';
import { supabase } from '../../supabaseClient';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string; user?: UserProfile }>;
  logout: () => Promise<void>;
  getApprovalChain: () => Promise<UserProfile[]>;
  getUser: (userId: string) => Promise<UserProfile | null>;
  isApprover: (userId: string) => Promise<boolean>;
  getNextApproverInChain: (currentApproverRole: string) => Promise<string | null>;
  getApproverIndexInChain: (approverRole: string) => number;
  APPROVAL_CHAIN: string[];
}

const APPROVAL_CHAIN = [
  'branch_auditor', 'regional_manager', 'ho_admin', 'ho_auditor', 
  'account_unit', 'dd_operations', 'dd_finance', 'ged'
];

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        // console.log('Initial session check:', session, error);
        if (error) {
          // console.log('Session error detected, clearing cache');
          localStorage.clear();
          sessionStorage.clear();
          setLoading(false);
        } else if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setLoading(false);
        }
      } catch (err) {
        // console.log('Session check failed, clearing cache:', err);
        localStorage.clear();
        sessionStorage.clear();
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes including token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // console.log('Auth state change:', event, session?.user?.id);
        
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          // Clear storage on any logout (manual or automatic)
          localStorage.clear();
          sessionStorage.clear();
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => caches.delete(name));
            });
          }
          setUser(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // console.log('Token refreshed, maintaining user session');
          if (!user) {
            await fetchUserProfile(session.user.id);
          }
        }
      }
    );

    // Handle tab visibility changes
    const handleVisibilityChange = async () => {
      if (!document.hidden && !user) {
        // Check session when tab becomes visible and no user is logged in
        await checkSession();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Auto-logout detection for expired sessions
  useEffect(() => {
    const checkAutoLogout = async () => {
      if (user) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // console.log('Session expired, auto-logout detected');
          localStorage.clear();
          sessionStorage.clear();
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => caches.delete(name));
            });
          }
          setUser(null);
        }
      }
    };

    const interval = setInterval(checkAutoLogout, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [user]);

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_profile')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setUser(data);
        // console.log('User profile found:', data);
      } else {
        console.error('User profile not found:', error);
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Clear cache on authentication errors
      if (error.message.includes('Invalid login credentials') || error.message.includes('session')) {
        localStorage.clear();
        sessionStorage.clear();
      }
      return { success: false, message: error.message };
    }

    if (data.user) {
      const profile = await getUser(data.user.id);
      return { success: true, user: profile };
    }

    return { success: false, message: 'Login failed' };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    // Clear all cached data
    localStorage.clear();
    sessionStorage.clear();
  };

  const getApprovalChain = async (): Promise<UserProfile[]> => {
    const { data, error } = await supabase
      .from('Approval_chain_table')
      .select('*')
      .in('role', APPROVAL_CHAIN);

    // console.log('approval chain data', data, error);
    if (error) return [];

    // Sort by approval chain order
    return data.sort((a, b) => 
      APPROVAL_CHAIN.indexOf(a.role) - APPROVAL_CHAIN.indexOf(b.role)
    );
  };

  const getUser = async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from('admin_profile')
      .select('*')
      .eq('id', userId)
      .single();

    return error ? null : data;
  };

  const isApprover = async (userId: string): Promise<boolean> => {
    const userProfile = await getUser(userId);
    return userProfile ? APPROVAL_CHAIN.includes(userProfile.role) : false;
  };

  const getNextApproverInChain = async (currentApproverRole: string): Promise<string | null> => {
    const currentIndex = APPROVAL_CHAIN.indexOf(currentApproverRole);
    if (currentIndex >= 0 && currentIndex < APPROVAL_CHAIN.length - 1) {
      const nextRole = APPROVAL_CHAIN[currentIndex + 1];
      const { data } = await supabase
        .from('admin_profile')
        .select('id')
        .eq('role', nextRole)
        .single();
      
      return data?.id || null;
    }
    return null;
  };

  const getApproverIndexInChain = (approverRole: string): number => {
    return APPROVAL_CHAIN.indexOf(approverRole);
  };

  // if (loading) {
  //   return <div className="flex items-center justify-center h-screen">Loading...</div>;
  // }

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      getApprovalChain,
      getUser,
      isApprover,
      getNextApproverInChain,
      getApproverIndexInChain,
      APPROVAL_CHAIN
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};