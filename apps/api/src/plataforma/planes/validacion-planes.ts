import { CATALOGO_PLANES, type ContenidoPlan } from './catalogo-planes';

/** Compartida con el editor. El servidor siempre repite esta validación. */
export function problemasPlan(plan: ContenidoPlan): string[] {
  const errores: string[] = [];
  if (
    typeof plan.nombre !== 'string' ||
    plan.nombre.trim().length < 3 ||
    plan.nombre.trim().length > 60
  )
    errores.push('El nombre debe tener entre 3 y 60 caracteres.');
  if (
    typeof plan.descripcion !== 'string' ||
    plan.descripcion.trim().length < 5 ||
    plan.descripcion.trim().length > 200
  )
    errores.push('La descripción debe tener entre 5 y 200 caracteres.');
  if (
    !Number.isInteger(plan.usuariosIncluidos) ||
    plan.usuariosIncluidos < 1 ||
    plan.usuariosIncluidos > 10000
  )
    errores.push('Indicá entre 1 y 10.000 usuarios incluidos.');
  if (typeof plan.adicionalesPermitidos !== 'boolean')
    errores.push('Definí si admite usuarios adicionales.');
  if (!['pendiente', 'limitado', 'ilimitado'].includes(plan.almacenamientoModo))
    errores.push('Seleccioná una modalidad de almacenamiento.');
  if (plan.almacenamientoModo === 'limitado') {
    if (
      !Number.isInteger(plan.almacenamientoGb) ||
      plan.almacenamientoGb! < 1 ||
      plan.almacenamientoGb! > 100000
    )
      errores.push(
        'El almacenamiento debe ser un entero entre 1 y 100.000 GB.',
      );
  } else if (plan.almacenamientoGb !== null)
    errores.push('El cupo de almacenamiento sólo aplica al modo limitado.');
  const funciones = plan.funciones;
  if (!funciones || typeof funciones !== 'object' || Array.isArray(funciones))
    return [...errores, 'La selección de funciones no es válida.'];
  const claves = new Set(CATALOGO_PLANES.map((c) => c.clave));
  if (Object.keys(funciones).some((c) => !claves.has(c)))
    errores.push('Hay funciones que no pertenecen al catálogo vigente.');
  for (const c of CATALOGO_PLANES) {
    if (typeof funciones[c.clave] !== 'boolean') {
      errores.push(`Definí la inclusión de ${c.nombre}.`);
      continue;
    }
    if (c.base && !funciones[c.clave])
      errores.push(`${c.nombre} forma parte de la base de todas las cuentas.`);
    if (c.destino !== 'plan' && funciones[c.clave])
      errores.push(
        `${c.nombre} se gestiona fuera de los planes comerciales (${c.destino === 'piloto' ? 'piloto privado' : 'adicional pendiente'}).`,
      );
    if (funciones[c.clave])
      for (const clave of c.requiere)
        if (!funciones[clave])
          errores.push(
            `${c.nombre} requiere ${CATALOGO_PLANES.find((d) => d.clave === clave)!.nombre}.`,
          );
  }
  return errores;
}

export function revisionComercial(plan: ContenidoPlan) {
  const incluidas = CATALOGO_PLANES.filter((c) => plan.funciones[c.clave]);
  return {
    errores: problemasPlan(plan),
    incluidas: incluidas.length,
    revisionOperativa: incluidas
      .filter((c) => c.revisionOperativa)
      .map((c) => c.nombre),
    controlesPendientes: CATALOGO_PLANES.filter(
      (c) => c.destino === 'plan' && c.cobertura !== 'base',
    ).length,
    pendientes: [
      'Vincular precios y condiciones comerciales.',
      ...(plan.adicionalesPermitidos
        ? ['Definir el precio y cobro de usuarios adicionales.']
        : []),
      ...(plan.almacenamientoModo === 'pendiente'
        ? ['Definir almacenamiento incluido.']
        : []),
      'Completar restricciones por función y publicación con versiones.',
    ],
  };
}
