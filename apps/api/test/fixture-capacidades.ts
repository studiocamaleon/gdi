import { CapacidadesEmpresaService } from '../src/suscripciones/capacidades-empresa.service';
import {
  contratoCompatible,
  type ClaveCapacidad,
} from '../src/suscripciones/evaluador-capacidades';
import { resolverAccesoEmpresa } from '../src/suscripciones/acceso-empresa';

/** Contrato explícito para pruebas unitarias con Prisma parcial.
 * Conserva la evaluación real; sólo reemplaza la lectura de la suscripción. */
export function capacidadesDePrueba(excluidas: ClaveCapacidad[] = []) {
  const servicio = new CapacidadesEmpresaService({} as never);
  const contrato = contratoCompatible(null);
  for (const clave of excluidas) contrato.funciones[clave] = false;
  jest.spyOn(servicio, 'actual').mockImplementation((tenantId) =>
    Promise.resolve({
      empresa: { id: tenantId, nombre: 'Empresa de prueba' },
      contrato,
      acceso: resolverAccesoEmpresa(true, null),
      almacenamientoAjustadoBytes: null,
    }),
  );
  return servicio;
}
