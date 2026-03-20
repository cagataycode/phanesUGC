import { AdCreationForm } from "@/components/forms/AdCreationForm"
import { Navbar } from "@/components/layout/Navbar"

export default function Home() {
  return (
    <div className="min-h-screen bg-background bg-mesh-blur relative overflow-hidden font-sans">
      <Navbar />
      
      <main className="flex flex-col items-center justify-center min-h-screen pt-[15vh] pb-10 px-4 sm:px-6 z-10 relative text-center">
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-foreground/5 border border-foreground/10 text-sm mb-8 max-w-sm transition-colors hover:bg-foreground/10 cursor-pointer">
          <span className="bg-[#3b82f6] text-white text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full tracking-wide shrink-0">New</span>
          <span className="text-foreground/80 truncate font-medium">Generate social video ads with AI</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-foreground/50 shrink-0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </div>

        <h1 className="text-4xl md:text-5xl lg:text-[4.2rem] font-extrabold tracking-tight mb-5 max-w-4xl text-balance leading-tight">
          Build something lovable
        </h1>
        <p className="text-lg md:text-xl text-foreground/70 mb-12 max-w-2xl text-balance font-medium">
          Create ready-to-export video ads by chatting with AI
        </p>

        <div className="w-full max-w-3xl">
          <AdCreationForm />
        </div>

      </main>
    </div>
  )
}
