import { connection } from "next/server";
import { getPublicPlans } from "../lib/public-plans";
import { NestingShowcase } from "./nesting-showcase";
import { isMarketingLive } from "../lib/site-config";

export async function NestingSection() {
  const isLive = isMarketingLive();
  if (isLive) await connection();
  const plans = (await getPublicPlans()) ?? [];
  const includedIn = (key: string) =>
    plans
      .filter((p) => p.prestaciones?.some((c) => c.clave === key))
      .map((p) => p.nombre);
  return (
    <NestingShowcase
      isLive={isLive}
      rectangularPlans={includedIn("aprovechamiento_cotizacion")}
      irregularPlans={includedIn("nesting_irregular")}
    />
  );
}
