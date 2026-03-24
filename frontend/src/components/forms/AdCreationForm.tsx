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
import { useState } from "react";
import { createAdJob, getAdJobStatus } from "@/lib/api";
import { useTranslations } from "next-intl";

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
  voice_id: z.string().optional(),
});

export function AdCreationForm() {
  const t = useTranslations();
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [videoResult, setVideoResult] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
      voice_id: "female_en_01",
    },
  });

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void form.handleSubmit(onSubmit)();
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsGenerating(true);
      setGenerationProgress(0);
      setStatusMessage(t("status.generating"));

      const payload = {
        prompt: values.prompt,
        platform: values.platform,
        aspect_ratio: values.aspect_ratio,
        duration_sec: parseInt(values.duration_sec, 10),
        language: values.language,
        tone: values.tone,
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
        voice_id: values.voice_id,
      };

      const job = await createAdJob(payload);

      const pollInterval = window.setInterval(async () => {
        try {
          const status = await getAdJobStatus(job.id);

          setGenerationProgress((current) => Math.min(current + 15, 95));

          if (status.status === "completed" && status.video_url) {
            window.clearInterval(pollInterval);
            setGenerationProgress(100);
            setVideoResult(status.video_url);
            setStatusMessage(null);
            setIsGenerating(false);
            return;
          }

          if (status.status === "failed") {
            window.clearInterval(pollInterval);
            setIsGenerating(false);
            setStatusMessage(null);
            alert(status.error ?? t("errors.generationFailed"));
          }
        } catch (pollError) {
          window.clearInterval(pollInterval);
          setIsGenerating(false);
          setStatusMessage(null);
          console.error(pollError);
          alert(t("errors.generationFailed"));
        }
      }, 3000);
    } catch (error) {
      console.error(error);
      setIsGenerating(false);
      window.dispatchEvent(
        new CustomEvent("phanes-toast", {
          detail: {
            title: t("errors.generationFailedTitle"),
            description: t("errors.generationFailed"),
            variant: "error",
          },
        }),
      );
    }
  }

  if (videoResult) {
    return (
      <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <video
          src={videoResult}
          controls
          autoPlay
          className="w-full max-w-[400px] h-[720px] object-cover bg-black rounded-[32px] shadow-2xl border border-white/10"
        />
        <Button
          onClick={() => {
            setVideoResult(null);
            setGenerationProgress(0);
          }}
          variant="outline"
          className="mt-8 rounded-full px-8 h-12 text-sm uppercase tracking-wider font-semibold"
        >
          {t("result.createAnother")}
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="relative z-20 space-y-4 w-full"
      >
        <div className="space-y-4">
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
                        <p className="text-xs text-foreground/60">{statusMessage}</p>
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Optional Branding & Style section */}
              <div className="space-y-4">
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
                            placeholder={t("fields.targetAudience.placeholder")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="voice_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.voice.label")}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t("fields.voice.placeholder")}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="female_en_01">
                              {t("fields.voice.options.female1")}
                            </SelectItem>
                            <SelectItem value="male_en_01">
                              {t("fields.voice.options.male1")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subtitle_style"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("fields.subtitleStyle.label")}</FormLabel>
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
  );
}
