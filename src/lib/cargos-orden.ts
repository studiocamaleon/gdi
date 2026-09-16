import type { CargoDirectoCatalogo } from "./productos-servicios";
import { formatCurrency, type PropuestaCargoDirecto } from "./propuestas";
import type { Moneda } from "./moneda";

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function humanizeCodigo(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getCargoConfig(cargo: CargoDirectoCatalogo | null) {
  return (cargo?.configJson ?? {}) as Record<string, unknown>;
}

export function getCargoDefaultMonto(cargo: CargoDirectoCatalogo | null) {
  const config = getCargoConfig(cargo);
  const zonas = Array.isArray(config.zonas) ? config.zonas : [];
  const firstZona = zonas[0] as { monto?: unknown } | undefined;
  return asNumber(config.monto ?? firstZona?.monto, 0);
}

export function getCargoDefaultPorcentaje(cargo: CargoDirectoCatalogo | null) {
  const config = getCargoConfig(cargo);
  return asNumber(config.porcentaje ?? config.porcentajeDefault, 0);
}

export function getCargoDefaultPrecioUnidad(
  cargo: CargoDirectoCatalogo | null,
) {
  const config = getCargoConfig(cargo);
  return asNumber(config.precioPorUnidad, 0);
}

export function getCargoInputLabel(cargo: CargoDirectoCatalogo | null) {
  const config = getCargoConfig(cargo);
  const inputCantidad =
    typeof config.inputCantidad === "string"
      ? config.inputCantidad
      : "cantidad";
  const unidad = typeof config.unidad === "string" ? config.unidad : "";
  const labels: Record<string, string> = {
    distanciaKm: "Distancia",
    bultos: "Bultos",
    horas: "Horas",
    viajes: "Viajes",
    paradas: "Paradas",
    cajas: "Cajas",
    cantidad: "Cantidad",
  };
  const label = labels[inputCantidad] ?? humanizeCodigo(inputCantidad);
  return unidad ? `${label} (${unidad})` : label;
}

export function buildCargoOrdenSnapshot({
  cargo,
  monto,
  porcentaje,
  precioUnidad,
  cantidadInput,
  zonaCodigo,
  subtotalBase,
  nota,
  moneda,
}: {
  cargo: CargoDirectoCatalogo;
  monto: number;
  porcentaje: number;
  precioUnidad: number;
  cantidadInput: number;
  zonaCodigo: string;
  subtotalBase: number;
  nota: string;
  moneda: Moneda;
}): PropuestaCargoDirecto {
  const config = getCargoConfig(cargo);
  const zonas = Array.isArray(config.zonas) ? config.zonas : [];
  const zona =
    zonaCodigo && zonas.length > 0
      ? (zonas.find(
          (candidate) =>
            typeof candidate === "object" &&
            candidate !== null &&
            "codigo" in candidate &&
            String((candidate as { codigo: unknown }).codigo) === zonaCodigo,
        ) as { codigo?: string; nombre?: string; monto?: number } | undefined)
      : undefined;
  let montoNeto = monto;
  let detalle = "Monto fijo";
  const nextConfig: Record<string, unknown> = { ...config };

  if (cargo.modoCalculo === "MONTO_FIJO_PLANO") {
    montoNeto = zona ? asNumber(zona.monto, monto) : monto;
    nextConfig.montoAplicado = montoNeto;
    if (zona) {
      nextConfig.zonaAplicada = {
        codigo: zona.codigo,
        nombre: zona.nombre,
        monto: montoNeto,
      };
      detalle = zona.nombre ? `Zona ${zona.nombre}` : `Zona ${zona.codigo}`;
    }
  }

  if (cargo.modoCalculo === "PORCENTAJE_SOBRE_BASE") {
    montoNeto = (subtotalBase * porcentaje) / 100;
    nextConfig.porcentajeAplicado = porcentaje;
    detalle = `${porcentaje.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% sobre subtotal`;
  }

  if (cargo.modoCalculo === "POR_UNIDAD_INPUT") {
    montoNeto = precioUnidad * cantidadInput;
    nextConfig.precioPorUnidadAplicado = precioUnidad;
    nextConfig.cantidadAplicada = cantidadInput;
    detalle = `${cantidadInput.toLocaleString("es-AR")} x ${formatCurrency(precioUnidad, moneda)}`;
  }

  const montoRedondeado = Math.max(0, Math.round(montoNeto));
  const impuestoPorcentaje = 21;
  const impuestoMonto = Math.round(
    montoRedondeado * (impuestoPorcentaje / 100),
  );

  return {
    id: `cargo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    cargoDirectoCatalogoId: cargo.id,
    codigoSnapshot: cargo.codigo,
    nombreSnapshot: cargo.nombre,
    descripcionSnapshot: cargo.descripcion,
    modoCalculoSnapshot:
      cargo.modoCalculo as PropuestaCargoDirecto["modoCalculoSnapshot"],
    configSnapshot: nextConfig,
    baseCalculo: subtotalBase,
    cantidadInput:
      cargo.modoCalculo === "POR_UNIDAD_INPUT" ? cantidadInput : undefined,
    montoNeto: montoRedondeado,
    impuestoPorcentaje,
    impuestoMonto,
    total: montoRedondeado + impuestoMonto,
    detalle,
    nota: nota.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}
