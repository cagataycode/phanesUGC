import { NextResponse } from 'next/server';

const BACKEND_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const response = await fetch(`${BACKEND_API_BASE_URL}/ads/${id}`, {
    method: 'GET',
    cache: 'no-store',
  });

  const text = await response.text();

  return new NextResponse(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
