/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed del catálogo de Cargos Directos del modelo universal (D.6).
 *
 * 5 tipos cerrados:
 * - tercerizacion
 * - viatico
 * - combustible_flete
 * - matriz_custom
 * - recargo_urgencia
 */

async function seedCargosDirectosCatalogo(prisma, tenantId) {
  const cargos = [
    {
      tenantId,
      codigo: "tercerizacion",
      nombre: "Tercerización",
      descripcion: "Trabajo enviado a proveedor externo (ej: corte láser de material exótico).",
      modoCalculo: "MONTO_FIJO_PLANO",
      modosActivacionSoportados: ["OPCIONAL"],
      configJson: {},
      activo: true,
    },
    {
      tenantId,
      codigo: "viatico",
      nombre: "Viático",
      descripcion: "Viático por viaje (toma de medidas o instalación fuera del taller).",
      modoCalculo: "MONTO_FIJO_PLANO",
      modosActivacionSoportados: ["OPCIONAL"],
      configJson: {
        zonas: [
          { codigo: "CABA", nombre: "CABA", monto: 3000 },
          { codigo: "GBA_NORTE", nombre: "GBA Norte", monto: 5000 },
          { codigo: "GBA_OESTE", nombre: "GBA Oeste", monto: 5000 },
          { codigo: "GBA_SUR", nombre: "GBA Sur", monto: 5000 },
          { codigo: "FUERA_AMBA", nombre: "Fuera AMBA", monto: 12000 },
        ],
      },
      activo: true,
    },
    {
      tenantId,
      codigo: "combustible_flete",
      nombre: "Combustible / flete",
      descripcion: "Envío con vehículo propio. Cobro por unidad de input (km).",
      modoCalculo: "POR_UNIDAD_INPUT",
      modosActivacionSoportados: ["OPCIONAL"],
      configJson: {
        precioPorUnidad: 80,
        unidad: "km",
        inputCantidad: "distanciaKm",
      },
      activo: true,
    },
    {
      tenantId,
      codigo: "matriz_custom",
      nombre: "Matriz custom",
      descripcion: "Matriz hecha a medida (hotstamping, troquel). Se cobra una vez y queda.",
      modoCalculo: "MONTO_FIJO_PLANO",
      modosActivacionSoportados: ["OBLIGATORIO", "OPCIONAL"],
      configJson: {},
      activo: true,
    },
    {
      tenantId,
      codigo: "recargo_urgencia",
      nombre: "Recargo por urgencia",
      descripcion: "Recargo % sobre subtotal cuando el pedido es urgente.",
      modoCalculo: "PORCENTAJE_SOBRE_BASE",
      modosActivacionSoportados: ["OPCIONAL"],
      configJson: {
        porcentajeDefault: 30,
        baseDeCalculo: "SUBTOTAL",
      },
      activo: true,
    },
  ];

  await Promise.all(
    cargos.map((cargo) =>
      prisma.cargoDirectoCatalogo.create({ data: cargo }),
    ),
  );

  console.info(`✅ Cargos directos catálogo: ${cargos.length} tipos creados.`);
}

module.exports = { seedCargosDirectosCatalogo };
