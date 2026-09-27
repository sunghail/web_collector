import axios from 'axios';
import * as cheerio from 'cheerio';

interface FaviconResult {
  url: string | null;
  source: 'html' | 'root' | 'google' | null;
}

/**
 * 웹사이트에서 파비콘 URL을 추출합니다.
 * 우선순위: HTML 태그 > /favicon.ico > Google Favicon 서비스
 */
export async function extractFavicon(targetUrl: string): Promise<FaviconResult> {
  try {
    const urlObj = new URL(targetUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

    // 1. HTML에서 파비콘 태그 추출 시도
    const htmlFavicon = await extractFromHtml(targetUrl, baseUrl);
    if (htmlFavicon) {
      // 파비콘 URL이 유효한지 확인
      const isValid = await checkFaviconExists(htmlFavicon);
      if (isValid) {
        return { url: htmlFavicon, source: 'html' };
      }
    }

    // 2. 루트 favicon.ico 확인
    const rootFavicon = `${baseUrl}/favicon.ico`;
    const rootExists = await checkFaviconExists(rootFavicon);
    if (rootExists) {
      return { url: rootFavicon, source: 'root' };
    }

    // 3. Google Favicon 서비스 fallback
    const googleFavicon = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    return { url: googleFavicon, source: 'google' };

  } catch (error) {
    // 에러 시 Google Favicon으로 fallback
    try {
      const urlObj = new URL(targetUrl);
      return {
        url: `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`,
        source: 'google'
      };
    } catch {
      return { url: null, source: null };
    }
  }
}

/**
 * HTML 페이지에서 파비콘 링크 태그를 찾습니다.
 */
async function extractFromHtml(targetUrl: string, baseUrl: string): Promise<string | null> {
  try {
    const response = await axios.get(targetUrl, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 400,
    });

    const $ = cheerio.load(response.data);

    // 파비콘 선택자 우선순위
    const selectors = [
      'link[rel="icon"][type="image/svg+xml"]',
      'link[rel="icon"][sizes="32x32"]',
      'link[rel="icon"][sizes="64x64"]',
      'link[rel="icon"][sizes="128x128"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      const href = element.attr('href');

      if (href) {
        return resolveUrl(href, baseUrl);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 상대 URL을 절대 URL로 변환합니다.
 */
function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith('//')) {
    return `https:${href}`;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  if (href.startsWith('/')) {
    return `${baseUrl}${href}`;
  }
  return `${baseUrl}/${href}`;
}

/**
 * 파비콘 URL이 실제로 존재하는지 확인합니다.
 */
async function checkFaviconExists(faviconUrl: string): Promise<boolean> {
  try {
    const response = await axios.head(faviconUrl, {
      timeout: 3000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 400,
    });

    const contentType = response.headers['content-type'] || '';
    // 이미지 타입이거나 ico 파일인지 확인
    return contentType.includes('image') ||
           contentType.includes('icon') ||
           faviconUrl.endsWith('.ico');
  } catch {
    return false;
  }
}

/**
 * 간단한 Google Favicon URL 생성 (빠른 fallback용)
 */
export function getGoogleFaviconUrl(targetUrl: string): string | null {
  try {
    const urlObj = new URL(targetUrl);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
  } catch {
    return null;
  }
}
