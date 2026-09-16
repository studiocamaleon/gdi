function absoluteUrl(value: string | undefined, fallback: string) {
  try {
    return new URL(value?.trim() || fallback).toString();
  } catch {
    return fallback;
  }
}

export function getSiteConfig() {
  const site = absoluteUrl(
    process.env.MARKETING_SITE_URL,
    "http://localhost:3002",
  ).replace(/\/$/, "");
  const app = absoluteUrl(
    process.env.MARKETING_APP_URL,
    "http://localhost:3000",
  ).replace(/\/$/, "");
  return {
    site,
    login: absoluteUrl(process.env.MARKETING_LOGIN_URL, `${app}/login`),
    signup: absoluteUrl(process.env.MARKETING_SIGNUP_URL, `${app}/registro`),
    demo: absoluteUrl(
      process.env.MARKETING_DEMO_URL,
      "mailto:soporte@grafoprint.com.ar?subject=Demo%20de%20Grafoprint",
    ),
    terms: `${app}/terminos`,
    privacy: `${app}/privacidad`,
  };
}

export function planInquiry(demo: string, plan: string) {
  const url = new URL(demo);
  if (url.protocol === "mailto:")
    url.searchParams.set("subject", `Plan ${plan} · Grafoprint`);
  return url.toString();
}
