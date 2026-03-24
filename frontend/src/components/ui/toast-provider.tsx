"use client";

import { useEffect, useState } from "react";

type ToastVariant = "error" | "success";

type ToastItem = {
  id: number;
  title: string;
  description: string;
  variant?: ToastVariant;
};

declare global {
  interface WindowEventMap {
    "phanes-toast": CustomEvent<Omit<ToastItem, "id">>;
  }
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function handleToast(event: WindowEventMap["phanes-toast"]) {
      const id = Date.now();
      const nextToast: ToastItem = { id, ...event.detail };

      setToasts((current) => [...current, nextToast]);

      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4000);
    }

    window.addEventListener("phanes-toast", handleToast);
    return () => window.removeEventListener("phanes-toast", handleToast);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4 sm:justify-end sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-xl transition-all ${toast.variant === "error" ? "border-red-500/20 bg-red-500/10 text-red-950 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-50" : "border-emerald-500/20 bg-emerald-500/10 text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-50"}`}
            role="status"
            aria-live="polite"
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="mt-1 text-sm opacity-80">{toast.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
