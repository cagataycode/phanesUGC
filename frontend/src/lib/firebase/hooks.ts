import { useEffect, useState } from "react";
import { doc, onSnapshot, collection, query, where, orderBy, DocumentData, Timestamp } from "firebase/firestore";
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

export function useProject(businessId: string | undefined, projectId: string | undefined) {
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(!!(businessId && projectId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!businessId || !projectId) {
      setTimeout(() => {
        setProject(null);
        setLoading(false);
      }, 0);
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
      }
    );

    return () => unsubscribe();
  }, [businessId, projectId]);

  return { project, loading, error };
}

export function useProjects(businessId: string | undefined) {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(!!businessId);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!businessId) {
      setTimeout(() => {
        setProjects([]);
        setLoading(false);
      }, 0);
      return;
    }

    const projectsRef = collection(db, "businesses", businessId, "projects");
    const q = query(
      projectsRef,
      where("isDeleted", "==", false),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (querySnap) => {
        const docs = querySnap.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as ProjectData)
        );
        setProjects(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching projects:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [businessId]);

  return { projects, loading, error };
}
