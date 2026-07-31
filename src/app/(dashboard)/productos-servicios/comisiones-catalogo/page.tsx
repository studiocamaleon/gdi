import { redirect } from "next/navigation";

// El catálogo de comisiones se mudó a Configuración. Se deja este redirect para
// bookmarks y enlaces viejos. Ver docs/impuestos-modelo-latam-diseno.md.
export default function ComisionesCatalogoRedirect() {
  redirect("/configuracion/comisiones");
}
