// Finds the newest desktop installers in the GitHub repository's Releases.
// The release workflow (.github/workflows/release.yml) uploads them there.

export const RELEASE_REPO = process.env.GITHUB_RELEASE_REPO || 'sunghail/web_collector';
export const RELEASES_PAGE = `https://github.com/${RELEASE_REPO}/releases`;

export interface InstallerInfo {
  name: string;
  size: number;
  url: string;
}

export interface LatestRelease {
  version: string;
  publishedAt: string;
  releaseUrl: string;
  windows: InstallerInfo | null;
  mac: InstallerInfo | null;
}

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

function pickAsset(assets: GitHubAsset[], extension: string): InstallerInfo | null {
  const asset = assets.find((a) => a.name.toLowerCase().endsWith(extension));
  return asset ? { name: asset.name, size: asset.size, url: asset.browser_download_url } : null;
}

/** The latest published release, or null when there is none yet. Cached for 10 minutes. */
export async function getLatestRelease(): Promise<LatestRelease | null> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'web-collector',
  };
  // Optional: raises GitHub's rate limit. Any read-only token works.
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const response = await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases/latest`, {
    headers,
    next: { revalidate: 600 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub responded ${response.status}`);

  const release = (await response.json()) as {
    tag_name: string;
    published_at: string;
    html_url: string;
    assets: GitHubAsset[];
  };

  return {
    version: release.tag_name.replace(/^v/, ''),
    publishedAt: release.published_at,
    releaseUrl: release.html_url,
    windows: pickAsset(release.assets, '.exe'),
    mac: pickAsset(release.assets, '.dmg'),
  };
}
