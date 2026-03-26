"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "phanes.mock-auth.user";

export type MockAuthUser = {
  uid: string;
  email: string;
  displayName: string;
  businessId: string;
  mockIdToken: string;
};

type MockAuthContextValue = {
  user: MockAuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithMockCredentials: (input: {
    mode: "login" | "signup";
    name?: string;
    email: string;
    password: string;
  }) => MockAuthUser;
  signOut: () => void;
  getIdToken: () => string | null;
};

const MockAuthContext = createContext<MockAuthContextValue | undefined>(
  undefined,
);

function buildMockUser(): MockAuthUser {
  return {
    uid: "mock-user-id",
    email: "backend.tester@phanes.local",
    displayName: "Backend Tester",
    businessId:
      process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_ID || "test-business-id",
    mockIdToken: "mock-firebase-id-token",
  };
}

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockAuthUser | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const rawUser = window.localStorage.getItem(STORAGE_KEY);

    if (rawUser) {
      try {
        return JSON.parse(rawUser) as MockAuthUser;
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }

    return null;
  });
  const [isLoading] = useState(false);

  const signInWithMockCredentials = useCallback(
    (input: {
      mode: "login" | "signup";
      name?: string;
      email: string;
      password: string;
    }) => {
      const normalizedEmail = input.email.trim().toLowerCase();
      const displayName =
        input.mode === "signup"
          ? input.name?.trim() || normalizedEmail.split("@")[0] || "New User"
          : normalizedEmail.split("@")[0] || "Backend Tester";

      const nextUser: MockAuthUser = {
        ...buildMockUser(),
        uid: `mock-${normalizedEmail.replace(/[^a-z0-9]/g, "-")}`,
        email: normalizedEmail,
        displayName,
        mockIdToken: `mock-firebase-id-token:${btoa(`${normalizedEmail}:${input.password}`)}`,
      };

      setUser(nextUser);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));

      return nextUser;
    },
    [],
  );
  const signOut = useCallback(() => {
    setUser(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const getIdToken = useCallback(() => user?.mockIdToken ?? null, [user]);

  const value = useMemo<MockAuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      signInWithMockCredentials,
      signOut,
      getIdToken,
    }),
    [getIdToken, isLoading, signInWithMockCredentials, signOut, user],
  );

  return (
    <MockAuthContext.Provider value={value}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth() {
  const context = useContext(MockAuthContext);

  if (!context) {
    throw new Error("useMockAuth must be used within a MockAuthProvider");
  }

  return context;
}

export function useMockQuickLogin() {
  const { signInWithMockCredentials } = useMockAuth();

  return useCallback(() => {
    signInWithMockCredentials({
      mode: "login",
      email: "backend.tester@phanes.local",
      password: "mock-password",
    });
  }, [signInWithMockCredentials]);
}
