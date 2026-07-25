import { redirect } from "next/navigation";

/**
 * Los datos fiscales se mudaron a Configuración: son la puesta a punto del
 * emisor, no una operación de Administración. Esta ruta queda porque el link
 * vivió meses en favoritos y en los avisos de "falta configurar la
 * facturación"; un 404 ahí se lee como que la pantalla desapareció.
 */
export default function DatosFiscalesMudados() {
  redirect("/configuracion/datos-fiscales");
}
