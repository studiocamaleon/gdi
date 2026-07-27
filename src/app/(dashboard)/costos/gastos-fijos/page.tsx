import { redirect } from "next/navigation";

/**
 * Los gastos fijos se mudaron a Administración.
 *
 * La redirección queda porque la ruta vieja está en marcadores y en links
 * pegados por ahí: mudar un módulo no tiene por qué romperlos. Se puede
 * borrar cuando ya no le sirva a nadie.
 *
 * El porqué de la mudanza está en el controller del API: es información
 * administrativa —nómina, alquiler, contador— y ningún precio la usa.
 */
export default function GastosFijosMudado() {
  redirect("/administracion/gastos-fijos");
}
