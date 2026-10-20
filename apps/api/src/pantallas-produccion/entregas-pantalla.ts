import {
  clasificarEntregasProduccion,
  type OrdenEntregas,
} from '../common/entregas-produccion';
export { seleccionEntregasProduccion as seleccionOrdenPantalla } from '../common/entregas-produccion';
export { claveFechaEnZona as diaEnZona } from '../common/zona';

export function entregasParaPantalla(ordenes: OrdenEntregas[], hoy: string) {
  const filas = clasificarEntregasProduccion(ordenes, hoy)
    .filter((e) => e.riesgo === 'atrasada' || e.riesgo === 'hoy')
    .map((e) => ({
      id: e.id,
      orden: e.orden,
      cliente: e.cliente,
      producto: e.producto,
      cantidad: e.cantidad,
      unidad: e.unidad,
      fecha: e.fecha!,
      atrasada: e.riesgo === 'atrasada',
      estado: e.estado,
      etapa: e.etapa,
      pasosHechos: e.progreso.operacionesCompletadas,
      pasosTotal: e.progreso.operacionesTotal,
      progresoPct: e.progreso.porcentaje,
      progresoExplicacion: e.progreso.explicacion,
    }));
  return {
    filas,
    resumen: {
      atrasadas: filas.filter((f) => f.atrasada).length,
      hoy: filas.filter((f) => !f.atrasada).length,
    },
  };
}
