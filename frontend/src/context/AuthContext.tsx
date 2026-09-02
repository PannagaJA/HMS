import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { 
  loginUser, 
  logoutUser, 
  getStoredUser, 
  getAccessToken,
  saveAuthSession,
  apiClient 
} from '../utils/authService';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  updateCurrentUser: (updatedUser: User) => void;
  refreshUserProfile: () => Promise<User | null>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  // Optimistic UI: If stored user exists, don't block the screen with full loader
  const [isLoading, setIsLoading] = useState<boolean>(() => !getStoredUser());

  const refreshUserProfile = async (): Promise<User | null> => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        // Only clear if confirmed no Supabase session
        const sessionRes = await supabase.auth.getSession();
        if (!sessionRes.data?.session) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('hms_user');
          localStorage.removeItem('hms_token');
          return null;
        }
      }

      const res = await apiClient.get<User>('/auth/me/');
      if (res.data) {
        setUser(res.data);
        const sessionRes = await supabase.auth.getSession();
        const currentToken = sessionRes.data?.session?.access_token || getAccessToken() || '';
        setToken(currentToken);
        saveAuthSession(currentToken, undefined, res.data);
        return res.data;
      }
    } catch (err) {
      console.error('Session restoration background check:', err);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  useEffect(() => {
    // 1. Initial restoration on page refresh
    refreshUserProfile();

    // 2. Listen to Supabase auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setToken(null);
        localStorage.removeItem('hms_user');
        localStorage.removeItem('hms_token');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setToken(session.access_token);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateCurrentUser = (updatedUser: User) => {
    setUser(updatedUser);
    const currentToken = getAccessToken();
    if (currentToken) {
      saveAuthSession(currentToken, undefined, updatedUser);
    }
  };

  const login = async (username: string, password: string): Promise<User> => {
    setIsLoading(true);
    try {
      const res = await loginUser(username, password);
      if (!res.user) throw new Error('User profile not found');
      setUser(res.user);
      setToken(res.access);
      return res.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      login, 
      logout, 
      updateCurrentUser, 
      refreshUserProfile, 
      isLoading 
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
