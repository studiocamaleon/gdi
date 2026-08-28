import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

const templatePath = join(process.cwd(), "src", "landing.html");

function absoluteUrl(value: string | undefined, fallback: string) {
  const candidate = value?.trim() || fallback;
  try {
    return new URL(candidate).toString();
  } catch {
    return fallback;
  }
}

function conPlan(signupUrl: string, plan: string) {
  const url = new URL(signupUrl);
  url.searchParams.set("plan", plan);
  return url.toString();
}

export async function GET() {
  const siteUrl = absoluteUrl(
    process.env.MARKETING_SITE_URL,
    "http://localhost:3002",
  ).replace(/\/$/, "");
  const appUrl = absoluteUrl(
    process.env.MARKETING_APP_URL,
    "http://localhost:3000",
  ).replace(/\/$/, "");
  const loginUrl = absoluteUrl(
    process.env.MARKETING_LOGIN_URL,
    `${appUrl}/login`,
  );
  const signupUrl = absoluteUrl(
    process.env.MARKETING_SIGNUP_URL,
    `${appUrl}/registro`,
  );
  const demoUrl = absoluteUrl(
    process.env.MARKETING_DEMO_URL,
    "mailto:soporte@grafoprint.com.ar?subject=Plan%20Enterprise",
  );

  const template = await readFile(templatePath, "utf8");
  const html = template
    .replaceAll("__SITE_URL__", siteUrl)
    .replaceAll("__LOGIN_URL__", loginUrl)
    .replaceAll("__SIGNUP_URL__", signupUrl)
    .replaceAll("__SIGNUP_TALLER_URL__", conPlan(signupUrl, "taller"))
    .replaceAll(
      "__SIGNUP_PRODUCCION_URL__",
      conPlan(signupUrl, "estudio"),
    )
    .replaceAll("__TERMS_URL__", `${appUrl}/terminos`)
    .replaceAll("__PRIVACY_URL__", `${appUrl}/privacidad`)
    .replaceAll("__DEMO_URL__", demoUrl);

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
