import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/user-profile";
import { db } from "@/db";
import { algoliaEnabled, reindexAlgoliaPosts } from "@/lib/algolia";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await ensureUserProfile({
      id: session.user.id,
      email: session.user.email,
    });
    if (profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!algoliaEnabled) {
      return NextResponse.json(
        { error: "Algolia not configured" },
        { status: 400 }
      );
    }

    const result = await reindexAlgoliaPosts(db);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reindex failed";
    console.error("Algolia reindex failed:", error);
    return NextResponse.json(
      {
        error: message,
        hint:
          process.env.NODE_ENV === "development"
            ? "Check ALGOLIA_APP_ID / ALGOLIA_ADMIN_KEY / ALGOLIA_INDEX"
            : undefined,
        env:
          process.env.NODE_ENV === "development"
            ? {
                ALGOLIA_APP_ID: Boolean(process.env.ALGOLIA_APP_ID),
                ALGOLIA_ADMIN_KEY: Boolean(process.env.ALGOLIA_ADMIN_KEY),
                ALGOLIA_INDEX: process.env.ALGOLIA_INDEX ?? null,
              }
            : undefined,
      },
      { status: 500 }
    );
  }
}
