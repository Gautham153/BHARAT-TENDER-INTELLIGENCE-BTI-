// Bharat Tender Intelligence (BTI) — Authentication Context & Provider
// Phase 1B: Real Firebase Auth State & Persistent RBAC

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AuthStatus,
  AuthUser,
  LoginCredentials,
  AgencyRegistrationData,
  VerificationResult,
} from '../types/auth';
import { AuthService } from '../services/authService';

export interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isGovernment: boolean;
  isAgency: boolean;
  isPublic: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthUser>;
  loginDemo: (role: 'government' | 'agency' | 'pending_agency') => Promise<AuthUser>;
  logout: () => Promise<void>;
  registerAgency: (data: AgencyRegistrationData) => Promise<{ user: AuthUser; verificationResult: VerificationResult }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => AuthService.getCurrentUser());
  const [status, setStatus] = useState<AuthStatus>(() => (user ? 'authenticated' : 'unauthenticated'));

  // Subscribe to persistent Auth state on mount
  useEffect(() => {
    const initialSession = AuthService.getSession();
    if (initialSession.user) {
      setUser(initialSession.user);
      setStatus('authenticated');
    }

    const unsubscribe = AuthService.subscribeToAuthChanges((updatedUser) => {
      if (updatedUser) {
        setUser(updatedUser);
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthUser> => {
    setStatus('loading');
    try {
      const loggedInUser = await AuthService.signIn(credentials);
      setUser(loggedInUser);
      setStatus('authenticated');
      return loggedInUser;
    } catch (err) {
      setStatus(user ? 'authenticated' : 'unauthenticated');
      throw err;
    }
  }, [user]);

  const loginDemo = useCallback(async (roleKey: 'government' | 'agency' | 'pending_agency'): Promise<AuthUser> => {
    setStatus('loading');
    try {
      const loggedInUser = await AuthService.demoLogin(roleKey);
      setUser(loggedInUser);
      setStatus('authenticated');
      return loggedInUser;
    } catch (err) {
      setStatus(user ? 'authenticated' : 'unauthenticated');
      throw err;
    }
  }, [user]);

  const logout = useCallback(async (): Promise<void> => {
    await AuthService.signOut();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const registerAgency = useCallback(
    async (data: AgencyRegistrationData): Promise<{ user: AuthUser; verificationResult: VerificationResult }> => {
      setStatus('loading');
      try {
        const result = await AuthService.registerAgency(data);
        setUser(result.user);
        setStatus('authenticated');
        return result;
      } catch (err) {
        setStatus(user ? 'authenticated' : 'unauthenticated');
        throw err;
      }
    },
    [user]
  );

  const resetPassword = useCallback(async (email: string): Promise<{ success: boolean; message: string }> => {
    return AuthService.resetPassword(email);
  }, []);

  const isGovernment = user?.role === 'government';
  const isAgency = user?.role === 'agency';
  const isPublic = !user || user.role === 'public';
  const isAuthenticated = status === 'authenticated' && user !== null;

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        isAuthenticated,
        isGovernment,
        isAgency,
        isPublic,
        login,
        loginDemo,
        logout,
        registerAgency,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
