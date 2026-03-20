# Design System — Phanes UGC

**Date:** 2026-03-20  
**Version:** 1.0  
**Status:** Active  
**Audience:** Frontend Engineering, Design

---

## 1. Overview

This document defines the design system for the Phanes UGC prompt-to-ad video platform. The system is built entirely on **shadcn/ui** components using the **Mira** preset.

All styling is driven by **CSS custom properties (CSS variables)** in the **OKLCH** color space, consumed via **Tailwind CSS v4** utility classes. Components are not custom-built from scratch; instead, they are installed directly from the shadcn/ui CLI and composed into product-specific patterns.

---

## 2. Foundation

### 2.1 Technology Stack

| Layer | Choice |
|---|---|
| Component library | shadcn/ui (New York style) |
| CSS framework | Tailwind CSS v4 |
| Color space | OKLCH |
| Icons | Lucide React |
| Typography | Geist (same as shadcn/ui website) |
| Font source | `next/font/google` or Vercel Geist package |

### 2.2 shadcn/ui Configuration (`components.json`)

```json
{
  "style": "new-york",
  "rsc": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

---

## 3. Color Palette

The palette is the **exact shadcn/ui Mira preset theme** in OKLCH. Do not override these values unless introducing a product-specific semantic extension (see §3.3).

### 3.1 Light Mode (`:root`)

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}
```

### 3.2 Dark Mode (`.dark`)

```css
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.205 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.205 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.556 0 0);
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.556 0 0);
}
```

### 3.3 Product Semantic Extensions

These are **additive** product-specific tokens layered on top of the base palette. They use the shadcn/ui extension pattern.

```css
/* Add to globals.css */
:root {
  /* Pipeline stage status colors */
  --success:              oklch(0.74 0.17 142);
  --success-foreground:   oklch(0.22 0.06 145);

  --warning:              oklch(0.84 0.16 84);
  --warning-foreground:   oklch(0.28 0.07 46);

  --info:                 oklch(0.7 0.15 240);
  --info-foreground:      oklch(0.22 0.06 250);
}

.dark {
  --success:              oklch(0.42 0.12 145);
  --success-foreground:   oklch(0.97 0.02 143);

  --warning:              oklch(0.41 0.11 46);
  --warning-foreground:   oklch(0.99 0.02 95);

  --info:                 oklch(0.35 0.1 250);
  --info-foreground:      oklch(0.95 0.02 245);
}

@theme inline {
  --color-success:              var(--success);
  --color-success-foreground:   var(--success-foreground);
  --color-warning:              var(--warning);
  --color-warning-foreground:   var(--warning-foreground);
  --color-info:                 var(--info);
  --color-info-foreground:      var(--info-foreground);
}
```

---

## 4. Typography

The system mirrors the shadcn/ui website's typographic choices.

### 4.1 Font Family

```css
/* globals.css — using Geist as primary font */
:root {
  --font-sans: 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
}
```

Install via:
```bash
npm install geist
```

Usage in Next.js `layout.tsx`:
```tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
```

### 4.2 Type Scale

| Token | Class | Size | Weight | Use |
|---|---|---|---|---|
| Display | `text-4xl font-bold tracking-tight` | 36px | 700 | Page headers |
| Heading 1 | `text-3xl font-semibold tracking-tight` | 30px | 600 | Section titles |
| Heading 2 | `text-2xl font-semibold tracking-tight` | 24px | 600 | Card titles |
| Heading 3 | `text-xl font-semibold` | 20px | 600 | Sub-section titles |
| Body Large | `text-base` | 16px | 400 | Default body text |
| Body Small | `text-sm` | 14px | 400 | Secondary text |
| Caption | `text-xs text-muted-foreground` | 12px | 400 | Labels, timestamps |
| Code | `font-mono text-sm` | 14px | 400 | Code snippets |

---

## 5. Spacing & Layout

All spacing follows the Tailwind 4-point grid system.

| Scale | Value | Common Use |
|---|---|---|
| `space-1` | 4px | Tight inline gaps |
| `space-2` | 8px | Icon-label gaps |
| `space-3` | 12px | Input padding |
| `space-4` | 16px | Card padding, default gap |
| `space-6` | 24px | Section spacing |
| `space-8` | 32px | Container padding |
| `space-12` | 48px | Page section gaps |
| `space-16` | 64px | Hero/page sections |

### Border Radius

Follows the `--radius` token (`0.625rem` = 10px base):

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | `calc(var(--radius) - 4px)` | Tags, badges |
| `rounded-md` | `calc(var(--radius) - 2px)` | Buttons, inputs |
| `rounded-lg` | `var(--radius)` | Cards, panels |
| `rounded-xl` | `calc(var(--radius) + 4px)` | Modals, drawers |

---

## 6. Core Component Library

All components are installed via the shadcn/ui CLI. Do not hand-roll equivalents.

```bash
npx shadcn@latest add <component-name>
```

### 6.1 Component Inventory

#### Layout & Navigation
| Component | shadcn Name | Primary Use |
|---|---|---|
| Sidebar | `sidebar` | App shell navigation |
| Navigation Menu | `navigation-menu` | Top nav |
| Breadcrumb | `breadcrumb` | Page location |
| Tabs | `tabs` | Section switching |
| Sheet | `sheet` | Mobile nav drawer |
| Separator | `separator` | Visual dividers |

#### Forms & Inputs
| Component | shadcn Name | Primary Use |
|---|---|---|
| Button | `button` | All CTAs and actions |
| Input | `input` | Text entry |
| Textarea | `textarea` | Prompt input |
| Select | `select` | Platform, duration, tone |
| Checkbox | `checkbox` | Options |
| Radio Group | `radio-group` | Aspect ratio selection |
| Switch | `switch` | Toggle flags |
| Slider | `slider` | Volume controls |
| Label | `label` | Form labels |
| Form | `form` | React Hook Form integration |

#### Data Display
| Component | shadcn Name | Primary Use |
|---|---|---|
| Card | `card` | Project tiles, result containers |
| Table | `table` | Project lists |
| Badge | `badge` | Status pills, pipeline stages |
| Avatar | `avatar` | User profile |
| Progress | `progress` | Generation progress bar |
| Skeleton | `skeleton` | Loading states |
| Separator | `separator` | Content dividers |

#### Feedback & Overlays
| Component | shadcn Name | Primary Use |
|---|---|---|
| Alert | `alert` | Inline feedback messages |
| Alert Dialog | `alert-dialog` | Destructive action confirmation |
| Toast / Sonner | `sonner` | Transient notifications |
| Dialog | `dialog` | Modals (regenerate, preview) |
| Drawer | `drawer` | Mobile-first bottom sheets |
| Tooltip | `tooltip` | Icon label hints |
| Popover | `popover` | Inline detail overlays |
| Hover Card | `hover-card` | Preview-on-hover |

#### Navigation & Commands
| Component | shadcn Name | Primary Use |
|---|---|---|
| Command | `command` | Search palette |
| Dropdown Menu | `dropdown-menu` | Action menus |
| Context Menu | `context-menu` | Right-click actions |
| Collapsible | `collapsible` | Expandable sections |
| Accordion | `accordion` | FAQ, settings groups |

#### Visualization
| Component | shadcn Name | Primary Use |
|---|---|---|
| Chart (Area) | `chart` | Generation metrics |
| Chart (Bar) | `chart` | Usage stats |

---

## 7. Component Usage Patterns

### 7.1 Pipeline Stage Badge

Use `Badge` with semantic color classes to represent job stages.

```tsx
import { Badge } from "@/components/ui/badge"

const stageVariant = {
  queued:      "secondary",
  processing:  "outline",
  rendering:   "default",
  completed:   "default",   // + bg-success class
  failed:      "destructive",
} as const

<Badge variant={stageVariant[stage]}>{stage}</Badge>
```

### 7.2 Generation Progress

Use `Progress` with `aria-label` for accessibility.

```tsx
import { Progress } from "@/components/ui/progress"

<Progress value={progress} aria-label="Generation progress" className="h-2" />
```

### 7.3 Ad Creation Form

The form wraps shadcn/ui `Form` (React Hook Form + Zod) around `Input`, `Select`, `Textarea`, and `Button` components.

```tsx
// Required fields layout
<Form>
  <FormField name="prompt">
    <Textarea placeholder="Describe your ad..." rows={4} />
  </FormField>
  <FormField name="platform">
    <Select> {/* tiktok | reels | shorts */} </Select>
  </FormField>
  <FormField name="duration_sec">
    <RadioGroup> {/* 15 | 30 | 45 | 60 */} </RadioGroup>
  </FormField>
  <FormField name="language">
    <Select> {/* language list */} </Select>
  </FormField>
  <Button type="submit">Generate Ad</Button>
</Form>
```

### 7.4 Result Video Preview

Wrap the video player in a `Card` with action buttons below.

```tsx
<Card>
  <CardContent className="p-0 aspect-[9/16] overflow-hidden rounded-t-lg">
    <video src={videoUrl} controls className="w-full h-full object-cover" />
  </CardContent>
  <CardFooter className="flex gap-2 pt-4">
    <Button variant="default">Download MP4</Button>
    <Button variant="outline">Regenerate</Button>
    <Button variant="ghost" size="icon"><Share2 /></Button>
  </CardFooter>
</Card>
```

### 7.5 Notifications

Use `sonner` (shadcn's recommended toast library) for all transient feedback.

```tsx
import { toast } from "sonner"

toast.success("Ad generated successfully!")
toast.error("Render failed. Please try again.")
toast.loading("Generating your ad...")
```

---

## 8. Dark Mode

The application supports dark mode. Implementation uses Next.js with `next-themes`.

```tsx
// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"

<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
  {children}
</ThemeProvider>
```

The `ThemeProvider` component is installed via:
```bash
npx shadcn@latest add theme-provider
```

Default theme for the product is **dark** — matching the shadcn/ui site default and the aesthetic target for a modern AI tool.

---

## 9. Iconography

All icons use **Lucide React** (the shadcn/ui default icon set).

```bash
npm install lucide-react
```

### Common Icons by Context

| Context | Icon | Lucide Name |
|---|---|---|
| Generate / Create | `Wand2` | `wand-2` |
| Download | `Download` | `download` |
| Regenerate | `RefreshCw` | `refresh-cw` |
| Delete | `Trash2` | `trash-2` |
| Settings | `Settings2` | `settings-2` |
| Video file | `Clapperboard` | `clapperboard` |
| Stage: script | `FileText` | `file-text` |
| Stage: audio | `Mic2` | `mic-2` |
| Stage: render | `Film` | `film` |
| Stage: done | `CheckCircle2` | `check-circle-2` |
| Stage: failed | `XCircle` | `x-circle` |
| Upload | `Upload` | `upload` |
| Link / URL | `Link2` | `link-2` |
| Platform: TikTok | custom SVG | — |
| Platform: Instagram | custom SVG | — |
| Platform: YouTube | custom SVG | — |

---

## 10. Screen-by-Screen Component Map

### Screen 1: Create Ad Form

| UI Element | Component |
|---|---|
| Page title | `h1` (Display type style) |
| Prompt textarea | `Textarea` in `FormField` |
| Platform select | `Select` in `FormField` |
| Aspect ratio | `RadioGroup` |
| Duration | `RadioGroup` (15/30/45/60s) |
| Language | `Select` |
| Tone/Style | `Select` (Optional fields) |
| Target audience | `Input` |
| CTA text | `Input` |
| Product info section | `Card` with `Collapsible` |
| URL input | `Input` with `Button` (Add) |
| Asset upload | `Input type="file"` styled with `Button` |
| Subtitle style | `Select` |
| Voice select | `Select` |
| Submit | `Button` (full width, primary) |

### Screen 2: Job Progress

| UI Element | Component |
|---|---|
| Overall progress | `Progress` |
| Stage list | List of `Badge` items |
| Stage status icons | Lucide `CheckCircle2`, `Loader2`, `XCircle` |
| Spinner | `Loader2` icon with `animate-spin` |
| Stage description | `p` with `text-muted-foreground` |
| Cancel button | `Button` (destructive, outline) |

### Screen 3: Result View

| UI Element | Component |
|---|---|
| Video preview | `Card` with `<video>` |
| Download button | `Button` (primary) |
| Regenerate full | `Button` (outline) |
| Scene regenerate | `Button` (ghost, per scene) |
| Transcript panel | `Card` with scrollable `pre` |
| Subtitle data | `Card` with `Table` |
| Share / copy link | `Button` (icon) + `Tooltip` |
| Success toast | `sonner` toast |

---

## 11. Accessibility Standards

- All interactive elements must have accessible labels (via `aria-label` or visible `Label` components)
- Color contrast must meet WCAG AA (the shadcn Neutral palette satisfies this by design)
- Focus rings use `--ring` token and must be visible in both modes
- Keyboard navigation must work for all modals, dropdowns, and forms
- Loading states must use `aria-busy` and `aria-label` on progress indicators
- Use `sr-only` for visually hidden but screen-reader-accessible labels

---

## 12. Animation & Motion

Use the Tailwind animation utilities that ship with shadcn/ui. Avoid `framer-motion` unless explicitly needed for complex interactions.

```css
/* Already included via shadcn/ui install */
animate-in
animate-out
fade-in
fade-out
slide-in-from-bottom-2
zoom-in-95
```

For page transitions, use Next.js App Router's built-in scroll restoration and loading UI (`loading.tsx`).

---

## 13. File & Folder Conventions

```text
apps/web/
  app/
    globals.css          ← CSS variable definitions (§3)
    layout.tsx           ← ThemeProvider, font setup
  components/
    ui/                  ← shadcn/ui installed components (do not edit)
    layout/              ← Shell, Sidebar, Header
    forms/               ← Ad creation form composites
    progress/            ← Job progress components
    result/              ← Result view components
    shared/              ← Reusable cross-screen components
  lib/
    utils.ts             ← cn() from shadcn/ui
    fonts.ts             ← Geist font config
```

> **Rule**: Never modify files inside `components/ui/`. Compose from them in `components/forms/`, `components/result/`, etc.

---

## 14. Installation Checklist

Run these commands in the `apps/web` directory to set up the design system:

```bash
# 1. Init shadcn/ui
npx shadcn@latest init

# 2. Install all required components
npx shadcn@latest add button input textarea select checkbox radio-group switch slider label form
npx shadcn@latest add card table badge avatar progress skeleton separator
npx shadcn@latest add alert alert-dialog sonner dialog drawer tooltip popover hover-card
npx shadcn@latest add command dropdown-menu context-menu collapsible accordion
npx shadcn@latest add sidebar navigation-menu breadcrumb tabs sheet
npx shadcn@latest add chart

# 3. Install icons and fonts
npm install lucide-react geist

# 4. Install theme provider and dark mode
npx shadcn@latest add theme-provider

# 5. Install form library
npm install react-hook-form @hookform/resolvers zod
```
