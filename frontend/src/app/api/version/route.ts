import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/version -> which build the server is running now.
// Open pages compare it with the build they were loaded from and offer to refresh when it changed.
export function GET() {
  return NextResponse.json(
    { buildId: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
