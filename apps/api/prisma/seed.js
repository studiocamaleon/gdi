/* eslint-disable @typescript-eslint/no-require-imports */
const {
  PrismaClient,
  CategoriaComponenteCostoCentro,
  EstadoTarifaCentroCostoPeriodo,
  RolSistema,
  SeccionCentroCostoLinea,
  SexoEmpleado,
  TipoCentroCosto,
  TipoComision,
  TipoDireccion,
} = require("@prisma/client");
const bcrypt = require("bcryptjs");

const { seedCargosDirectosCatalogo } = require("./seed-modulos/cargos");
const { seedCatalogoComercial } = require("./seed-modulos/catalogo-comercial");
const { seedMaquinas } = require("./seed-modulos/maquinas");
const { seedMaterialPresets } = require("./seed-modulos/material-presets");
const { seedMateriales } = require("./seed-modulos/materiales");
const { seedRutasYProductos } = require("./seed-modulos/rutas-productos");
const {
  provisionPolyfanProduct,
} = require("./seed-modulos/polyfan-producto");
const {
  provisionViniloEsmeriladoProduct,
} = require("./seed-modulos/vinilo-esmerilado-producto");

/**
 * El seed EMPIEZA BORRANDO TODO. Por eso no corre en cualquier base: sólo en
 * una que se llame `*_test`, o en la que se nombre explícitamente con
 * SEED_ALLOW_DB. Sin esto, un `node prisma/seed.js` de más —o un `require()`
 * distraído, que también ejecuta el archivo— vacía la base de desarrollo.
 *
 *   Base de test:   npm run seed
 *   Otra base:      SEED_ALLOW_DB=gdi_saas npm run seed
 */
function verificarBaseDestino() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("No hay DATABASE_URL: el seed no sabe a qué base apunta.");
  }
  const nombre = decodeURIComponent(
    new URL(url).pathname.replace(/^\//, ""),
  ).trim();
  if (nombre.endsWith("_test")) return nombre;
  if (process.env.SEED_ALLOW_DB === nombre) return nombre;
  throw new Error(
    `El seed borra TODA la base y "${nombre}" no es una base de test.\n` +
      `Si de verdad querés vaciarla y recargarla:\n\n` +
      `    SEED_ALLOW_DB=${nombre} npm run seed\n`,
  );
}

const baseDestino = verificarBaseDestino();
const prisma = new PrismaClient();

async function main() {
  const periodoDemo = "2026-03";
  console.info(`Seed sobre la base "${baseDestino}" — se borra y se recarga.`);

  // Cleanup en orden (FKs primero) — entidades V2 incluidas
  await prisma.cotizacionItem.deleteMany();
  await prisma.cotizacion.deleteMany();
  await prisma.productoPrecioEspecialClienteV2.deleteMany();
  await prisma.productoCargoDirectoCotizacion.deleteMany();
  await prisma.productoCargoDirectoPaso.deleteMany();
  await prisma.cargoDirectoCatalogo.deleteMany();
  await prisma.productoConfigPasoMaquinaCandidata.deleteMany();
  await prisma.productoConfigPasoSlotMaterial.deleteMany();
  await prisma.productoConfigPaso.deleteMany();
  await prisma.productoPasoExtra.deleteMany();
  await prisma.productoRutaAlternativa.deleteMany();
  await prisma.producto.deleteMany();
  await prisma.rutaVersion.deleteMany();
  await prisma.rutaPaso.deleteMany();
  await prisma.ruta.deleteMany();
  await prisma.maquinaComponenteDesgaste.deleteMany();
  await prisma.maquinaConsumible.deleteMany();
  await prisma.maquinaPerfilOperativo.deleteMany();
  await prisma.maquina.deleteMany();
  await prisma.materiaPrimaVariante.deleteMany();
  await prisma.materiaPrima.deleteMany();
  await prisma.materialPresetVariante.deleteMany();
  await prisma.materialPreset.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.centroCostoTarifaPeriodo.deleteMany();
  await prisma.centroCostoCapacidadPeriodo.deleteMany();
  await prisma.centroCostoLinea.deleteMany();
  await prisma.centroCosto.deleteMany();
  await prisma.planta.deleteMany();
  await prisma.empleadoComision.deleteMany();
  await prisma.empleadoDireccion.deleteMany();
  await prisma.empleado.deleteMany();
  await prisma.proveedorContacto.deleteMany();
  await prisma.proveedorDireccion.deleteMany();
  await prisma.proveedor.deleteMany();
  await prisma.clienteContacto.deleteMany();
  await prisma.clienteDireccion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();

  const tenant = await prisma.tenant.create({
    data: {
      nombre: "Grafica Corporearte",
      slug: "gdi-demo",
      activo: true,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@gdi-demo.local",
      nombreCompleto: "Lucas German Gomez",
      passwordHash: bcrypt.hashSync("Admin123!", 10),
      activo: true,
    },
  });

  await prisma.membership.create({
    data: {
      userId: adminUser.id,
      tenantId: tenant.id,
      rol: RolSistema.ADMINISTRADOR,
      activa: true,
    },
  });

  await Promise.all([
    prisma.proveedor.create({
      data: {
        tenantId: tenant.id,
        nombre: "Papelera Austral",
        razonSocial: "Papelera Austral SRL",
        emailPrincipal: "ventas@papeleraaustral.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966458800",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Nadia Ferreyra",
              cargo: "Ventas corporativas",
              email: "nadia@papeleraaustral.com",
              telefonoCodigo: "54",
              telefonoNumero: "2966458811",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Deposito central",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Parque Industrial",
              numero: "210",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.proveedor.create({
      data: {
        tenantId: tenant.id,
        nombre: "Terminaciones Patagonicas",
        razonSocial: "Terminaciones Patagonicas SAS",
        emailPrincipal: "operaciones@terminacionespat.com",
        telefonoCodigo: "54",
        telefonoNumero: "2974500088",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Mauro Ponce",
              cargo: "Operaciones",
              email: "mauro@terminacionespat.com",
              telefonoCodigo: "54",
              telefonoNumero: "2974500089",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Planta tercerizada",
              paisCodigo: "AR",
              codigoPostal: "9011",
              direccion: "Ruta 3",
              numero: "S/N",
              ciudad: "Caleta Olivia",
              tipo: TipoDireccion.ENTREGA,
              principal: true,
            },
          ],
        },
      },
    }),
  ]);

  await Promise.all([
    prisma.cliente.create({
      data: {
        tenantId: tenant.id,
        nombre: "Cafe del Centro",
        razonSocial: "Cafe del Centro SRL",
        emailPrincipal: "compras@cafedelcentro.com",
        telefonoCodigo: "54",
        telefonoNumero: "2966123456",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Mariana Lopez",
              cargo: "Compras",
              email: "compras@cafedelcentro.com",
              telefonoCodigo: "54",
              telefonoNumero: "2966112233",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Domicilio principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Av. San Martin",
              numero: "1250",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.cliente.create({
      data: {
        tenantId: tenant.id,
        nombre: "Patagonia Packaging",
        razonSocial: "Patagonia Packaging SA",
        emailPrincipal: "sergio@patpack.com.ar",
        telefonoCodigo: "54",
        telefonoNumero: "2974120034",
        paisCodigo: "AR",
        contactos: {
          create: [
            {
              tenantId: tenant.id,
              nombre: "Sergio Diaz",
              cargo: "Gerencia comercial",
              email: "sergio@patpack.com.ar",
              telefonoCodigo: "54",
              telefonoNumero: "2974120034",
              principal: true,
            },
          ],
        },
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Planta industrial",
              paisCodigo: "AR",
              codigoPostal: "9011",
              direccion: "Ruta Provincial 12",
              numero: "S/N",
              ciudad: "Caleta Olivia",
              tipo: TipoDireccion.ENTREGA,
              principal: true,
            },
          ],
        },
      },
    }),
  ]);

  const empleados = await Promise.all([
    prisma.empleado.create({
      data: {
        tenantId: tenant.id,
        userId: adminUser.id,
        nombreCompleto: "Lucas Gomez",
        emailPrincipal: "admin@gdi-demo.local",
        telefonoCodigo: "54",
        telefonoNumero: "2966450000",
        sector: "Direccion",
        ocupacion: "Administrador general",
        sexo: SexoEmpleado.MASCULINO,
        fechaIngreso: new Date("2024-01-10"),
        fechaNacimiento: new Date("1990-07-22"),
        comisionesHabilitadas: false,
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Domicilio principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Pasteur",
              numero: "220",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.empleado.create({
      data: {
        tenantId: tenant.id,
        nombreCompleto: "Valentina Rojas",
        emailPrincipal: "valentina@gdi-demo.local",
        telefonoCodigo: "54",
        telefonoNumero: "2966451200",
        sector: "Preprensa",
        ocupacion: "Jefa de preprensa",
        sexo: SexoEmpleado.FEMENINO,
        fechaIngreso: new Date("2024-03-01"),
        fechaNacimiento: new Date("1994-11-15"),
        comisionesHabilitadas: false,
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Mitre",
              numero: "818",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
      },
    }),
    prisma.empleado.create({
      data: {
        tenantId: tenant.id,
        nombreCompleto: "Martin Vega",
        emailPrincipal: "martin@gdi-demo.local",
        telefonoCodigo: "54",
        telefonoNumero: "2966451300",
        sector: "Comercial",
        ocupacion: "Vendedor tecnico",
        sexo: SexoEmpleado.MASCULINO,
        fechaIngreso: new Date("2024-05-20"),
        fechaNacimiento: new Date("1992-04-04"),
        comisionesHabilitadas: true,
        direcciones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Principal",
              paisCodigo: "AR",
              codigoPostal: "9400",
              direccion: "Avenida Kirchner",
              numero: "1090",
              ciudad: "Rio Gallegos",
              tipo: TipoDireccion.PRINCIPAL,
              principal: true,
            },
          ],
        },
        comisiones: {
          create: [
            {
              tenantId: tenant.id,
              descripcion: "Comision por venta",
              tipo: TipoComision.PORCENTAJE,
              valor: "5.00",
            },
          ],
        },
      },
    }),
  ]);

  const planta = await prisma.planta.create({
    data: {
      tenantId: tenant.id,
      codigo: "PLT-001",
      nombre: "Planta principal",
      descripcion: "Sede operativa inicial",
      activa: true,
    },
  });

  // ============================================================================
  // CENTROS DE COSTO — planilla manual (docs/centros-de-costo-carga-manual-diseno.md)
  // ============================================================================
  // Una sola tabla de líneas en tres secciones reemplazó a las áreas, los
  // recursos y los componentes de costo. La tarifa ya no se declara suelta:
  // sale de sumar la planilla y dividir por las horas productivas del mes.

  const centroImpresion = await prisma.centroCosto.create({
    data: {
      tenantId: tenant.id,
      plantaId: planta.id,
      codigo: "IMP-001",
      nombre: "Offset 4 colores",
      descripcion: "Equipo principal de impresion offset",
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      activo: true,
    },
  });

  const centroPreprensa = await prisma.centroCosto.create({
    data: {
      tenantId: tenant.id,
      plantaId: planta.id,
      codigo: "PRE-001",
      nombre: "CTP principal",
      descripcion: "Centro productivo de salida a plancha",
      tipoCentro: TipoCentroCosto.PRODUCTIVO,
      activo: true,
    },
  });

  /**
   * Arma la planilla de un centro y publica su tarifa con los mismos números
   * que calcularía `buildTarifaSnapshot`: no hay tarifa inventada, el importe
   * de cada línea sale de su propia fórmula.
   *
   *   EMPLEADO     salario × (1 + cargas%) × dedicacion%
   *   ACTIVO_FIJO  (valorActual − valorFinalVida) / vidaUtilRestanteMeses
   *   GASTO_GENERAL  el importe declarado
   */
  async function seedPlanillaCentro(centro, horasProductivas, lineas) {
    const importeDeLinea = (linea) => {
      if (linea.seccion === SeccionCentroCostoLinea.EMPLEADO) {
        const cargas = 1 + Number(linea.cargasPct ?? 0) / 100;
        const dedicacion = Number(linea.dedicacionPct ?? 100) / 100;
        return Number(linea.salarioMensual) * cargas * dedicacion;
      }
      if (linea.seccion === SeccionCentroCostoLinea.ACTIVO_FIJO) {
        return (
          (Number(linea.valorActual) - Number(linea.valorFinalVida ?? 0)) /
          Number(linea.vidaUtilRestanteMeses)
        );
      }
      return Number(linea.importeMensual);
    };
    const r2 = (valor) => Math.round(valor * 100) / 100;

    await prisma.centroCostoLinea.createMany({
      data: lineas.map((linea, indice) => ({
        tenantId: tenant.id,
        centroCostoId: centro.id,
        periodo: periodoDemo,
        orden: indice,
        seccion: linea.seccion,
        nombre: linea.nombre,
        categoria: linea.categoria ?? null,
        ocupacion: linea.ocupacion ?? null,
        dedicacionPct: linea.dedicacionPct ?? null,
        salarioMensual: linea.salarioMensual ?? null,
        cargasPct: linea.cargasPct ?? null,
        vidaUtilRestanteMeses: linea.vidaUtilRestanteMeses ?? null,
        valorActual: linea.valorActual ?? null,
        valorFinalVida: linea.valorFinalVida ?? null,
        importeMensual: r2(importeDeLinea(linea)).toFixed(2),
      })),
    });

    await prisma.centroCostoCapacidadPeriodo.create({
      data: {
        tenantId: tenant.id,
        centroCostoId: centro.id,
        periodo: periodoDemo,
        horasProductivas: horasProductivas.toFixed(2),
      },
    });

    const sumar = (seccion) =>
      r2(
        lineas
          .filter((linea) => linea.seccion === seccion)
          .reduce((acc, linea) => acc + importeDeLinea(linea), 0),
      );
    const gastosGenerales = sumar(SeccionCentroCostoLinea.GASTO_GENERAL);
    const manoObra = sumar(SeccionCentroCostoLinea.EMPLEADO);
    const activosFijos = sumar(SeccionCentroCostoLinea.ACTIVO_FIJO);
    const costoMensualTotal = r2(gastosGenerales + manoObra + activosFijos);
    const tarifaCalculada = r2(costoMensualTotal / horasProductivas);
    const tarifaManoObra = r2(manoObra / horasProductivas);

    // Sin centros NO_PRODUCTIVO en el demo no hay estructura que repartir,
    // así que lo absorbido es cero y la tarifa directa es la tarifa.
    const resumenJson = {
      periodo: periodoDemo,
      centroCodigo: centro.codigo,
      centroNombre: centro.nombre,
      costoMensualGastosGenerales: gastosGenerales,
      costoMensualActivosFijos: activosFijos,
      costoMensualSinReparto: costoMensualTotal,
      costoMensualAbsorbidoReparto: 0,
      desgloseRepartoAbsorbido: [],
      costoMensualTotal,
      tarifaDirectaSinReparto: tarifaCalculada,
      tarifaAbsorbidaReparto: 0,
      capacidadPractica: horasProductivas,
      tarifaCalculada,
      costoMensualManoObra: manoObra,
      tarifaManoObra,
      advertencias: [],
    };

    const snapshot = {
      costoMensualTotal: costoMensualTotal.toFixed(2),
      capacidadPractica: horasProductivas.toFixed(2),
      tarifaCalculada: tarifaCalculada.toFixed(2),
      costoMensualManoObra: manoObra.toFixed(2),
      tarifaManoObra: tarifaManoObra.toFixed(2),
      resumenJson,
    };

    // Borrador y publicada: la ficha abre en la primera y el motor lee la
    // segunda.
    await prisma.centroCostoTarifaPeriodo.createMany({
      data: [
        {
          tenantId: tenant.id,
          centroCostoId: centro.id,
          periodo: periodoDemo,
          estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
          ...snapshot,
        },
        {
          tenantId: tenant.id,
          centroCostoId: centro.id,
          periodo: periodoDemo,
          estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
          ...snapshot,
        },
      ],
    });
  }

  // Offset: $3.400.000 / 149,60 h = $22.727,27 la hora.
  await seedPlanillaCentro(centroImpresion, 149.6, [
    {
      seccion: SeccionCentroCostoLinea.EMPLEADO,
      nombre: "Lucas Gomez",
      ocupacion: "Maquinista de impresion",
      dedicacionPct: "100.00",
      salarioMensual: "1200000.00",
      cargasPct: "66.666667",
    },
    {
      seccion: SeccionCentroCostoLinea.ACTIVO_FIJO,
      nombre: "Heidelberg SM74",
      categoria: CategoriaComponenteCostoCentro.AMORTIZACION,
      vidaUtilRestanteMeses: 60,
      valorActual: "54000000.00",
      valorFinalVida: "0.00",
    },
    {
      seccion: SeccionCentroCostoLinea.GASTO_GENERAL,
      nombre: "Energia",
      categoria: CategoriaComponenteCostoCentro.ENERGIA,
      importeMensual: "300000.00",
    },
    {
      seccion: SeccionCentroCostoLinea.GASTO_GENERAL,
      nombre: "Mantenimiento",
      categoria: CategoriaComponenteCostoCentro.MANTENIMIENTO,
      importeMensual: "200000.00",
    },
  ]);

  // Preprensa: $900.000 / 150 h = $6.000 la hora.
  await seedPlanillaCentro(centroPreprensa, 150, [
    {
      seccion: SeccionCentroCostoLinea.EMPLEADO,
      nombre: "Valentina Rojas",
      ocupacion: "Jefa de preprensa",
      dedicacionPct: "100.00",
      salarioMensual: "500000.00",
      cargasPct: "40.000000",
    },
    {
      seccion: SeccionCentroCostoLinea.GASTO_GENERAL,
      nombre: "Licencias y software",
      categoria: CategoriaComponenteCostoCentro.INSUMOS_INDIRECTOS,
      importeMensual: "200000.00",
    },
  ]);

  // ============================================================================
  // MODELO UNIVERSAL V2 — Bloques nuevos de F.1.5
  // ============================================================================

  await seedCargosDirectosCatalogo(prisma, tenant.id);

  const catalogoComercial = await seedCatalogoComercial(prisma);
  await seedMaterialPresets(prisma);
  const materialesCreados = await seedMateriales(prisma, tenant.id);

  const maquinasCreadas = await seedMaquinas(prisma, tenant.id, planta.id);

  await seedRutasYProductos(
    prisma,
    tenant.id,
    maquinasCreadas,
    materialesCreados,
    catalogoComercial,
  );
  await provisionPolyfanProduct(prisma, tenant.id);
  await provisionViniloEsmeriladoProduct(prisma, tenant.id);

  console.info("");
  console.info("✅ Seed COMPLETADO.");
  console.info("");
  console.info("Tenant demo: Grafica Corporearte");
  console.info("Usuario admin: admin@gdi-demo.local");
  console.info("Clave admin: Admin123!");
  console.info("");
  console.info("Modelo Universal V2 cargado:");
  console.info("  • 7 máquinas + perfiles operativos");
  console.info("  • 12 materias primas + variantes");
  console.info("  • 5 cargos directos catálogo");
  console.info("  • 6 rutas de producción");
  console.info(
    "  • 6 productos validados (Tarjetas, Vinilo, Talonarios, Rígidos, Polyfan, Esmerilado)",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
