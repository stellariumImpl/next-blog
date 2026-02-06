import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";
import {
  DEFAULT_ALLOWED_TYPES,
  UploadError,
  uploadGithubAsset,
} from "@/lib/github-assets";

export const dynamic = "force-dynamic";

const MAX_SIZE_MB = 8;
const MAX_BYTES = MAX_SIZE_MB * 1024 * 1024;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureUserProfile({ id: session.user.id, email: session.user.email });

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Invalid content type" },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File missing" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_SIZE_MB}MB)` },
      { status: 400 },
    );
  }
  if (!DEFAULT_ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Only PNG, JPG, or WEBP images are allowed." },
      { status: 400 },
    );
  }

  try {
    const { url } = await uploadGithubAsset({
      file,
      folder: `uploads/${new Date().toISOString().slice(0, 10)}`,
      allowedTypes: DEFAULT_ALLOWED_TYPES,
      maxBytes: MAX_BYTES,
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "GitHub upload failed" }, { status: 500 });
  }
}
