import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Provisiona el producto plantilla "Impresión de documento" (SYS-IMPRESION-DOC)
 * del TPV Centro de copiado — Etapa A.
 * Diseño:  docs/tpv-centro-copiado-diseno.md
 * Plan:    docs/tpv-centro-copiado-plan-tecnico.md
 *
 * Decisiones aplicadas:
 *  - Producto plantilla ÚNICO; el modal (Etapa C) varía el jobContext por fila.
 *  - Impresión M-2: candidatas B/N (láser mono) + Color (láser color). El motor
 *    NO auto-rutea por color: usa la que el adaptador setee en
 *    `maquinaSeleccionada_<configPasoId>` según el modoColor del documento.
 *    `modoColorAllowedModes` documenta el ruteo esperado.
 *  - Anillado DIFERIDO: la ruta trae SOLO `impresion_por_hoja`.
 *  - mecanismoCantidad = CALCULADO_POR_PASO: el adaptador pasa piezas del tamaño
 *    del pliego (A4/A3) con márgenes 0 ⇒ 1 pose/pliego ⇒ pliegos = hojas físicas.
 *
 * Idempotente y race-safe: si el producto ya existe (o lo crea otra provisión
 * concurrente), devuelve el existente. Auto-resuelve máquinas/perfiles/papeles
 * por ROL (no hardcodea ids del tenant).
 */

export const CC_RUTA_CODIGO = 'CC-IMPRESION-DOC';
export const CC_PRODUCTO_CODIGO = 'SYS-IMPRESION-DOC';
export const CC_SUBCAT_CODIGO = 'papeleria_comercial';
/** Marca de sistema del producto/ruta del centro de copiado: oculto del
 *  catálogo, no editable/borrable. Ver docs/centro-copiado-modulo-configurable-diseno.md. */
export const CC_SISTEMA_CODIGO = 'centro_copiado';
export const CC_PLIEGO_A4 = { preset: 'A4', anchoMm: 210, altoMm: 297 };

type MaquinaConDetalle = {
  id: string;
  nombre: string;
  componentesDesgaste: { soloColor: boolean }[];
  perfilesOperativos: { id: string; nombre: string }[];
};

const esColorMaquina = (m: MaquinaConDetalle) =>
  m.componentesDesgaste.some((c) => c.soloColor);

const perfilSimpleFaz = (perfiles: { id: string; nombre: string }[]) =>
  perfiles.find((p) => /simple/i.test(p.nombre)) ?? perfiles[0] ?? null;

// El paso de anillado toma su cantidad de `jobContext.juegos` (libros), NO de
// `jobContext.cantidad` (que es las hojas de la impresión). Así impresión y
// anillado conviven en una misma cotización sin pisarse: 1 anillo por libro, y
// el tiempo escala por el multiplicador `hojasPorLibro`.
const ANILLADO_MECANISMO_CANTIDAD = 'HEREDAR_DEL_OUTPUT_CANONICO';
const ANILLADO_CANTIDAD_CONFIG = { campoOutput: 'juegos' };

/**
 * Perfil operativo de la anilladora que usa el paso de anillado (aporta el
 * TIEMPO: productividad + setup/cleanup). Prefiere el de ESPIRAL_PLASTICO
 * cuando la máquina tiene un perfil por tipo de anillo; si no, el primero.
 */
const perfilAnilladora = (
  perfiles: { id: string; detalleJson?: unknown }[],
): { id: string } | null => {
  const esEspiral = (p: { detalleJson?: unknown }) =>
    (p.detalleJson as { tipoAnillo?: string } | null)?.tipoAnillo ===
    'ESPIRAL_PLASTICO';
  return perfiles.find(esEspiral) ?? perfiles[0] ?? null;
};

export type ProvisionResultado =
  | { estado: 'ya_existe'; productoId: string }
  | { estado: 'creado'; productoId: string; detalle: string }
  | { estado: 'omitido'; motivo: string };

export async function provisionarPlantillaCentroCopiado(
  prisma: PrismaClient,
  tenantId: string,
): Promise<ProvisionResultado> {
  const existente = await prisma.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    select: { id: true, sistemaCodigo: true },
  });
  if (existente) {
    // Backfill idempotente: la plantilla creada antes de existir la marca de
    // sistema queda sin flag; se la sana en el primer uso (así se esconde del
    // catálogo y se bloquea su edición sin una migración de datos aparte).
    if (existente.sistemaCodigo !== CC_SISTEMA_CODIGO) {
      await prisma.producto.update({
        where: { id: existente.id },
        data: { sistemaCodigo: CC_SISTEMA_CODIGO },
      });
      await prisma.ruta.updateMany({
        where: { tenantId, codigo: CC_RUTA_CODIGO },
        data: { sistemaCodigo: CC_SISTEMA_CODIGO },
      });
    }
    // Self-healing del anillado: si el tenant cargó una anilladora + anillos
    // después de provisionar, el paso opcional se agrega en el primer uso.
    await asegurarPasoAnilladoCC(prisma, tenantId);
    return { estado: 'ya_existe', productoId: existente.id };
  }

  const subcat = await prisma.productoSubcategoriaComercial.findUnique({
    where: { codigo: CC_SUBCAT_CODIGO },
  });
  if (!subcat)
    return {
      estado: 'omitido',
      motivo: `sin subcategoría '${CC_SUBCAT_CODIGO}'`,
    };

  const laseres = (await prisma.maquina.findMany({
    where: { tenantId, plantilla: 'IMPRESORA_LASER', activo: true },
    include: { componentesDesgaste: true, perfilesOperativos: true },
  })) as unknown as MaquinaConDetalle[];
  if (laseres.length === 0)
    return { estado: 'omitido', motivo: 'sin IMPRESORA_LASER' };

  const colorM =
    laseres
      .filter(esColorMaquina)
      .sort(
        (a, b) => b.perfilesOperativos.length - a.perfilesOperativos.length,
      )[0] ?? null;
  const bnM = laseres.find((m) => !esColorMaquina(m)) ?? null;

  const perfilColor = colorM
    ? perfilSimpleFaz(colorM.perfilesOperativos)
    : null;
  const perfilBn = bnM ? perfilSimpleFaz(bnM.perfilesOperativos) : null;

  const papeles = (
    await prisma.materiaPrima.findMany({
      where: { tenantId, subfamilia: 'SUSTRATO_HOJA' },
      include: {
        variantes: { where: { activo: true }, orderBy: { sku: 'asc' } },
      },
      orderBy: { nombre: 'asc' },
    })
  ).filter((p) => p.variantes.length > 0);
  if (papeles.length === 0)
    return { estado: 'omitido', motivo: 'sin papeles SUSTRATO_HOJA' };

  const papelDefault =
    papeles.find((p) => /obra/i.test(p.nombre)) ?? papeles[0];
  const maquinaBase = colorM ?? bnM!;
  const perfilBase = perfilColor ?? perfilBn;

  let productoId: string;
  try {
    productoId = await prisma.$transaction(async (tx) => {
      const ruta = await tx.ruta.create({
        data: {
          tenantId,
          codigo: CC_RUTA_CODIGO,
          nombre: 'Impresión de documento (centro de copiado)',
          descripcion:
            'Ruta plantilla del TPV Centro de copiado. Solo impresión por hoja; anillado diferido.',
          versionActual: 1,
          sistemaCodigo: CC_SISTEMA_CODIGO,
          activo: true,
        },
      });
      const paso = await tx.rutaPaso.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          version: 1,
          orden: 0,
          familiaCodigo: 'impresion_por_hoja',
          icono: 'Printer',
          activo: true,
        },
      });
      // El motor valida la ruta contra el snapshot de la RutaVersion (no basta
      // con los RutaPaso vivos): sin esta fila, cotizar falla con
      // "no tiene snapshot de versión 1".
      await tx.rutaVersion.create({
        data: {
          tenantId,
          rutaId: ruta.id,
          version: 1,
          snapshotJson: {
            pasos: [{ id: paso.id, orden: 0, familia: 'impresion_por_hoja' }],
          },
          cambios: 'Versión inicial (plantilla TPV centro de copiado)',
        },
      });
      const producto = await tx.producto.create({
        data: {
          tenantId,
          codigo: CC_PRODUCTO_CODIGO,
          nombre: 'Impresión de documento',
          descripcion:
            'Producto plantilla del TPV Centro de copiado. No se cotiza directo desde el catálogo: lo consume el modal de carga rápida (un renglón por documento).',
          subcategoriaComercialId: subcat.id,
          unidadComercial: 'unidad',
          modoMedidas: 'MIXTA',
          medidaDefaultAnchoMm: CC_PLIEGO_A4.anchoMm,
          medidaDefaultAltoMm: CC_PLIEGO_A4.altoMm,
          categoriaFiscal: 'general',
          sistemaCodigo: CC_SISTEMA_CODIGO,
          precioConfigJson: {
            metodoCalculo: 'por_margen',
            detalle: { marginPct: 40, minimumMarginPct: 25 },
          },
          activo: true,
        },
      });
      const rutaAlt = await tx.productoRutaAlternativa.create({
        data: {
          tenantId,
          productoId: producto.id,
          rutaId: ruta.id,
          rutaVersion: 1,
          nombre: 'Impresión digital',
          esPreferida: true,
          orden: 0,
          activo: true,
        },
      });
      const configPaso = await tx.productoConfigPaso.create({
        data: {
          tenantId,
          productoRutaAlternativaId: rutaAlt.id,
          rutaPasoId: paso.id,
          modoActivacion: 'OBLIGATORIO',
          modoTiempo: 'T-3',
          mecanismoCantidad: 'CALCULADO_POR_PASO',
          multiplicadoresActivos: ['caras'],
          maquinaM1Id: maquinaBase.id,
          perfilM1Id: perfilBase ? perfilBase.id : null,
          paramsPasoJson: {
            nestingConfig: {
              pliegoImpresion: CC_PLIEGO_A4,
              extraMargins: { topMm: 0, leftMm: 0, rightMm: 0, bottomMm: 0 },
              allowRotation: false,
            },
          },
          activo: true,
        },
      });

      const candidatas: {
        maquinaId: string;
        perfilDefaultId: string | null;
        modos: string[];
        esPreferida: boolean;
        orden: number;
      }[] = [];
      if (colorM)
        candidatas.push({
          maquinaId: colorM.id,
          perfilDefaultId: perfilColor ? perfilColor.id : null,
          modos: ['CMYK'],
          esPreferida: true,
          orden: 0,
        });
      if (bnM)
        candidatas.push({
          maquinaId: bnM.id,
          perfilDefaultId: perfilBn ? perfilBn.id : null,
          modos: ['BN'],
          esPreferida: !colorM,
          orden: colorM ? 1 : 0,
        });
      for (const c of candidatas) {
        await tx.productoConfigPasoMaquinaCandidata.create({
          data: {
            tenantId,
            productoConfigPasoId: configPaso.id,
            maquinaId: c.maquinaId,
            esPreferida: c.esPreferida,
            orden: c.orden,
            activo: true,
            perfilDefaultId: c.perfilDefaultId,
            modoColorAllowedModes: c.modos,
          },
        });
      }

      const slot = await tx.productoConfigPasoSlotMaterial.create({
        data: {
          tenantId,
          productoConfigPasoId: configPaso.id,
          slotCodigo: 'sustrato_principal',
          modoSeleccion: 'COMERCIAL_ELIGE',
          estrategiaCosto: 'simple',
          formula: 'por_unidad_productiva',
          aplicaMultiCaras: false, // el papel se cuenta por hoja, no por carilla
          activo: true,
        },
      });
      let ord = 0;
      for (const p of papeles) {
        await tx.productoConfigPasoSlotMaterialCandidato.create({
          data: {
            tenantId,
            slotMaterialId: slot.id,
            materiaPrimaId: p.id,
            defaultVarianteId: p.variantes[0].id,
            orden: ord++,
            todasLasVariantes: true,
          },
        });
      }

      return producto.id;
    });
  } catch (e) {
    // Carrera con otra provisión concurrente (dos requests/tests provisionando a
    // la vez): si el producto ya quedó creado, devolverlo; si no, propagar.
    const yaExiste = await prisma.producto.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    });
    if (yaExiste) return { estado: 'ya_existe', productoId: yaExiste.id };
    throw e;
  }

  const detalle =
    `color: ${colorM ? colorM.nombre : '—'} (${perfilColor ? perfilColor.nombre : '—'}) · ` +
    `B/N: ${bnM ? bnM.nombre : '—'} (${perfilBn ? perfilBn.nombre : '—'}) · ` +
    `papeles: ${papeles.map((p) => p.nombre).join(', ')} · default: ${papelDefault.nombre}`;
  // El anillado se agrega aparte (opcional, condicionado a anilladora + anillos).
  await asegurarPasoAnilladoCC(prisma, tenantId);
  return { estado: 'creado', productoId, detalle };
}

/**
 * Cablea (idempotente, self-healing) el paso OPCIONAL `encuadernado_anillado` en la
 * ruta de la plantilla de CC — la terminación "Anillado". Sólo lo agrega si el
 * tenant tiene una ANILLADORA (config o la única activa) y anillos instalados
 * (materia prima ANILLADO_ENCUADERNACION con variantes). Sin eso, no se ofrece.
 *
 * El paso es M-1 (máquina fija = anilladora), T-2 (productividad del perfil),
 * cantidad DIRECT (= juegos), multiplicador hojasPorLibro (escala el TIEMPO; el
 * anillo se consume 1 por libro). El slot `anillo` deja que el motor elija la
 * variante por MENOR_CAPACIDAD_QUE_CUMPLA (Ø mínimo que aguanta las hojas del libro).
 * Ver docs/anilladora-encuadernacion-espiral-diseno.md §4.bis (Etapa C).
 */

/**
 * Deja el slot `anillo` con TODOS los anillos instalados como candidatos. Se
 * llama en el self-heal: si el tenant agrega un 2º tipo (Wire-O) después de
 * provisionar el paso, sin esto ese tipo no tendría candidato y saldría sin
 * material ($0). No borra candidatos existentes; sólo agrega los que faltan.
 */
async function sincronizarCandidatosAnilloCC(
  prisma: PrismaClient,
  tenantId: string,
  configPasoId: string,
): Promise<void> {
  const anillos = (
    await prisma.materiaPrima.findMany({
      where: {
        tenantId,
        familia: 'TERMINACION_EDITORIAL',
        subfamilia: 'ANILLADO_ENCUADERNACION',
      },
      include: {
        variantes: { where: { activo: true }, orderBy: { sku: 'asc' } },
      },
    })
  ).filter((a) => a.variantes.length > 0);
  const slot = await prisma.productoConfigPasoSlotMaterial.findFirst({
    where: { productoConfigPasoId: configPasoId, slotCodigo: 'anillo' },
    select: { id: true, candidatos: { select: { materiaPrimaId: true } } },
  });
  if (!slot) return;
  const existentes = new Set(slot.candidatos.map((c) => c.materiaPrimaId));
  let orden = slot.candidatos.length;
  for (const a of anillos) {
    if (existentes.has(a.id)) continue;
    await prisma.productoConfigPasoSlotMaterialCandidato.create({
      data: {
        tenantId,
        slotMaterialId: slot.id,
        materiaPrimaId: a.id,
        defaultVarianteId: a.variantes[0].id,
        orden: orden++,
        todasLasVariantes: true,
      },
    });
  }
}

/** Cliente Prisma o transacción (ambos exponen los modelos que usamos). */
type Db = PrismaClient | Prisma.TransactionClient;

type TapaMP = { id: string; variantes: Array<{ id: string }> };

/** Tapas de encuadernación instaladas (frontal transparente + contratapa). */
async function cargarTapasCC(db: Db, tenantId: string): Promise<TapaMP[]> {
  return (
    await db.materiaPrima.findMany({
      where: {
        tenantId,
        familia: 'TERMINACION_EDITORIAL',
        subfamilia: 'TAPA_ENCUADERNACION',
      },
      include: {
        variantes: { where: { activo: true }, orderBy: { sku: 'asc' } },
      },
    })
  )
    .filter((t) => t.variantes.length > 0)
    .map((t) => ({ id: t.id, variantes: t.variantes.map((v) => ({ id: v.id })) }));
}

/**
 * Asegura los 2 slots de tapa (frontal + contratapa) en el paso de anillado y
 * los deja con TODAS las tapas instaladas como candidatos. El centro de copiado
 * resuelve por tamaño del documento cuál variante va en cada slot y la pinnea
 * con `slotMateriales` (como el papel de la impresión). Idempotente: crea el
 * slot si falta y agrega los candidatos que falten (no borra). Si no hay tapas
 * instaladas, no hace nada (el anillado funciona sin tapas). Se llama en la
 * provisión fresca (dentro de la tx) y en el self-heal (cuando el tenant carga
 * las tapas DESPUÉS de provisionar el paso).
 */
async function asegurarSlotsTapaCC(
  db: Db,
  tenantId: string,
  configPasoId: string,
  tapas: TapaMP[],
): Promise<void> {
  if (tapas.length === 0) return;
  for (const slotCodigo of ['tapa_frontal', 'tapa_posterior'] as const) {
    let slot = await db.productoConfigPasoSlotMaterial.findFirst({
      where: { productoConfigPasoId: configPasoId, slotCodigo },
      select: { id: true, candidatos: { select: { materiaPrimaId: true } } },
    });
    if (!slot) {
      try {
        const created = await db.productoConfigPasoSlotMaterial.create({
          data: {
            tenantId,
            productoConfigPasoId: configPasoId,
            slotCodigo,
            slotRol: 'CONSUMIBLE',
            // El CC lo pinnea por slotMateriales; se ofrecen todas las tapas como
            // candidatos (mismo patrón que el papel de la impresión).
            modoSeleccion: 'COMERCIAL_ELIGE',
            estrategiaCosto: 'simple',
            formula: 'por_unidad_productiva', // 1 tapa por libro (cantidad = juegos)
            aplicaMultiCaras: false, // la tapa se cuenta por libro, no por carilla
            activo: true,
          },
          select: { id: true },
        });
        slot = { id: created.id, candidatos: [] };
      } catch (e) {
        // Otra provisión/heal concurrente creó el slot: refetch idempotente.
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          (e.code === 'P2002' || e.code === 'P2034')
        ) {
          slot = await db.productoConfigPasoSlotMaterial.findFirst({
            where: { productoConfigPasoId: configPasoId, slotCodigo },
            select: {
              id: true,
              candidatos: { select: { materiaPrimaId: true } },
            },
          });
        } else {
          throw e;
        }
      }
    }
    if (!slot) continue;
    const existentes = new Set(slot.candidatos.map((c) => c.materiaPrimaId));
    let orden = slot.candidatos.length;
    for (const t of tapas) {
      if (existentes.has(t.id)) continue;
      await db.productoConfigPasoSlotMaterialCandidato.create({
        data: {
          tenantId,
          slotMaterialId: slot.id,
          materiaPrimaId: t.id,
          defaultVarianteId: t.variantes[0].id,
          orden: orden++,
          todasLasVariantes: true,
        },
      });
    }
  }
}

export async function asegurarPasoAnilladoCC(
  prisma: PrismaClient,
  tenantId: string,
): Promise<void> {
  const producto = await prisma.producto.findUnique({
    where: { tenantId_codigo: { tenantId, codigo: CC_PRODUCTO_CODIGO } },
    select: {
      rutasAlternativas: {
        where: { activo: true },
        take: 1,
        select: {
          id: true,
          rutaId: true,
          rutaVersion: true,
          configPasos: {
            select: {
              id: true,
              maquinaM1Id: true,
              perfilM1Id: true,
              mecanismoCantidad: true,
              modoTiempo: true,
              rutaPaso: { select: { familiaCodigo: true } },
            },
          },
        },
      },
    },
  });
  const rutaAlt = producto?.rutasAlternativas[0];
  if (!rutaAlt) return;
  const pasoExistente = rutaAlt.configPasos.find(
    (cp) => cp.rutaPaso?.familiaCodigo === 'encuadernado_anillado',
  );

  // Anilladora: la elegida en la config o, si hay una sola, esa.
  const config = await prisma.centroCopiadoConfig.findUnique({
    where: { tenantId },
    select: { maquinaAnilladoraId: true },
  });
  const anilladoras = await prisma.maquina.findMany({
    where: { tenantId, plantilla: 'ANILLADORA', activo: true },
    select: {
      id: true,
      perfilesOperativos: {
        where: { activo: true },
        select: { id: true, nombre: true, detalleJson: true },
      },
    },
  });
  const anilladora = config?.maquinaAnilladoraId
    ? (anilladoras.find((m) => m.id === config.maquinaAnilladoraId) ?? null)
    : anilladoras.length === 1
      ? anilladoras[0]
      : null;
  if (!anilladora) return; // sin anilladora: no se ofrece el anillado

  const perfil = perfilAnilladora(anilladora.perfilesOperativos);

  // Si el paso YA existe: re-alinear su máquina/perfil con la anilladora vigente.
  // Cubre el caso de cargar el perfil DESPUÉS de provisionar el paso (si no, el
  // tiempo del anillado quedaría en 0 para siempre) o cambiar la anilladora.
  if (pasoExistente) {
    const nuevoPerfilId = perfil ? perfil.id : pasoExistente.perfilM1Id;
    const cambiaMaquina = pasoExistente.maquinaM1Id !== anilladora.id;
    const cambiaPerfil = pasoExistente.perfilM1Id !== nuevoPerfilId;
    // Migrar pasos viejos: cantidad desde `jobContext.cantidad` (→ juegos) y el
    // tiempo desde los params (T-2 → T-3, productividad del perfil).
    const cambiaMecanismo =
      pasoExistente.mecanismoCantidad !== ANILLADO_MECANISMO_CANTIDAD;
    const cambiaTiempo = pasoExistente.modoTiempo !== 'T-3';
    if (cambiaMaquina || cambiaPerfil || cambiaMecanismo || cambiaTiempo) {
      await prisma.productoConfigPaso.update({
        where: { id: pasoExistente.id },
        data: {
          maquinaM1Id: anilladora.id,
          perfilM1Id: nuevoPerfilId,
          mecanismoCantidad: ANILLADO_MECANISMO_CANTIDAD,
          mecanismoCantidadConfigJson: ANILLADO_CANTIDAD_CONFIG,
          modoTiempo: 'T-3',
        },
      });
    }
    // Migrar el slot viejo para que filtre por tipo de anillo (Ø dentro del tipo).
    await prisma.productoConfigPasoSlotMaterial.updateMany({
      where: {
        productoConfigPasoId: pasoExistente.id,
        slotCodigo: 'anillo',
        criterioFiltroCampo: null,
      },
      data: { criterioFiltroCampo: 'tipoAnillo' },
    });
    // Sumar al slot los anillos instalados DESPUÉS de provisionar el paso (ej. un
    // 2º tipo Wire-O): sin esto, elegir ese tipo no encuentra material y sale $0.
    await sincronizarCandidatosAnilloCC(prisma, tenantId, pasoExistente.id);
    // Tapas cargadas DESPUÉS de provisionar el paso: crea los slots (si faltan)
    // y sincroniza candidatos. Idempotente; no-op si no hay tapas.
    await asegurarSlotsTapaCC(
      prisma,
      tenantId,
      pasoExistente.id,
      await cargarTapasCC(prisma, tenantId),
    );
    return;
  }

  // Anillos instalados (materia prima con variantes) para poblar el slot.
  const anillos = (
    await prisma.materiaPrima.findMany({
      where: {
        tenantId,
        familia: 'TERMINACION_EDITORIAL',
        subfamilia: 'ANILLADO_ENCUADERNACION',
      },
      include: {
        variantes: { where: { activo: true }, orderBy: { sku: 'asc' } },
      },
    })
  ).filter((a) => a.variantes.length > 0);
  if (anillos.length === 0) return; // sin anillos instalados: no se ofrece

  // Tapas instaladas (opcionales): frontal transparente + contratapa cartón.
  const tapas = await cargarTapasCC(prisma, tenantId);

  try {
    await provisionarPasoAnilladoTx(
      prisma,
      tenantId,
      rutaAlt,
      anilladora,
      perfil,
      anillos,
      tapas,
    );
  } catch (e) {
    // Dos cotizaciones concurrentes pueden entrar a la vez y chocar al crear el
    // rutaPaso (unique tenantId+rutaId+version+orden) o el configPaso: otra tx ya
    // lo creó. Es idempotente: si ya existe, listo. Cualquier otro error se propaga.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      (e.code === 'P2002' || e.code === 'P2034')
    ) {
      return;
    }
    throw e;
  }
}

async function provisionarPasoAnilladoTx(
  prisma: PrismaClient,
  tenantId: string,
  rutaAlt: {
    id: string;
    rutaId: string;
    rutaVersion: number;
  },
  anilladora: { id: string },
  perfil: { id: string } | null,
  anillos: Array<{ id: string; variantes: Array<{ id: string }> }>,
  tapas: TapaMP[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Re-check dentro de la tx (race-safe con otra provisión concurrente).
    const existe = await tx.productoConfigPaso.findFirst({
      where: {
        productoRutaAlternativaId: rutaAlt.id,
        rutaPaso: { familiaCodigo: 'encuadernado_anillado' },
      },
      select: { id: true },
    });
    if (existe) return;

    const rutaPaso = await tx.rutaPaso.create({
      data: {
        tenantId,
        rutaId: rutaAlt.rutaId,
        version: rutaAlt.rutaVersion,
        orden: 1,
        familiaCodigo: 'encuadernado_anillado',
        icono: 'BookOpen',
        activo: true,
      },
    });

    // El motor valida la ruta contra el snapshot de la RutaVersion: hay que
    // agregar el paso ahí o cotizar falla ("paso fuera del snapshot").
    const ver = await tx.rutaVersion.findFirst({
      where: { rutaId: rutaAlt.rutaId, version: rutaAlt.rutaVersion },
      select: { id: true, snapshotJson: true },
    });
    if (ver) {
      const snap = (ver.snapshotJson ?? {}) as Record<string, unknown>;
      const prev = Array.isArray(snap.pasos) ? (snap.pasos as unknown[]) : [];
      // El motor filtra los configPasos por el `id` (rutaPasoId) del snapshot.
      // Si quedó una entrada de anillado vieja (rutaPaso recreado), su id no
      // matchea y el paso se excluiría. Se REEMPLAZA toda entrada de anillado
      // por la del rutaPaso actual, así el snapshot siempre apunta al vigente.
      const sinAnillado = prev.filter((p) => {
        const fam = p as { familia?: string; familiaCodigo?: string };
        return (
          fam.familia !== 'encuadernado_anillado' &&
          fam.familiaCodigo !== 'encuadernado_anillado'
        );
      });
      const pasos = [
        ...sinAnillado,
        { id: rutaPaso.id, orden: 1, familia: 'encuadernado_anillado' },
      ];
      await tx.rutaVersion.update({
        where: { id: ver.id },
        data: {
          snapshotJson: { ...snap, pasos } as Prisma.InputJsonObject,
        },
      });
    }

    const configPaso = await tx.productoConfigPaso.create({
      data: {
        tenantId,
        productoRutaAlternativaId: rutaAlt.id,
        rutaPasoId: rutaPaso.id,
        modoActivacion: 'OPCIONAL',
        // T-3 = productividad del PERFIL de la máquina (hojas/h de la anilladora).
        // Con T-2 el motor lee la productividad de los params del paso, no del
        // perfil, y el tiempo quedaría en 0. El tiempo = juegos × hojasPorLibro /
        // productividad (el multiplicador escala a hojas totales perforadas).
        modoTiempo: 'T-3',
        mecanismoCantidad: ANILLADO_MECANISMO_CANTIDAD,
        mecanismoCantidadConfigJson: ANILLADO_CANTIDAD_CONFIG,
        multiplicadoresActivos: ['hojasPorLibro'],
        maquinaM1Id: anilladora.id,
        perfilM1Id: perfil ? perfil.id : null,
        paramsPasoJson: {
          productivityUnit: 'unidades_h',
          timeCalculationMode: 'productivity',
          productivityQuantitySource: 'cantidad',
        },
        activo: true,
      },
    });

    const slot = await tx.productoConfigPasoSlotMaterial.create({
      data: {
        tenantId,
        productoConfigPasoId: configPaso.id,
        slotCodigo: 'anillo',
        slotRol: 'CONSUMIBLE',
        modoSeleccion: 'MOTOR_ELIGE_AUTO',
        criterioMotorAuto: 'MENOR_CAPACIDAD_QUE_CUMPLA',
        criterioInputCampo: 'hojasPorLibro',
        criterioMaterialCampo: 'capacidadMaxHojas',
        // El Ø auto se elige DENTRO del tipo pedido (jobContext.tipoAnillo).
        criterioFiltroCampo: 'tipoAnillo',
        estrategiaCosto: 'simple',
        formula: 'por_unidad_productiva', // 1 anillo por libro (cantidad = juegos)
        activo: true,
      },
    });

    let ord = 0;
    for (const a of anillos) {
      await tx.productoConfigPasoSlotMaterialCandidato.create({
        data: {
          tenantId,
          slotMaterialId: slot.id,
          materiaPrimaId: a.id,
          defaultVarianteId: a.variantes[0].id,
          orden: ord++,
          todasLasVariantes: true,
        },
      });
    }

    // Slots de tapa (frontal + contratapa) en el mismo paso. No-op si no hay
    // tapas instaladas; el anillado igual queda operativo (sólo el anillo).
    await asegurarSlotsTapaCC(tx, tenantId, configPaso.id, tapas);
  });
}
