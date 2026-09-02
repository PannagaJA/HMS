import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { 
  loginUser, 
  logoutUser, 
  getStoredUser, 
  getAccessToken,
  apiClient 
} from '../utils/authService';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Verify session on mount
    const verifySession = async () => {
      const currentToken = getAccessToken();
      if (currentToken) {
        try {
          const res = await apiClient.get<User>('/auth/me/');
          setUser(res.data);
          setToken(currentToken);
        } catch (err) {
          // Token expired or invalid
        }
      }
    };
    verifySession();
  }, []);

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
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
