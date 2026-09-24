export function getMarketingSiteUrl() {
  return (
    process.env.MARKETING_SITE_URL?.trim() ||
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3002"
      : "https://grafoprint.com.ar")
  ).replace(/\/$/, "");
}
