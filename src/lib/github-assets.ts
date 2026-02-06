const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

export const DEFAULT_ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export const FAVICON_ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export class UploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const sanitizeFilename = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

export async function uploadGithubAsset({
  file,
  folder,
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  maxBytes = DEFAULT_MAX_BYTES,
  filenamePrefix,
}: {
  file: File;
  folder: string;
  allowedTypes?: Set<string>;
  maxBytes?: number;
  filenamePrefix?: string;
}) {
  if (file.size > maxBytes) {
    throw new UploadError(
      `File too large (max ${Math.floor(maxBytes / (1024 * 1024))}MB)`,
      400
    );
  }
  if (!allowedTypes.has(file.type)) {
    throw new UploadError('Unsupported file type.', 400);
  }

  const owner = process.env.GITHUB_ASSETS_OWNER;
  const repo = process.env.GITHUB_ASSETS_REPO;
  const token = process.env.GITHUB_ASSETS_TOKEN;
  const branch = process.env.GITHUB_ASSETS_BRANCH || 'main';

  if (!owner || !repo || !token) {
    throw new UploadError('GitHub assets not configured', 500);
  }

  const ext = file.name.split('.').pop() ?? 'bin';
  const baseName = file.name || `upload.${ext}`;
  const safeName = sanitizeFilename(baseName);
  const prefix = filenamePrefix ? `${filenamePrefix}-` : '';
  const path = `${folder}/${Date.now()}-${prefix}${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'blog-uploader',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({
      message: `Upload ${safeName}`,
      content: base64,
      branch,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new UploadError(error?.message || 'GitHub upload failed', 502);
  }

  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  return { url, path };
}
