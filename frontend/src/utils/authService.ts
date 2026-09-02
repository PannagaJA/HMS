import axios from 'axios';
import type { User, AuthResponse } from '../types';

export const API_BASE_URL = 'http://127.0.0.1:8000/api';
const DEVICE_ID_KEY = 'hms_device_id';
const ACCESS_TOKEN_KEY = 'hms_access_token';
const REFRESH_TOKEN_KEY = 'hms_refresh_token';
const USER_KEY = 'hms_user';

let inMemoryToken: string | null = null;
let isLoggingOut = false;
let refreshPromise: Promise<string | null> | null = null;

// Unique Device ID Generator (matching reference system)
export const getOrCreateDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `hms-dev-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `hms-dev-${Math.random().toString(36).slice(2, 10)}`;
  }
};

export const getAccessToken = (): string | null => {
  return inMemoryToken || localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const getStoredUser = (): User | null => {
  try {
    const saved = localStorage.getItem(USER_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

export const saveAuthSession = (access: string, refresh?: string, user?: User) => {
  inMemoryToken = access;
  localStorage.setItem(ACCESS_TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  inMemoryToken = null;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Mutex Token Refresh Mechanism (matching reference system)
export const refreshToken = async (): Promise<string | null> => {
  const refresh = getRefreshToken();
  if (!refresh) {
    clearAuthSession();
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await axios.post<{ access: string }>(`${API_BASE_URL}/auth/refresh/`, {
        refresh,
      });
      const newAccess = response.data.access;
      inMemoryToken = newAccess;
      localStorage.setItem(ACCESS_TOKEN_KEY, newAccess);
      return newAccess;
    } catch (err) {
      clearAuthSession();
      if (!isLoggingOut && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Login User
export const loginUser = async (username: string, password: string): Promise<AuthResponse> => {
  const deviceId = getOrCreateDeviceId();
  const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login/`, {
    username,
    password,
    device_id: deviceId,
  });

  const { access, refresh, user } = response.data;
  saveAuthSession(access, refresh, user);
  return response.data;
};

// Logout User with Blacklisting
export const logoutUser = async (): Promise<void> => {
  isLoggingOut = true;
  const refresh = getRefreshToken();
  try {
    if (refresh) {
      const access = getAccessToken();
      await axios.post(
        `${API_BASE_URL}/auth/logout/`,
        { refresh },
        { headers: access ? { Authorization: `Bearer ${access}` } : {} }
      );
    }
  } catch (err) {
    console.error('Logout error on server', err);
  } finally {
    clearAuthSession();
    isLoggingOut = false;
    window.location.href = '/login';
  }
};

// Axios Instance with Automatic Refresh Interceptors
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  const deviceId = getOrCreateDeviceId();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.headers) {
    config.headers['X-Device-ID'] = deviceId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const newAccess = await refreshToken();
      if (newAccess && originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);
