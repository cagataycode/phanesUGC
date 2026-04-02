'use client';

import { AdCreationWizard } from '@/components/wizard';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function CreatePage() {
  const router = useRouter();
  const locale = useLocale();

  const handleJobCreated = (jobId: string) => {
    router.push(`/${locale}/results/${jobId}`);
  };

  return (
    <div className="min-h-screen bg-background bg-mesh-blur relative overflow-hidden font-sans">
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10">
        <div className="relative z-10 w-full max-w-3xl">
          <AdCreationWizard onJobCreated={handleJobCreated} />
        </div>
      </main>
    </div>
  );
}
