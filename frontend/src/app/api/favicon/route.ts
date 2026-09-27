import { NextRequest, NextResponse } from 'next/server';

// Google's favicon service answers unknown sites with a generic globe image and HTTP 404.
// Browsers still render that image, so we proxy it and pass the 404 through as a real
// error, letting cards fall back to their category's default icon.
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain');
  const size = request.nextUrl.searchParams.get('sz') || '128';

  if (!domain || !/^[a-z0-9.-]+(:\d+)?$/i.test(domain)) {
    return new NextResponse(null, { status: 400 });
  }

  try {
    const upstream = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${encodeURIComponent(size)}`,
      { next: { revalidate: 60 * 60 * 24 } }
    );

    if (!upstream.ok) {
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=86400' },
      });
    }

    return new NextResponse(await upstream.arrayBuffer(), {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=604800',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
