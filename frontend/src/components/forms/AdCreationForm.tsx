"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { HugeiconsIcon } from "@hugeicons/react"
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon"
import ArrowRight01Icon from "@hugeicons/core-free-icons/ArrowRight01Icon"
import Link01Icon from "@hugeicons/core-free-icons/Link01Icon"
import Upload01Icon from "@hugeicons/core-free-icons/Upload01Icon"
import Add01Icon from "@hugeicons/core-free-icons/Add01Icon"
import Mic01Icon from "@hugeicons/core-free-icons/Mic01Icon"
import Settings01Icon from "@hugeicons/core-free-icons/Settings01Icon"
import ArrowUp01Icon from "@hugeicons/core-free-icons/ArrowUp01Icon"
import Loading01Icon from "@hugeicons/core-free-icons/Loading01Icon"
import { useState } from "react"
import { createAdJob, getAdJobStatus, getAdJobResult } from "@/lib/api"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"

const formSchema = z.object({
  prompt: z.string().min(5, "Prompt must be at least 5 characters."),
  aspect_ratio: z.enum(["9:16", "1:1", "16:9"]),
  duration_sec: z.enum(["8", "15", "30", "45", "60"]),
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
})

export function AdCreationForm() {
  const [isProductOpen, setIsProductOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [videoResult, setVideoResult] = useState<string | null>(null)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      prompt: "",
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
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setIsGenerating(true)
      setGenerationProgress(0)

      // Format payload to exactly match PRD Sec 11.1
      const payload = {
        prompt: values.prompt,
        platform: "tiktok", // Default platform
        aspect_ratio: values.aspect_ratio,
        duration_sec: parseInt(values.duration_sec, 10),
        language: values.language,
        tone: values.tone,
        cta: values.cta,
        product_info: {
          name: values.product_name,
          description: values.product_description,
          benefits: values.product_benefits ? values.product_benefits.split(",").map(b => b.trim()) : [],
        },
        urls: values.product_urls ? [values.product_urls] : [],
        subtitle_style: values.subtitle_style,
        voice_id: values.voice_id
      }
      
      const job = await createAdJob(payload)
      
      const pollInterval = window.setInterval(async () => {
        try {
          const status = await getAdJobStatus(job.id)
          setGenerationProgress(status.progress || 0)
          
          if (status.status === 'completed' || status.progress >= 100) {
            window.clearInterval(pollInterval)
            const result = await getAdJobResult(job.id)
            setVideoResult(result.video_url)
            setIsGenerating(false)
          } else if (status.status === 'failed') {
            window.clearInterval(pollInterval)
            setIsGenerating(false)
            alert("Backend generation failed: " + status.error_message)
          }
        } catch (err) {
          console.error("Polling error", err)
        }
      }, 1500)
      
    } catch (error) {
      console.error(error)
      setIsGenerating(false)
      alert("Failed to generate ad. Check console for details.")
    }
  }

  if (videoResult) {
    return (
      <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
        <video src={videoResult} controls autoPlay className="w-full max-w-[400px] h-[720px] object-cover bg-black rounded-[32px] shadow-2xl border border-white/10" />
        <Button onClick={() => setVideoResult(null)} variant="outline" className="mt-8 rounded-full px-8 h-12 text-sm uppercase tracking-wider font-semibold">
          Create Another Video
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="prompt"
            render={({ field }) => (
              <FormItem className="relative">
                <FormControl>
                  <div className="relative group rounded-[24px] overflow-hidden bg-foreground/5 border border-foreground/10 shadow-lg dark:bg-[#1E1F21] dark:border-white/5 dark:shadow-2xl transition-all focus-within:ring-2 focus-within:ring-foreground/10 dark:focus-within:ring-white/10 hover:border-foreground/20 text-left">
                    <Textarea 
                      placeholder="Ask Phanes to create an ad about..." 
                      className="min-h-[140px] resize-none pb-14 pt-5 px-6 bg-transparent border-0 focus-visible:ring-0 text-foreground text-lg shadow-none placeholder:text-foreground/40 font-medium"
                      {...field} 
                    />
                    
                    {/* Action Bar Inside Textarea */}
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-foreground/5 hover:bg-foreground/10 text-foreground/70 flex items-center justify-center cursor-pointer transition-colors" title="Add assets">
                          <HugeiconsIcon icon={Add01Icon} strokeWidth={2.5} className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-foreground/40 hover:text-foreground/80 cursor-pointer transition-colors" title="Voice to text">
                          <HugeiconsIcon icon={Mic01Icon} strokeWidth={2} className="w-5 h-5 mr-1" />
                        </div>
                        <Button disabled={isGenerating} type="submit" size="icon" className="w-9 h-9 relative rounded-full bg-foreground text-background hover:scale-105 transition-all outline-none border-none">
                          {isGenerating ? (
                            <HugeiconsIcon icon={Loading01Icon} strokeWidth={2.5} className="w-5 h-5 animate-spin" />
                          ) : (
                            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={3} className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </FormControl>
                {isGenerating && (
                  <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-center animate-in fade-in">
                      <div className="w-full max-w-[200px] h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                         <div className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${generationProgress}%` }} />
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
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 h-8 px-4 gap-2 text-xs font-medium uppercase tracking-wider">
                  <HugeiconsIcon icon={Settings01Icon} strokeWidth={2.5} className="w-3.5 h-3.5" />
                  Parameters & Settings
                  <HugeiconsIcon icon={isSettingsOpen ? ArrowDown01Icon : ArrowRight01Icon} strokeWidth={2.5} className="w-3.5 h-3.5" />
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="mt-8 space-y-8 text-left bg-card/50 backdrop-blur-md border border-border/50 p-6 md:p-8 rounded-[24px] shadow-sm animate-in fade-in zoom-in-95 duration-200">


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="de">German</SelectItem>
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
                  <FormLabel>Aspect Ratio</FormLabel>
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
                          9:16 (Vertical)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="1:1" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          1:1 (Square)
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="16:9" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          16:9 (Horizontal)
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
                  <FormLabel>Duration (seconds)</FormLabel>
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
                          <RadioGroupItem value="15" />
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
                          <RadioGroupItem value="45" />
                        </FormControl>
                        <FormLabel className="font-normal">45</FormLabel>
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
          <h3 className="text-lg font-semibold tracking-tight">Style & Branding</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="tone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="direct">Direct & Professional</SelectItem>
                      <SelectItem value="casual">Casual & Conversational</SelectItem>
                      <SelectItem value="energetic">Energetic & Hype</SelectItem>
                      <SelectItem value="funny">Humorous</SelectItem>
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
                  <FormLabel>Target Audience</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Small business owners" {...field} />
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
                  <FormLabel>Voice</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="female_en_01">Female 1 (English)</SelectItem>
                      <SelectItem value="male_en_01">Male 1 (English)</SelectItem>
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
                  <FormLabel>Subtitle Style</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="standard">Standard Bold</SelectItem>
                      <SelectItem value="kinetic">Kinetic Highlight</SelectItem>
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
                <FormLabel>Call to Action (CTA)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Click the link to start your free trial" {...field} />
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
            <h3 className="text-lg font-semibold tracking-tight">Product Information</h3>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-9 p-0">
                {isProductOpen ? (
                  <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} className="h-4 w-4" />
                ) : (
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Provide Product Details</CardTitle>
                <CardDescription>
                  Enter manual product details so the AI has more context.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="product_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. AdPilot" {...field} />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Quick overview of the product..." {...field} />
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
                      <FormLabel>Benefits</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Comma separated benefits (e.g. saves time, auto subtitles)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">External Sources</CardTitle>
                <CardDescription>
                  Optionally paste URLs to scrape or upload assets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="product_urls"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <HugeiconsIcon icon={Link01Icon} strokeWidth={2} className="h-4 w-4 text-muted-foreground" />
                        Product URLs
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/product" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-2">
                  <FormLabel className="flex items-center gap-2">
                    <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} className="h-4 w-4 text-muted-foreground" />
                    Brand Assets
                  </FormLabel>
                  <Input type="file" multiple className="cursor-pointer file:text-primary file:bg-primary/10 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-md hover:file:bg-primary/20 transition-colors" />
                  <p className="text-[0.8rem] text-muted-foreground">
                    Upload optional brand images or videos.
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
  )
}
