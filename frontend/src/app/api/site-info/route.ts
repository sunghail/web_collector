import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { normalizeShareUrl } from '@/lib/chat';
import { getSiteInfo } from '@/lib/siteInfo';

// GET /api/site-info?url=https://… -> { title, siteName } of a public web page (signed-in people only).
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = normalizeShareUrl(request.nextUrl.searchParams.get('url'));
  if (!url) return NextResponse.json({ error: 'Only http and https addresses' }, { status: 400 });

  const info = await getSiteInfo(url);
  return NextResponse.json(info, { headers: { 'Cache-Control': 'private, max-age=3600' } });
}
