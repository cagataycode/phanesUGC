import { NextRequest, NextResponse } from 'next/server';

const BACKEND_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

export async function POST(request: NextRequest) {
  const bodyText = await request.text();
  let bodyJson: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(bodyText) as unknown;
    if (typeof parsed === 'object' && parsed !== null) {
      bodyJson = parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid JSON
  }

  const authHeader = request.headers.get('authorization');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  if (typeof bodyJson.businessId === 'string' && bodyJson.businessId) {
    headers['x-business-id'] = bodyJson.businessId;
  }

  const response = await fetch(`${BACKEND_API_BASE_URL}/ads`, {
    method: 'POST',
    headers,
    body: bodyText,
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
