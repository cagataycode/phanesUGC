import { ResultClient } from "./result-client";

type ResultsPageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { id } = await params;

  return <ResultClient id={id} />;
}
