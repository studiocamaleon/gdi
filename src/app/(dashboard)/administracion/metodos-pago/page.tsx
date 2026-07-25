import { redirect } from "next/navigation";

/**
 * Los métodos de pago se mudaron a Configuración: son un catálogo que se define
 * una vez —qué medios acepta la imprenta y con qué comisión—, no una operación
 * de Administración. Cobrar los usa; configurarlos es otra cosa.
 *
 * La ruta vieja queda redirigiendo porque vivió en el sidebar y puede estar en
 * favoritos. El endpoint del API sigue siendo `/administracion/metodos-pago`:
 * eso es backend y no se mueve por un cambio de menú.
 */
export default function MetodosPagoMudados() {
  redirect("/configuracion/metodos-pago");
}
