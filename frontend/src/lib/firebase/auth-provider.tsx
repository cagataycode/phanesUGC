"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, onIdTokenChanged, getIdToken } from "firebase/auth";
import { auth } from "./index"; // Assuming the exported firebase initialized instance is here

// This defines the structure returned by our backend `/api/v1/me`
export interface PlatformContext {
  user_id?: string;
  account_id?: string;
  role?: string;
  subscription_tier?: string;
  entitlement_source?: string;
}

interface AuthContextType {
  user: User | null;
  platformContext: PlatformContext | null;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  refreshPlatformContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  platformContext: null,
  loading: true,
  getIdToken: async () => null,
  refreshPlatformContext: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [platformContext, setPlatformContext] = useState<PlatformContext | null>(null);
  const [loading, setLoading] = useState(!auth ? false : true);

  // Helper function to hit the backend `/api/v1/me` endpoint
  const refreshPlatformContext = async (token?: string) => {
    try {
      // If token isn't provided, try to grab the latest one
      const idToken = token || (auth?.currentUser ? await getIdToken(auth.currentUser) : null);
      
      if (!idToken) {
        setPlatformContext(null);
        return;
      }

      // Backend endpoint implemented in Phase 3
      const response = await fetch("http://localhost:3000/api/v1/me", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPlatformContext(data.platform_context || null);
      } else {
        setPlatformContext(null);
      }
    } catch (error) {
      console.error("Failed to fetch platform context", error);
      setPlatformContext(null);
    }
  };

  useEffect(() => {
    if (!auth) return;

    // `onIdTokenChanged` fires on login, logout, and token refresh
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await getIdToken(firebaseUser);
        await refreshPlatformContext(token);
      } else {
        setPlatformContext(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getToken = async () => {
    if (auth?.currentUser) {
      return await getIdToken(auth.currentUser);
    }
    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        platformContext,
        loading,
        getIdToken: getToken,
        refreshPlatformContext: () => refreshPlatformContext(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
