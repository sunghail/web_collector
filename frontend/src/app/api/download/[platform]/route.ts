import { NextRequest, NextResponse } from 'next/server';
import { RELEASES_PAGE, getLatestRelease } from '@/lib/release';

// GET /api/download/windows | /api/download/mac -> the newest installer file.
// A fixed address for buttons and shared links that always points at the latest version.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  if (platform !== 'windows' && platform !== 'mac') {
    return NextResponse.json({ error: 'Use /api/download/windows or /api/download/mac' }, { status: 404 });
  }

  try {
    const release = await getLatestRelease();
    const installer = release?.[platform];
    // No release yet (or this platform is missing): send people to the releases page instead.
    return NextResponse.redirect(installer?.url ?? RELEASES_PAGE, 302);
  } catch (error) {
    console.error('Download redirect error:', error);
    return NextResponse.redirect(RELEASES_PAGE, 302);
  }
}
