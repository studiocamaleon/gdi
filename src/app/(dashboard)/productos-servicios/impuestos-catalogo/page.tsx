import { redirect } from "next/navigation";

// El catálogo de impuestos se mudó a Configuración. Se deja este redirect para
// bookmarks y enlaces viejos. Ver docs/impuestos-modelo-latam-diseno.md.
export default function ImpuestosCatalogoRedirect() {
  redirect("/configuracion/impuestos");
}
