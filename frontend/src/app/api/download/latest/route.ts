import { NextResponse } from 'next/server';
import { RELEASES_PAGE, getLatestRelease } from '@/lib/release';

// GET /api/download/latest -> version, date and installer sizes for the download buttons
export async function GET() {
  try {
    const release = await getLatestRelease();
    return NextResponse.json(
      { release, releasesPage: RELEASES_PAGE },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } }
    );
  } catch (error) {
    console.error('Latest release error:', error);
    return NextResponse.json({ release: null, releasesPage: RELEASES_PAGE, error: 'Could not reach GitHub' }, { status: 502 });
  }
}
