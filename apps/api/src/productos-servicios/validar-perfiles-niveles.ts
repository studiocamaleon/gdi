import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { MAQUINA_DISPONIBLE_WHERE } from '../maquinaria/maquinaria-disponibilidad';
import { leerNivelesPaso } from '../motor-universal/niveles-paso';
import { perfilCompatibleConFamilia } from './pasos/familias';

/** Se aplica igual a nodos reutilizables, pasos de ruta y extras. Las claves
 * de máquinas antiguas quedan inertes; al volver a elegirlas se validan. */
export async function validarPerfilesNiveles(
  prisma: PrismaService,
  tenantId: string,
  familiaCodigo: string,
  config: {
    paramsPasoJson?: unknown;
    maquinaM1Id?: string | null;
    maquinasCandidatas?: unknown;
  },
) {
  const niveles = leerNivelesPaso(config.paramsPasoJson);
  const maquinas = new Set<string>();
  if (config.maquinaM1Id) maquinas.add(config.maquinaM1Id);
  if (Array.isArray(config.maquinasCandidatas))
    for (const c of config.maquinasCandidatas) {
      if (c && typeof c.maquinaId === 'string') maquinas.add(c.maquinaId);
    }
  const elecciones =
    niveles?.opciones.flatMap((n) =>
      Object.entries(n.overrides.perfilesPorMaquina ?? {})
        .filter(([id]) => maquinas.has(id))
        .map(([maquinaId, perfilId]) => ({
          maquinaId,
          perfilId,
          nombre: n.nombre,
        })),
    ) ?? [];
  if (!elecciones.length) return;
  if (
    (config.paramsPasoJson as Record<string, unknown>)
      ?.cotizarOperacionesVectoriales === true
  )
    throw new BadRequestException(
      'Los perfiles de este paso se eligen por operación vectorial. Quitá los perfiles de Niveles.',
    );
  const disponibles = await prisma.maquina.findMany({
    where: {
      tenantId,
      ...MAQUINA_DISPONIBLE_WHERE,
      id: { in: [...new Set(elecciones.map((e) => e.maquinaId))] },
    },
    select: {
      id: true,
      perfilesOperativos: {
        where: { activo: true },
        select: { id: true, tipoPerfil: true, detalleJson: true },
      },
    },
  });
  for (const e of elecciones) {
    const perfil = disponibles
      .find((m) => m.id === e.maquinaId)
      ?.perfilesOperativos.find((p) => p.id === e.perfilId);
    if (
      !perfil ||
      !perfilCompatibleConFamilia(familiaCodigo, perfil.tipoPerfil) ||
      (perfil.detalleJson &&
        typeof perfil.detalleJson === 'object' &&
        'procesamientoCorteVersion' in perfil.detalleJson)
    )
      throw new BadRequestException(
        `El perfil del nivel «${e.nombre}» no está activo o no es compatible con la máquina elegida.`,
      );
  }
}
