function absoluteUrl(value: string | undefined, fallback: string) {
  try {
    return new URL(value?.trim() || fallback).toString();
  } catch {
    return fallback;
  }
}

export function isMarketingLive() {
  // Sólo una activación explícita habilita el acceso y las consultas al SaaS.
  return process.env.MARKETING_LAUNCH_MODE?.trim() === "live";
}

export function getSiteConfig() {
  const isLive = isMarketingLive();
  const site = absoluteUrl(
    process.env.MARKETING_SITE_URL,
    "http://localhost:3002",
  ).replace(/\/$/, "");
  const app = absoluteUrl(
    process.env.MARKETING_APP_URL,
    "http://localhost:3000",
  ).replace(/\/$/, "");
  const launch = `${site}/proximamente`;
  const contact = absoluteUrl(
    process.env.MARKETING_CONTACT_URL,
    "mailto:soporte@grafoprint.com.ar?subject=Consulta%20sobre%20Grafoprint",
  );
  return {
    site,
    isLive,
    launch,
    contact,
    login: isLive
      ? absoluteUrl(process.env.MARKETING_LOGIN_URL, `${app}/login`)
      : launch,
    signup: isLive
      ? absoluteUrl(process.env.MARKETING_SIGNUP_URL, `${app}/registro`)
      : launch,
    demo: isLive
      ? absoluteUrl(
          process.env.MARKETING_DEMO_URL,
          "mailto:soporte@grafoprint.com.ar?subject=Demo%20de%20Grafoprint",
        )
      : contact,
    terms: `${site}/terminos`,
    privacy: `${site}/privacidad`,
    dataDeletion: `${site}/eliminacion-de-datos`,
  };
}

export function planInquiry(demo: string, plan: string) {
  const url = new URL(demo);
  if (url.protocol === "mailto:")
    url.searchParams.set("subject", `Plan ${plan} · Grafoprint`);
  return url.toString();
}
