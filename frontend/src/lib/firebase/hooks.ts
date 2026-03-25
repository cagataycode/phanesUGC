import { useEffect, useMemo, useState } from "react";
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  DocumentData,
  Timestamp,
} from "firebase/firestore";
import { db } from "./index";

export interface ProjectData extends DocumentData {
  id: string;
  businessId: string;
  productId: string;
  createdBy: string;
  prompt: string;
  status: "created" | "processing" | "completed" | "failed";
  progress: number;
  stages: {
    scrape: string;
    brief: string;
    script: string;
    scenes: string;
    assets: string;
    audio: string;
    subtitles: string;
    render: string;
  };
  creativeBrief?: unknown;
  script?: unknown;
  output?: {
    videoStorageKey: string;
    thumbnailStorageKey?: string;
  };
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function useProject(
  businessId: string | undefined,
  projectId: string | undefined,
) {
  const firebaseUnavailableError = useMemo(
    () => (!db ? new Error("Firebase is not configured.") : null),
    [],
  );
  const canSubscribe = Boolean(db && businessId && projectId);
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(canSubscribe);
  const [error, setError] = useState<Error | null>(firebaseUnavailableError);

  useEffect(() => {
    if (!canSubscribe || !db) {
      setTimeout(() => {
        setProject(null);
        setLoading(false);
        setError(firebaseUnavailableError);
      }, 0);
      return;
    }

    if (!businessId || !projectId) {
      return;
    }

    const projectRef = doc(db, "businesses", businessId, "projects", projectId);

    const unsubscribe = onSnapshot(
      projectRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProject({ id: docSnap.id, ...docSnap.data() } as ProjectData);
        } else {
          setProject(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching project:", err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [canSubscribe, businessId, firebaseUnavailableError, projectId]);

  return { project, loading, error };
}

export function useProjects(businessId: string | undefined) {
  const firebaseUnavailableError = useMemo(
    () => (!db ? new Error("Firebase is not configured.") : null),
    [],
  );
  const canSubscribe = Boolean(db && businessId);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(canSubscribe);
  const [error, setError] = useState<Error | null>(firebaseUnavailableError);

  useEffect(() => {
    if (!canSubscribe || !db) {
      setTimeout(() => {
        setProjects([]);
        setLoading(false);
        setError(firebaseUnavailableError);
      }, 0);
      return;
    }

    if (!businessId) {
      return;
    }

    const projectsRef = collection(db, "businesses", businessId, "projects");
    const q = query(
      projectsRef,
      where("isDeleted", "==", false),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnap) => {
        const docs = querySnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() }) as ProjectData,
        );
        setProjects(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching projects:", err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [businessId, canSubscribe, firebaseUnavailableError]);

  return { projects, loading, error };
}
