import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolvePostExcerpt } from "@/lib/excerpt";

export const dynamic = "force-dynamic";

const MAX_TITLE_LENGTH = 256;
const MAX_CONTENT_LENGTH = 50000;

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Invalid content type" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title =
    typeof payload === "object" &&
    payload !== null &&
    "title" in payload &&
    typeof payload.title === "string"
      ? payload.title.trim().slice(0, MAX_TITLE_LENGTH)
      : "";
  const content =
    typeof payload === "object" &&
    payload !== null &&
    "content" in payload &&
    typeof payload.content === "string"
      ? payload.content.trim().slice(0, MAX_CONTENT_LENGTH)
      : "";

  if (!title && !content) {
    return NextResponse.json(
      { error: "Title or content is required." },
      { status: 400 }
    );
  }

  try {
    const excerpt = await resolvePostExcerpt({
      title: title || "Untitled",
      content: content || null,
      excerpt: null,
    });
    return NextResponse.json({ excerpt: excerpt ?? null });
  } catch (error) {
    console.warn("excerpt suggestion failed", error);
    return NextResponse.json({ error: "Failed to generate excerpt" }, { status: 500 });
  }
}
