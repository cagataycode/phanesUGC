import Image from "next/image";
import { AdCreationForm } from "@/components/forms/AdCreationForm";
import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();

  return (
    <div className="min-h-screen bg-background bg-mesh-blur relative overflow-hidden font-sans">
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pb-10 pt-[14vh] text-center sm:px-6">
        <div className="pointer-events-none absolute inset-x-0 top-[3.75rem] flex justify-center z-0 opacity-[0.06] dark:opacity-[0.1] sm:top-[4.5rem]">
          <Image
            src="/icons/PhanesLogo-stroke.svg"
            alt="Phanes"
            width={820}
            height={960}
            aria-hidden="true"
            priority
            className="h-auto w-[min(88vw,22rem)] max-w-none select-none object-contain dark:invert sm:w-[min(70vw,28rem)] lg:w-[min(62vw,40rem)]"
          />
        </div>

        <h1 className="relative z-10 mb-5 max-w-4xl text-balance text-4xl font-extrabold leading-[0.95] tracking-tight md:text-5xl lg:text-[4.35rem]">
          {t("app.name")}
        </h1>
        <p className="relative z-10 mb-10 max-w-2xl text-balance text-lg font-medium text-foreground/70 md:text-xl">
          {t("app.tagline")}
        </p>

        <div className="relative z-10 w-full max-w-4xl">
          <AdCreationForm />
        </div>
      </main>
    </div>
  );
}
