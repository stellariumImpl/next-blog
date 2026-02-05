import { headers } from "next/headers";

export const dynamic = "force-dynamic";

const pickIP = (header: string | null) => {
  if (!header) return null;
  return header.split(",")[0]?.trim() ?? null;
};

export async function GET() {
  const hdrs = headers();
  const host = hdrs.get("host") ?? "";
  const ip =
    pickIP(hdrs.get("x-forwarded-for")) ||
    hdrs.get("x-real-ip") ||
    hdrs.get("cf-connecting-ip") ||
    hdrs.get("fastly-client-ip") ||
    (host.includes("localhost") ? "127.0.0.1" : "0.0.0.0");
  return Response.json({ ip });
}
