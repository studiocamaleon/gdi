import {
  CATALOGO_PLANES,
  VERSION_CATALOGO_PLANES,
  type ContenidoPlan,
} from './catalogo-planes';

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
  if (plan.precios !== undefined) {
    const precios = plan.precios;
    if (!precios || typeof precios !== 'object' || Array.isArray(precios))
      errores.push('La configuración de precios no es válida.');
    else {
      if (precios.moneda !== 'USD')
        errores.push('La moneda comercial debe ser USD.');
      const campos = [
        'mensual',
        'anual',
        'usuarioMensual',
        'usuarioAnual',
      ] as const;
      if (
        Object.keys(precios).some(
          (k) => k !== 'moneda' && !(campos as readonly string[]).includes(k),
        )
      )
        errores.push(
          'La configuración de precios contiene campos desconocidos.',
        );
      for (const campo of campos) {
        const valor = precios[campo];
        if (
          valor !== null &&
          (typeof valor !== 'number' ||
            !Number.isFinite(valor) ||
            valor <= 0 ||
            valor > 1000000 ||
            Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001)
        )
          errores.push(
            `El precio ${campo} debe ser positivo, con hasta dos decimales, o quedar pendiente.`,
          );
      }
    }
  }
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
  if (plan.comercial !== undefined) {
    const c = plan.comercial;
    if (
      !c ||
      !['publico', 'invitacion'].includes(c.acceso) ||
      !Number.isInteger(c.trialDias) ||
      c.trialDias < 1 ||
      c.trialDias > 90 ||
      typeof c.implementacion !== 'number' ||
      !Number.isFinite(c.implementacion) ||
      c.implementacion < 0 ||
      c.implementacion > 1000000 ||
      Math.abs(c.implementacion * 100 - Math.round(c.implementacion * 100)) >
        0.000001
    )
      errores.push(
        'Revisá el acceso, los días de prueba y el cargo de implementación.',
      );
  }
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

export function problemasPublicacionPlan(
  plan: ContenidoPlan,
  catalogoVersion = VERSION_CATALOGO_PLANES,
): string[] {
  // Las ofertas v1 ya publicadas conservan el alcance de aprovechamiento.
  // La normalización es de lectura; no altera el snapshot almacenado.
  const validable =
    catalogoVersion === 1 &&
    !Object.hasOwn(plan.funciones ?? {}, 'nesting_irregular')
      ? {
          ...plan,
          funciones: {
            ...plan.funciones,
            nesting_irregular:
              plan.funciones?.aprovechamiento_cotizacion === true,
          },
        }
      : plan;
  return [
    ...problemasPlan(validable),
    ...(plan.almacenamientoModo === 'pendiente'
      ? ['Definí el almacenamiento incluido antes de publicar la versión.']
      : []),
  ];
}

export function revisionComercial(plan: ContenidoPlan) {
  const incluidas = CATALOGO_PLANES.filter((c) => plan.funciones[c.clave]);
  const controlesPendientes = incluidas.filter(
    (c) => c.cobertura === 'parcial' || c.cobertura === 'pendiente',
  ).length;
  return {
    errores: problemasPlan(plan),
    incluidas: incluidas.length,
    revisionOperativa: incluidas
      .filter((c) => c.revisionOperativa)
      .map((c) => c.nombre),
    controlesPendientes,
    pendientes: [
      ...(!plan.precios?.mensual ? ['Definir el precio mensual.'] : []),
      ...(!plan.precios?.anual
        ? ['Definir el precio anual si se ofrecerá esa modalidad.']
        : []),
      'Revisar en Versiones y contratación la oferta y los precios vinculados a Paddle. El borrador no modifica una oferta vigente.',
      ...(plan.adicionalesPermitidos &&
      ((plan.precios?.mensual && !plan.precios?.usuarioMensual) ||
        (plan.precios?.anual && !plan.precios?.usuarioAnual))
        ? [
            'Definir el precio de usuarios adicionales para las modalidades ofrecidas.',
          ]
        : []),
      ...(plan.almacenamientoModo === 'pendiente'
        ? ['Definir almacenamiento incluido.']
        : []),
      ...(controlesPendientes
        ? [
            `Completar el control por plan de ${controlesPendientes} funciones incluidas.`,
          ]
        : []),
    ],
  };
}
