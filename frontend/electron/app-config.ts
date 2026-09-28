import { app } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * The web address the desktop app shows. Installed builds read it from app-config.json, written at
 * build time by scripts/write-app-config.js; development uses the local Next.js dev server.
 */
export function getAppUrl(): string {
  if (!app.isPackaged) {
    return process.env.ELECTRON_DEV_URL || 'http://localhost:30101';
  }

  const configPath = path.join(__dirname, 'app-config.json');
  const { appUrl } = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { appUrl?: string };
  if (!appUrl) {
    throw new Error(`appUrl is missing in ${configPath}`);
  }
  return appUrl;
}

/**
 * Pages the app window may show besides our own site: the Supabase and Google pages that the
 * "Continue with Google" sign-in passes through. Everything else opens in the default browser.
 */
export function isSignInPage(url: URL) {
  return (
    url.protocol === 'https:' &&
    (url.hostname.endsWith('.supabase.co') || url.hostname === 'accounts.google.com' || url.hostname.endsWith('.accounts.google.com'))
  );
}
