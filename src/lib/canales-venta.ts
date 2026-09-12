/** Mostrador conserva su identificador histórico; el nombre visible es Presencial. */
export const CANALES_VENTA = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "mostrador", label: "Presencial" },
  { value: "email", label: "Correo electrónico" },
  { value: "web", label: "Web" },
  { value: "app_movil", label: "Aplicación móvil" },
] as const;

const HISTORICOS: Record<string, string> = {
  vendedor_externo: "Vendedor externo",
  telefono: "Teléfono",
};

export function nombreCanalVenta(value?: string | null): string {
  if (!value) return "Sin indicar";
  return CANALES_VENTA.find((canal) => canal.value === value)?.label ?? HISTORICOS[value] ?? value;
}

export function esCanalVentaActivo(value?: string | null): boolean {
  return CANALES_VENTA.some((canal) => canal.value === value);
}

/** Un canal retirado sólo puede conservarse si ya estaba registrado. */
export function canalVentaValido(value: string, guardado?: string | null): boolean {
  return esCanalVentaActivo(value) || (value === guardado && Object.hasOwn(HISTORICOS, value));
}
