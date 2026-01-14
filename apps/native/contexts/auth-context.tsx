import { authClient } from "@/lib/auth-client";
import type { Session, User } from "better-auth/types";
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      const result = await authClient.signIn.email({ email, password });

      if (result.error) {
        throw new Error(result.error.message || "Sign in failed");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during sign in";
      setError(errorMessage);
      throw err;
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    try {
      setError(null);
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        throw new Error(result.error.message || "Sign up failed");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during sign up";
      setError(errorMessage);
      throw err;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setError(null);
      await authClient.signOut();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred during sign out";
      setError(errorMessage);
      throw err;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session: session?.session ?? null,
      isLoading: isPending,
      isAuthenticated: !!session,
      error: error || (sessionError ? sessionError.message : null),
      signIn,
      signUp,
      signOut,
      clearError,
    }),
    [session, isPending, sessionError, error, signIn, signUp, signOut, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
