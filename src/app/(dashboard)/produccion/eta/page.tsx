import { redirect } from "next/navigation";

/**
 * "Salud del ETA" se movió a Reportes (/reportes/salud-eta). Se mantiene esta
 * ruta como redirect para no romper links guardados.
 */
export default function SaludEtaLegacyRedirect() {
  redirect("/reportes/salud-eta");
}
