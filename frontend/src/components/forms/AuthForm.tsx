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
  AUTH_API_PLACEHOLDERS,
  loginWithBackendPlaceholder,
  signupWithBackendPlaceholder,
} from "@/lib/auth/api";
import { useMockAuth } from "@/lib/firebase/mock-auth";

const loginSchema = z.object({
  email: z.email("Please enter a valid email address."),
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
  const { user, isAuthenticated, signInWithMockCredentials, signOut } =
    useMockAuth();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiMessage, setApiMessage] = useState<string | null>(null);

  const schema = useMemo(
    () => (mode === "login" ? loginSchema : signupSchema),
    [mode],
  );

  const defaultValues = useMemo<AuthFormValues>(
    () => ({
      name: defaultMode === "signup" ? "Backend Tester" : "",
      email: "backend.tester@phanes.local",
      password: "mock-password",
    }),
    [defaultMode],
  );

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues,
  });

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    form.reset({
      name: nextMode === "signup" ? "Backend Tester" : "",
      email: "backend.tester@phanes.local",
      password: "mock-password",
    });
  }

  async function onSubmit(values: AuthFormValues) {
    setIsSubmitting(true);
    setApiMessage(null);

    const apiResponse =
      mode === "login"
        ? await loginWithBackendPlaceholder({
            email: values.email,
            password: values.password,
          })
        : await signupWithBackendPlaceholder({
            name: values.name,
            email: values.email,
            password: values.password,
          });

    const nextUser = signInWithMockCredentials({
      mode,
      name: values.name,
      email: values.email,
      password: values.password,
    });

    setApiMessage(
      `${apiResponse.method} ${apiResponse.endpoint} → ${apiResponse.message}`,
    );

    window.dispatchEvent(
      new CustomEvent("phanes-toast", {
        detail: {
          title: t("toast.successTitle"),
          description: t("toast.successDescription", {
            email: nextUser.email,
          }),
          variant: "success",
        },
      }),
    );

    window.dispatchEvent(
      new CustomEvent("phanes-toast", {
        detail: {
          title: t("toast.apiTitle"),
          description: t("toast.apiDescription", {
            endpoint: apiResponse.endpoint,
          }),
          variant: "success",
        },
      }),
    );

    setIsSubmitting(false);
    onClose();
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

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-50">
            <p className="font-semibold">{t("api.title")}</p>
            <p className="mt-1 opacity-90">{t("api.description")}</p>
            <div className="mt-3 space-y-1 font-mono text-xs opacity-90">
              <p>BASE_URL: {AUTH_API_PLACEHOLDERS.baseUrl}</p>
              <p>LOGIN: POST {AUTH_API_PLACEHOLDERS.loginEndpoint}</p>
              <p>SIGNUP: POST {AUTH_API_PLACEHOLDERS.signupEndpoint}</p>
              <p>HEADER: {AUTH_API_PLACEHOLDERS.tokenHeader}</p>
            </div>
            {apiMessage ? <p className="mt-3 text-xs">{apiMessage}</p> : null}
          </div>

          <div className="rounded-xl border border-dashed border-foreground/10 bg-foreground/5 px-4 py-3 text-sm text-foreground/70">
            {isAuthenticated && user ? (
              <div className="space-y-3">
                <p>
                  {t("session.active", {
                    email: user.email,
                    uid: user.uid,
                  })}
                </p>
                <Button type="button" variant="outline" onClick={signOut}>
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
