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
  const [isLoading, setIsLoading] = useState(false);

  const refreshUserProfile = async (): Promise<User | null> => {
    const currentToken = getAccessToken();
    if (currentToken) {
      try {
        const res = await apiClient.get<User>('/auth/me/');
        setUser(res.data);
        saveAuthSession(currentToken, undefined, res.data);
        return res.data;
      } catch (err) {
        // Token expired or invalid
      }
    }
    return null;
  };

  useEffect(() => {
    // Verify session on mount
    refreshUserProfile();
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
