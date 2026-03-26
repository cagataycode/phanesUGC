# Frontend Authentication Guide

This guide explains how to integrate the new Firebase Authentication layer and connect the Login/Signup components to the backend.

## 1. AuthProvider & `useAuth` Hook

The entire application is now wrapped in the real Firebase `AuthProvider`. You can access the user's state and their backend workspace context from any client component.

```tsx
"use client";
import { useAuth } from "@/lib/firebase/auth-provider";

export function UserDashboard() {
  const { user, platformContext, loading } = useAuth();

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Please log in.</p>;

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <p>Workspace ID: {platformContext?.account_id}</p>
      <p>Role: {platformContext?.role}</p>
    </div>
  );
}
```

## 2. API Client Wrapper

To make requests to our backend (`http://localhost:3000/api/v1`), do **not** use `axios` or standard `fetch` manually. Instead, use the `fetchWithAuth` wrapper. It will automatically wait for the Firebase ID token and inject it into the `Authorization: Bearer <token>` header.

```tsx
import { fetchWithAuth } from "@/lib/api-client";

// The endpoint is automatically prefixed with the API base URL
async function createProject(data) {
  const response = await fetchWithAuth("/workspaces/projects", {
    method: "POST",
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error("Failed to create project");
  }
  return response.json();
}
```

## 3. Implementing Login/Signup

Your task is to wire up the actual Login/Signup components. Here is how you trigger the login and sync it with the backend.

```tsx
"use client";
import { useState } from "react";
import { auth } from "@/lib/firebase";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { useAuth } from "@/lib/firebase/auth-provider";

export function LoginForm() {
  const { refreshPlatformContext } = useAuth();
  
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // Optional: Manually trigger backend sync if you want to block until provisioning is done
      // (Though onIdTokenChanged usually catches this automatically)
      const token = await result.user.getIdToken();
      await refreshPlatformContext(token);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <button onClick={handleGoogleLogin}>Sign in with Google</button>
  );
}
```

### Note on Provisioning

The very first time a user logs in, the `AuthProvider` will call the backend `GET /api/v1/me`. Our NestJS backend intercepts this call and automatically:
1. Creates a `User` document in Firestore.
2. Auto-provisions a `Business` (Personal Workspace).
3. Adds the user as an `owner` of that workspace.

You do **not** need to call any separate "create workspace" endpoints during sign-up. The `/me` endpoint handles all of Phase 3 provisioning automatically.