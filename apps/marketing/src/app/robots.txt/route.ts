export const dynamic = "force-static";

export function GET() {
  const siteUrl = (process.env.MARKETING_SITE_URL ?? "http://localhost:3002").replace(
    /\/$/,
    "",
  );
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
