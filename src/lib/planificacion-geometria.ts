/** Recorta al calendario sin alargar tareas para hacer espacio al texto. */
export function geometriaBarraPlan(inicio: number, fin: number, lienzo: number) {
  const x = Math.max(0, Math.min(lienzo, inicio));
  const finTemporal = Math.max(x, Math.min(lienzo, fin));
  const ancho = finTemporal - x;
  return { x, finTemporal, ancho, corta: ancho < 130 };
}

/** Fin del predecesor → inicio del sucesor. El codo nunca sobrepasa el
 * destino cuando el espacio es pequeño: eso invertía la punta de la flecha. */
export function recorridoDependenciaPlan(origen: { fin: number; y: number }, destino: { x: number; y: number }) {
  if (destino.x >= origen.fin) {
    if (origen.y === destino.y) return `M${origen.fin},${origen.y} H${destino.x}`;
    const mitad = (origen.fin + destino.x) / 2;
    return `M${origen.fin},${origen.y} H${mitad} V${destino.y} H${destino.x}`;
  }
  // Una proyección recortada puede invertir las coordenadas visibles.
  // Entrar siempre desde la izquierda, sin dibujar una dependencia inversa.
  const mitadY = origen.y === destino.y ? origen.y - 24 : (origen.y + destino.y) / 2;
  return `M${origen.fin},${origen.y} H${origen.fin + 8} V${mitadY} H${destino.x - 8} V${destino.y} H${destino.x}`;
}

/** Cada porción usa el mismo eje temporal de la tarea. Los huecos siguen
 * visibles: esperar al operario o al próximo turno nunca se dibuja como RUN. */
export function segmentosOperacionPlan(
  tramos: import('./capacidad-humana').TramoOperacion[],
  aX: (fecha: Date) => number,
  barra: { x: number; ancho: number },
) {
  if (barra.ancho <= 0) return [];
  return tramos.flatMap(t => {
    const inicio = Math.max(barra.x, aX(new Date(t.inicio)));
    const fin = Math.min(barra.x + barra.ancho, aX(new Date(t.fin)));
    return fin > inicio ? [{ tipo: t.tipo, inicio: (inicio - barra.x) / barra.ancho * 100,
      ancho: (fin - inicio) / barra.ancho * 100 }] : [];
  });
}

export function resumenOperacionPlan(tramos: import('./capacidad-humana').TramoOperacion[] = []) {
  return tramos.reduce((r, t) => {
    const min = (t.fin - t.inicio) / 60000;
    r[t.tipo] += min;
    r.personaMin += min * t.personas;
    return r;
  }, { operario: 0, maquina: 0, maquina_atendida: 0, sin_verificar: 0, personaMin: 0 });
}
