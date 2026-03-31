import { NextResponse } from 'next/server';

// Use server-only env var to prevent recursive calls
// BACKEND_API_URL should be an absolute URL like http://backend:3001/api
const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_URL ?? 'http://localhost:3001/api';

// Validate that we have an absolute URL to prevent recursion
if (!BACKEND_API_BASE_URL.startsWith('http://') && !BACKEND_API_BASE_URL.startsWith('https://')) {
  throw new Error(
    'BACKEND_API_URL must be an absolute URL (http:// or https://). Got: ' + BACKEND_API_BASE_URL
  );
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const searchParams = url.searchParams.toString();
  const query = searchParams ? `?${searchParams}` : '';

  const authHeader = request.headers.get('authorization');
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  const response = await fetch(`${BACKEND_API_BASE_URL}/ads/${id}/result${query}`, {
    method: 'GET',
    headers,
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
