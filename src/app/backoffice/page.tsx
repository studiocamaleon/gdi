import { BackofficeLogin } from "@/components/plataforma/backoffice-login";

export const dynamic = "force-dynamic";

/**
 * El login del equipo de Grafo (control plane). Superficie aparte del login de
 * tenant: entra el staff sin necesitar una empresa. No rebota al que ya tiene
 * cookie — su propia lógica lleva a /plataforma. Ver docs/control-plane-diseno.md
 */
export default function BackofficePage() {
  return <BackofficeLogin />;
}
