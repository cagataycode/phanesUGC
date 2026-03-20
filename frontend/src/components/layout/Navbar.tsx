import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/20 backdrop-blur-2xl border-b border-foreground/5 dark:border-white/5">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          {/* Logo resembling Lovable's multi-layered circle block */}
          <div className="w-6 h-6 rounded-[8px] bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500 shadow-sm" />
          <span className="font-bold text-lg tracking-tight">Phanes UGC</span>
        </Link>
        <div className="hidden lg:flex items-center gap-5 text-sm font-medium text-foreground/70 dark:text-foreground/80">
          <Link href="#" className="hover:text-foreground transition-colors flex items-center gap-1">
            Solutions
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="m6 9 6 6 6-6"/></svg>
          </Link>
          <Link href="#" className="hover:text-foreground transition-colors flex items-center gap-1">
            Resources
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><path d="m6 9 6 6 6-6"/></svg>
          </Link>
          <Link href="#" className="hover:text-foreground transition-colors">Enterprise</Link>
          <Link href="#" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="#" className="hover:text-foreground transition-colors">Community</Link>
          <Link href="#" className="hover:text-foreground transition-colors">Security</Link>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Button variant="ghost" className="hidden sm:inline-flex text-sm border-foreground/10 hover:bg-foreground/5 h-8 px-4 font-normal">
          Log in
        </Button>
        <Button className="h-8 px-4 rounded-md font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors">
          Get started
        </Button>
      </div>
    </nav>
  )
}
