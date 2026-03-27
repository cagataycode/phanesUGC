"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Link01Icon,
  Upload01Icon,
  Add01Icon,
  Mic01Icon,
  Settings01Icon,
  ArrowUp01Icon,
  Loading01Icon,
} from "@hugeicons/core-free-icons";
import { useState, useEffect, useCallback } from "react";
import { createAdJob, getAdJobResult } from "@/lib/api";
import {
  useAvatar,
  useAvatars,
  useProject,
  useProduct,
  useProducts,
} from "@/lib/firebase/hooks";
import { useAuth } from "@/lib/firebase/auth-provider";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters."),
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  aspect_ratio: z.enum(["9:16", "1:1", "16:9"]),
  duration_sec: z.enum(["8", "15", "30", "60"]),
  language: z.enum(["en", "de"]),
  tone: z.string().optional(),
  target_audience: z.string().optional(),
  cta: z.string().optional(),
  product_name: z.string().optional(),
  product_description: z.string().optional(),
  product_benefits: z.string().optional(),
  product_urls: z.string().optional(),
  subtitle_style: z.string().optional(),
});

export function AdCreationForm() {
  const t = useTranslations();
  const router = useRouter();
  const { user, platformContext } = useAuth();
  const isAuthenticated = !!user;
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>(
    undefined,
  );
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>("");

  const isFirebaseConfigured =
    typeof process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "string" &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY.trim().length > 0 &&
    typeof process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === "string" &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim().length > 0 &&
    typeof process.env.NEXT_PUBLIC_FIREBASE_APP_ID === "string" &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID.trim().length > 0;

  const businessId =
    platformContext?.account_id ||
    process.env.NEXT_PUBLIC_DEFAULT_BUSINESS_ID ||
    "test-business-id";
  const { project, error: projectError } = useProject(
    isFirebaseConfigured ? businessId : undefined,
    isFirebaseConfigured ? activeProjectId : undefined,
  );
  const { products } = useProducts(
    isFirebaseConfigured && isAuthenticated ? businessId : undefined,
  );
  const { avatars } = useAvatars(
    isFirebaseConfigured && isAuthenticated ? businessId : undefined,
  );
  const { product: selectedProduct } = useProduct(
    isFirebaseConfigured && isAuthenticated && selectedProductId
      ? businessId
      : undefined,
    selectedProductId || undefined,
  );
  const { avatar: selectedAvatar } = useAvatar(
    isFirebaseConfigured && isAuthenticated && selectedAvatarId
      ? businessId
      : undefined,
    selectedAvatarId || undefined,
  );

  const showGenerationError = useCallback(
    (message: string) => {
      setInlineError(message);
      window.dispatchEvent(
        new CustomEvent("phanes-toast", {
          detail: {
            title: t("errors.generationFailedTitle"),
            description: message,
            variant: "error",
          },
        }),
      );
    },
    [t],
  );

  const storeGeneration = useCallback((id: string, prompt: string) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storageKey = "phanes.generations";
      const raw = window.localStorage.getItem(storageKey);
      const current = raw
        ? (JSON.parse(raw) as Array<{
            id: string;
            title: string;
            createdAt: string;
          }>)
        : [];
      const next = [
        {
          id,
          title: prompt.trim() || "Untitled generation",
          createdAt: new Date().toISOString(),
        },
        ...current.filter((item) => item.id !== id),
      ].slice(0, 20);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore local storage failures
    }
  }, []);

  useEffect(() => {
    if (project) {
      setTimeout(() => {
        setGenerationProgress(project.progress || 0);
      }, 0);

      if (project.status === "completed" && project.output?.videoStorageKey) {
        // Fetch signed URL now that it's complete
        getAdJobResult(project.id, businessId)
          .then((result) => {
            if (result.video_url) {
              setStatusMessage(null);
              setIsGenerating(false);
              router.push(`/results/${project.id}`);
            }
          })
          .catch(() => {
            setIsGenerating(false);
            setStatusMessage(null);
            showGenerationError("Failed to load generated video");
          });
      } else if (project.status === "failed") {
        setTimeout(() => {
          setIsGenerating(false);
          setStatusMessage(null);
          showGenerationError(project.error ?? t("errors.generationFailed"));
        }, 0);
      } else if (project.status === "processing") {
        // Find which stage is currently running
        const runningStage = Object.entries(project.stages || {}).find(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ([_, status]) => status === "running",
        );
        if (runningStage) {
          setTimeout(() => {
            setStatusMessage(`Running: ${runningStage[0]}...`);
          }, 0);
        }
      }
    }
  }, [project, businessId, t, showGenerationError, router]);

  useEffect(() => {
    if (projectError) {
      setTimeout(() => {
        setIsGenerating(false);
        setStatusMessage(null);
        if (isFirebaseConfigured) {
          showGenerationError("Lost connection to generation status");
        }
      }, 0);
    }
  }, [isFirebaseConfigured, projectError, showGenerationError]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
      platform: "tiktok",
      aspect_ratio: "9:16",
      duration_sec: "8",
      language: "en",
      tone: "direct",
      target_audience: "",
      cta: "",
      product_name: "",
      product_description: "",
      product_benefits: "",
      product_urls: "",
      subtitle_style: "standard",
    },
  });

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void form.handleSubmit(onSubmit)();
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isAuthenticated || !user) {
      window.dispatchEvent(
        new CustomEvent("phanes-toast", {
          detail: {
            title: "Authentication Required",
            description: "Please sign in to generate ads.",
            variant: "error",
          },
        }),
      );
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setStatusMessage(t("status.generating"));
      setInlineError(null);

      const payload = {
        businessId: businessId,
        productId:
          selectedProductId && selectedProductId !== "__none__"
            ? selectedProductId
            : "test-product-id",
        createdBy: user.uid,
        prompt_inputs: {
          prompt: values.prompt,
          platform: values.platform,
          language: values.language,
          tone: values.tone,
          target_audience: values.target_audience,
          cta: values.cta,
          product_info: {
            name: values.product_name,
            description: values.product_description,
            benefits: values.product_benefits
              ? values.product_benefits.split(",").map((b) => b.trim())
              : [],
          },
          urls: values.product_urls ? [values.product_urls] : [],
          subtitle_style: values.subtitle_style,
        },
        veo_config: {
          aspect_ratio: values.aspect_ratio,
          duration_sec: parseInt(values.duration_sec, 10) as 8 | 15 | 30 | 60,
        },
      };

      const job = await createAdJob(payload);
      storeGeneration(job.id, values.prompt);
      setActiveProjectId(job.id);
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
      setStatusMessage(null);
      showGenerationError(t("errors.generationFailed"));
    }
  }

  const activeTesterEmail = user?.email ?? "Not signed in";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-foreground/10 bg-background/60 px-4 py-3 text-left shadow-sm backdrop-blur-sm">
        <p className="text-sm font-semibold text-foreground/90">Auth session</p>
        <p className="mt-1 text-sm text-foreground/70">
          {isAuthenticated
            ? `Signed in as ${activeTesterEmail}. Workspace: ${businessId}.`
            : "Not signed in. Please sign in to generate ads."}
        </p>
      </div>

      {/* Product picker */}
      {isAuthenticated && products.length > 0 && (
        <div className="rounded-2xl border border-foreground/10 bg-background/60 px-4 py-3 text-left shadow-sm backdrop-blur-sm">
          <p className="mb-2 text-sm font-semibold text-foreground/90">
            Product
          </p>
          <Select
            value={selectedProductId}
            onValueChange={(val) => {
              setSelectedProductId(val === "__none__" ? "" : val);
              const picked = products.find((p) => p.id === val);
              if (picked) {
                form.setValue("product_name", picked.name ?? "");
                form.setValue("product_description", picked.description ?? "");
                form.setValue(
                  "product_benefits",
                  (picked.benefits ?? []).join(", "),
                );
                form.setValue("product_urls", (picked.urls ?? []).join(", "));
                if (picked.defaults?.tone) {
                  form.setValue("tone", picked.defaults.tone);
                }
                if (picked.defaults?.targetAudience) {
                  form.setValue(
                    "target_audience",
                    picked.defaults.targetAudience,
                  );
                }
                if (picked.defaults?.cta) {
                  form.setValue("cta", picked.defaults.cta);
                }
              }
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-lg text-sm">
              <SelectValue placeholder="Select a product…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No product selected</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedProduct && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-1">
              {selectedProduct.description ?? "No description"}
            </p>
          )}
        </div>
      )}
      {isAuthenticated && avatars.length > 0 && (
        <div className="rounded-2xl border border-foreground/10 bg-background/60 px-4 py-3 text-left shadow-sm backdrop-blur-sm">
          <p className="mb-2 text-sm font-semibold text-foreground/90">
            Avatar
          </p>
          <Select
            value={selectedAvatarId}
            onValueChange={(val) => {
              setSelectedAvatarId(val === "__none__" ? "" : val);
            }}
          >
            <SelectTrigger className="h-9 w-full rounded-lg text-sm">
              <SelectValue placeholder="Select an avatar…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No avatar selected</SelectItem>
              {avatars.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAvatar && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {selectedAvatar.description ??
                selectedAvatar.type.replaceAll("_", " ")}
            </p>
          )}
        </div>
      )}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="relative z-20 space-y-4 w-full"
        >
          <div className="space-y-4">
            {inlineError ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-900 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-50">
                <p className="font-semibold">
                  {t("errors.generationFailedTitle")}
                </p>
                <p className="mt-1 opacity-90">{inlineError}</p>
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormControl>
                    <div className="relative z-20 group rounded-[24px] overflow-hidden border border-foreground/10 bg-background/95 shadow-lg supports-[backdrop-filter]:bg-background/80 backdrop-blur-xl dark:border-white/5 dark:bg-[#1E1F21]/95 dark:supports-[backdrop-filter]:bg-[#1E1F21]/85 dark:shadow-2xl transition-all focus-within:ring-2 focus-within:ring-foreground/10 dark:focus-within:ring-white/10 hover:border-foreground/20 text-left">
                      <Textarea
                        placeholder={t("fields.prompt.placeholder")}
                        className="min-h-[140px] resize-none pb-14 pt-5 px-6 bg-transparent border-0 focus-visible:ring-0 text-foreground text-lg shadow-none placeholder:text-foreground/40 font-medium"
                        onKeyDown={handlePromptKeyDown}
                        {...field}
                      />

                      {/* Action Bar Inside Textarea */}
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/70 flex items-center justify-center cursor-pointer transition-colors"
                            title="Add assets"
                          >
                            <HugeiconsIcon
                              icon={Add01Icon}
                              strokeWidth={2.5}
                              className="w-4 h-4"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div
                            className="text-foreground/40 hover:text-foreground/80 cursor-pointer transition-colors"
                            title="Voice to text"
                          >
                            <HugeiconsIcon
                              icon={Mic01Icon}
                              strokeWidth={2}
                              className="w-5 h-5 mr-1"
                            />
                          </div>
                          <Button
                            disabled={isGenerating}
                            type="submit"
                            size="icon"
                            className="w-9 h-9 relative rounded-full bg-foreground text-background hover:scale-105 transition-all outline-none border-none"
                          >
                            {isGenerating ? (
                              <HugeiconsIcon
                                icon={Loading01Icon}
                                strokeWidth={2.5}
                                className="w-5 h-5 animate-spin"
                              />
                            ) : (
                              <HugeiconsIcon
                                icon={ArrowUp01Icon}
                                strokeWidth={3}
                                className="w-5 h-5"
                              />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </FormControl>
                  {isGenerating && (
                    <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-center animate-in fade-in">
                      <div className="flex w-full max-w-[260px] flex-col items-center gap-2">
                        <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${generationProgress}%` }}
                          />
                        </div>
                        {statusMessage ? (
                          <p className="text-xs text-foreground/60">
                            {statusMessage}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <FormMessage className="text-center" />
                </FormItem>
              )}
            />

            <Collapsible
              open={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
              className="w-full"
            >
              <div className="flex items-center justify-center mt-6">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 h-8 px-4 gap-2 text-xs font-medium uppercase tracking-wider"
                  >
                    <HugeiconsIcon
                      icon={Settings01Icon}
                      strokeWidth={2.5}
                      className="w-3.5 h-3.5"
                    />
                    {t("parameters")}
                    <HugeiconsIcon
                      icon={isSettingsOpen ? ArrowDown01Icon : ArrowRight01Icon}
                      strokeWidth={2.5}
                      className="w-3.5 h-3.5"
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>

              <CollapsibleContent className="mt-8 space-y-8 text-left bg-card/50 backdrop-blur-md border border-border/50 p-6 md:p-8 rounded-[24px] shadow-sm animate-in fade-in zoom-in-95 duration-200">
                <div className="space-y-2 rounded-2xl border border-border/60 bg-background/70 p-4">
                  <h3 className="text-base font-semibold tracking-tight">
                    {t("veoSettings")}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t("veoSettingsDescription")}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="platform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.platform.label")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("fields.platform.placeholder")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tiktok">
                              {t("fields.platform.options.tiktok")}
                            </SelectItem>
                            <SelectItem value="instagram">
                              {t("fields.platform.options.instagram")}
                            </SelectItem>
                            <SelectItem value="youtube">
                              {t("fields.platform.options.youtube")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.language.label")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("fields.language.placeholder")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="en">
                              {t("fields.language.options.en")}
                            </SelectItem>
                            <SelectItem value="de">
                              {t("fields.language.options.de")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="aspect_ratio"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t("fields.aspectRatio.label")}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-row space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="9:16" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {t("fields.aspectRatio.options.9:16")}
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="1:1" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {t("fields.aspectRatio.options.1:1")}
                              </FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="16:9" />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {t("fields.aspectRatio.options.16:9")}
                              </FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration_sec"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>{t("fields.duration.label")}</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-row space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="8" />
                              </FormControl>
                              <FormLabel className="font-normal">8</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="`15`" />
                              </FormControl>
                              <FormLabel className="font-normal">15</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="30" />
                              </FormControl>
                              <FormLabel className="font-normal">30</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <RadioGroupItem value="60" />
                              </FormControl>
                              <FormLabel className="font-normal">60</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {t("fields.duration.note")}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Optional Branding & Style section */}
                <div className="space-y-4">
                  <div className="space-y-2 rounded-2xl border border-border/60 bg-background/70 p-4">
                    <h3 className="text-base font-semibold tracking-tight">
                      {t("promptInputs")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {t("promptInputsDescription")}
                    </p>
                  </div>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {t("styleBranding")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="tone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("fields.tone.label")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t("fields.tone.placeholder")}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="direct">
                                {t("fields.tone.options.direct")}
                              </SelectItem>
                              <SelectItem value="casual">
                                {t("fields.tone.options.casual")}
                              </SelectItem>
                              <SelectItem value="energetic">
                                {t("fields.tone.options.energetic")}
                              </SelectItem>
                              <SelectItem value="funny">
                                {t("fields.tone.options.funny")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            {t("fields.subtitleStyle.note")}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="target_audience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("fields.targetAudience.label")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder={t(
                                "fields.targetAudience.placeholder",
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="subtitle_style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("fields.subtitleStyle.label")}
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={t(
                                    "fields.subtitleStyle.placeholder",
                                  )}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="standard">
                                {t("fields.subtitleStyle.options.standard")}
                              </SelectItem>
                              <SelectItem value="kinetic">
                                {t("fields.subtitleStyle.options.kinetic")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="cta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.cta.label")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("fields.cta.placeholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Product Information Form */}
                <Collapsible
                  open={isProductOpen}
                  onOpenChange={setIsProductOpen}
                  className="w-full space-y-2"
                >
                  <div className="flex items-center justify-between space-x-4 px-1">
                    <h3 className="text-lg font-semibold tracking-tight">
                      {t("productDetails.title")}
                    </h3>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-9 p-0">
                        {isProductOpen ? (
                          <HugeiconsIcon
                            icon={ArrowDown01Icon}
                            strokeWidth={2}
                            className="h-4 w-4"
                          />
                        ) : (
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            strokeWidth={2}
                            className="h-4 w-4"
                          />
                        )}
                        <span className="sr-only">Toggle</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  <CollapsibleContent className="space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {t("productDetails.provideDetails")}
                        </CardTitle>
                        <CardDescription>
                          {t("productDetails.description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="product_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("fields.productName.label")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={t(
                                    "fields.productName.placeholder",
                                  )}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="product_description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("fields.productDescription.label")}
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={t(
                                    "fields.productDescription.placeholder",
                                  )}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="product_benefits"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {t("fields.productBenefits.label")}
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder={t(
                                    "fields.productBenefits.placeholder",
                                  )}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">
                          {t("externalSources.title")}
                        </CardTitle>
                        <CardDescription>
                          {t("externalSources.description")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="product_urls"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <HugeiconsIcon
                                  icon={Link01Icon}
                                  strokeWidth={2}
                                  className="h-4 w-4 text-muted-foreground"
                                />
                                {t("fields.productUrls.label")}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://example.com/product"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="space-y-2">
                          <FormLabel className="flex items-center gap-2">
                            <HugeiconsIcon
                              icon={Upload01Icon}
                              strokeWidth={2}
                              className="h-4 w-4 text-muted-foreground"
                            />
                            {t("fields.brandAssets.label")}
                          </FormLabel>
                          <Input
                            type="file"
                            multiple
                            className="cursor-pointer file:text-primary file:bg-primary/10 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-md hover:file:bg-primary/20 transition-colors"
                          />
                          <p className="text-[0.8rem] text-muted-foreground">
                            {t("fields.brandAssets.note")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </form>
      </Form>
    </div>
  );
}
