import Link from "next/link";

/**
 * Lo que ve alguien que entra por URL a un módulo que su rol no incluye.
 *
 * Existe porque el sidebar esconde lo que no corresponde, pero una URL pegada
 * en un chat o un favorito viejo no pasa por el sidebar: sin esto, la pantalla
 * cargaba vacía con errores de red y parecía que el sistema estaba roto.
 *
 * No dice QUÉ permiso falta ni qué hay del otro lado. Enumerar lo que no podés
 * ver es información que no hace falta dar, y al que le falta acceso no le
 * sirve el nombre técnico del permiso: le sirve saber a quién pedírselo.
 */
export function SinPermiso({
  modulo,
}: {
  /** El nombre humano del módulo, para que sepa qué pidió. */
  modulo?: string;
}) {
  return (
    <div className="sp-caja">
      <div className="sp-icono" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="4" y="10" width="16" height="11" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h1>No tenés acceso a {modulo ?? "esta sección"}</h1>
      <p>
        Tu rol no incluye este módulo. Si lo necesitás para trabajar, pedile a
        quien administra el sistema en tu empresa que te lo habilite.
      </p>
      <Link href="/" className="btn ghost">
        Volver al inicio
      </Link>
    </div>
  );
}
