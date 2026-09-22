import { connection } from "next/server";
import { getPublicPlans } from "../lib/public-plans";
import { NestingShowcase } from "./nesting-showcase";

export async function NestingSection() {
  await connection();
  const plans = (await getPublicPlans()) ?? [];
  const includedIn = (key: string) =>
    plans
      .filter((p) => p.prestaciones?.some((c) => c.clave === key))
      .map((p) => p.nombre);
  return (
    <NestingShowcase
      rectangularPlans={includedIn("aprovechamiento_cotizacion")}
      irregularPlans={includedIn("nesting_irregular")}
    />
  );
}
