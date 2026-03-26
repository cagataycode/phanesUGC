"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/firebase/auth-provider";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

const signupSchema = loginSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters."),
});

type AuthMode = "login" | "signup";
type AuthFormValues = {
  name: string;
  email: string;
  password: string;
};

type AuthFormProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
};

export function AuthForm({
  isOpen,
  onClose,
  defaultMode = "login",
}: AuthFormProps) {
  const t = useTranslations("auth");
  const { user, refreshPlatformContext } = useAuth();
  const isAuthenticated = !!user;
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = useMemo(
    () => (mode === "login" ? loginSchema : signupSchema),
    [mode],
  );

  const defaultValues = useMemo<AuthFormValues>(
    () => ({
      name: "",
      email: "",
      password: "",
    }),
    [],
  );

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues,
  });

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    form.reset({
      name: "",
      email: "",
      password: "",
    });
  }

  async function handleSignOut() {
    if (!auth) return;
    await firebaseSignOut(auth);
  }

  async function onSubmit(values: AuthFormValues) {
    if (!auth) return;
    setIsSubmitting(true);

    try {
      const userCredential =
        mode === "login"
          ? await signInWithEmailAndPassword(
              auth,
              values.email,
              values.password,
            )
          : await createUserWithEmailAndPassword(
              auth,
              values.email,
              values.password,
            );

      const idToken = await userCredential.user.getIdToken();
      await refreshPlatformContext(idToken);

      const userEmail = userCredential.user.email ?? values.email;

      window.dispatchEvent(
        new CustomEvent("phanes-toast", {
          detail: {
            title: t("toast.successTitle"),
            description: t("toast.successDescription", {
              email: userEmail,
            }),
            variant: "success",
          },
        }),
      );
      setIsSubmitting(false);
      onClose();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to authenticate";
      console.error("Auth error:", error);
      window.dispatchEvent(
        new CustomEvent("phanes-toast", {
          detail: {
            title: "Authentication Error",
            description: errorMessage,
            variant: "error",
          },
        }),
      );
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    form.reset(defaultValues);
  }, [defaultValues, form, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4 py-6 sm:px-6">
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />
      <Card className="relative z-10 w-full max-w-md border border-foreground/10 bg-background/95 shadow-2xl backdrop-blur-xl">
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">{t(`tabs.${mode}`)}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-foreground/5 p-1">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "ghost"}
              className="w-full"
              onClick={() => switchMode("login")}
            >
              {t("tabs.login")}
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "ghost"}
              className="w-full"
              onClick={() => switchMode("signup")}
            >
              {t("tabs.signup")}
            </Button>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {mode === "signup" ? (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("fields.name")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="h-10 rounded-xl px-3 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.email")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        className="h-10 rounded-xl px-3 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.password")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        className="h-10 rounded-xl px-3 text-sm"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-10 w-full rounded-xl"
              >
                {mode === "login" ? t("submit.login") : t("submit.signup")}
              </Button>
            </form>
          </Form>

          <div className="rounded-xl border border-dashed border-foreground/10 bg-foreground/5 px-4 py-3 text-sm text-foreground/70">
            {isAuthenticated && user ? (
              <div className="space-y-3">
                <p>
                  {t("session.active", {
                    email: user.email ?? "",
                    uid: user.uid,
                  })}
                </p>
                <Button type="button" variant="outline" onClick={handleSignOut}>
                  {t("session.signOut")}
                </Button>
              </div>
            ) : (
              <p>{t("session.inactive")}</p>
            )}
          </div>

          <p className="text-xs text-foreground/60">{t("footnote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
