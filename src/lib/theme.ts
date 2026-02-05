import { cookies } from "next/headers";

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  return cookies().get("theme")?.value === "light" ? "light" : "dark";
}
