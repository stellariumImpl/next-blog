import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";

export const dynamic = "force-dynamic";

const MAX_SIZE_MB = 8;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUserProfile({ id: session.user.id, email: session.user.email });

  const owner = process.env.GITHUB_ASSETS_OWNER;
  const repo = process.env.GITHUB_ASSETS_REPO;
  const token = process.env.GITHUB_ASSETS_TOKEN;
  const branch = process.env.GITHUB_ASSETS_BRANCH || "main";

  if (!owner || !repo || !token) {
    return NextResponse.json(
      { error: "GitHub assets not configured" },
      { status: 500 }
    );
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File missing" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SIZE_MB}MB)` },
      { status: 400 }
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPG, or WEBP images are allowed." },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const filename = sanitizeFilename(file.name || `upload.${ext}`);
  const folder = `uploads/${new Date().toISOString().slice(0, 10)}`;
  const path = `${folder}/${Date.now()}-${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "blog-uploader",
      Accept: "application/vnd.github+json",
    },
    body: JSON.stringify({
      message: `Upload ${filename}`,
      content: base64,
      branch,
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: error?.message || "GitHub upload failed" },
      { status: 500 }
    );
  }

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  return NextResponse.json({ url: rawUrl });
}
