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

export interface ProductData extends DocumentData {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  benefits?: string[];
  urls?: string[];
  brandAssets?: {
    storageKey: string;
    type: "image" | "video" | "logo";
    filename: string;
  }[];
  defaults?: {
    tone?: string;
    targetAudience?: string;
    language?: string;
    cta?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deletedAt?: Timestamp;
}

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

export function useProducts(businessId: string | undefined) {
  const firebaseUnavailableError = useMemo(
    () => (!db ? new Error("Firebase is not configured.") : null),
    [],
  );
  const canSubscribe = Boolean(db && businessId);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [loading, setLoading] = useState(canSubscribe);
  const [error, setError] = useState<Error | null>(firebaseUnavailableError);

  useEffect(() => {
    if (!canSubscribe || !db) {
      setTimeout(() => {
        setProducts([]);
        setLoading(false);
        setError(firebaseUnavailableError);
      }, 0);
      return;
    }

    if (!businessId) return;

    const productsRef = collection(db, "businesses", businessId, "products");
    // Fetch all products and filter/sort client-side.
    // This avoids composite index requirements and handles both:
    // - documents with deletedAt: null (new pattern)
    // - documents with no deletedAt field (legacy)
    const q = query(productsRef);

    const unsubscribe = onSnapshot(
      q,
      (querySnap) => {
        const docs = querySnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ProductData)
          .filter((d) => !d.deletedAt)
          .sort((a, b) => {
            const aMs = a.createdAt?.toMillis?.() ?? 0;
            const bMs = b.createdAt?.toMillis?.() ?? 0;
            return bMs - aMs;
          });
        setProducts(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching products:", err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [businessId, canSubscribe, firebaseUnavailableError]);

  return { products, loading, error };
}

export function useProduct(
  businessId: string | undefined,
  productId: string | undefined,
) {
  const firebaseUnavailableError = useMemo(
    () => (!db ? new Error("Firebase is not configured.") : null),
    [],
  );
  const canSubscribe = Boolean(db && businessId && productId);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(canSubscribe);
  const [error, setError] = useState<Error | null>(firebaseUnavailableError);

  useEffect(() => {
    if (!canSubscribe || !db) {
      setTimeout(() => {
        setProduct(null);
        setLoading(false);
        setError(firebaseUnavailableError);
      }, 0);
      return;
    }

    if (!businessId || !productId) return;

    const productRef = doc(db, "businesses", businessId, "products", productId);

    const unsubscribe = onSnapshot(
      productRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as ProductData);
        } else {
          setProduct(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching product:", err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [canSubscribe, businessId, productId, firebaseUnavailableError]);

  return { product, loading, error };
}
