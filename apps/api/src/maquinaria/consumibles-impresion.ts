export const PRINTER_TEMPLATES_WITH_MACHINE_CONSUMABLES = new Set<string>([
  'impresora_laser',
  'duplicadora_digital',
  'impresora_gran_formato_por_area',
  'plotter_cad',
  'IMPRESORA_LASER',
  'DUPLICADORA_DIGITAL',
  'IMPRESORA_GRAN_FORMATO_POR_AREA',
  'PLOTTER_CAD',
]);

export const CONSUMABLE_CHANNELS = [
  'cian',
  'magenta',
  'amarillo',
  'negro',
  'blanco',
  'barniz',
] as const;

export type ConsumableChannel = (typeof CONSUMABLE_CHANNELS)[number];

const CHANNEL_SET = new Set<string>(CONSUMABLE_CHANNELS);

export function normalizeConsumableChannel(
  value: unknown,
): ConsumableChannel | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const aliases: Record<string, ConsumableChannel> = {
    c: 'cian',
    cyan: 'cian',
    cian: 'cian',
    m: 'magenta',
    magenta: 'magenta',
    y: 'amarillo',
    yellow: 'amarillo',
    amarillo: 'amarillo',
    k: 'negro',
    black: 'negro',
    negro: 'negro',
    w: 'blanco',
    white: 'blanco',
    blanco: 'blanco',
    v: 'barniz',
    varnish: 'barniz',
    barniz: 'barniz',
  };

  return aliases[normalized] ?? null;
}

export function isConsumableChannel(
  value: unknown,
): value is ConsumableChannel {
  return typeof value === 'string' && CHANNEL_SET.has(value);
}

export function requiredConsumableChannelsFromColorMode(
  rawMode: unknown,
): ConsumableChannel[] {
  if (Array.isArray(rawMode)) {
    const channels = rawMode.flatMap((item) => {
      const fromMode = requiredConsumableChannelsFromColorMode(item);
      if (fromMode.length > 0) return fromMode;
      const channel = normalizeConsumableChannel(item);
      return channel ? [channel] : [];
    });
    return Array.from(new Set(channels));
  }

  if (typeof rawMode !== 'string') return [];

  const normalized = rawMode
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/W/g, 'BLANCO');

  if (!normalized) return [];
  if (['BN', 'B/N', 'NEGRO', 'K'].includes(normalized)) return ['negro'];

  const channels: ConsumableChannel[] = [];
  if (normalized.includes('CMYK')) {
    channels.push('cian', 'magenta', 'amarillo', 'negro');
  }
  if (normalized.includes('BLANCO')) {
    channels.push('blanco');
  }
  if (normalized.includes('BARNIZ') || normalized.includes('VARNISH')) {
    channels.push('barniz');
  }

  return Array.from(new Set(channels));
}

export function getPerfilConsumableChannels(
  perfilDetalle: Record<string, unknown> | null | undefined,
  maquinaParametros?: Record<string, unknown> | null,
  modoColorSeleccionado?: unknown,
): ConsumableChannel[] {
  const bySelectedMode = requiredConsumableChannelsFromColorMode(
    modoColorSeleccionado,
  );
  if (bySelectedMode.length > 0) return bySelectedMode;

  const perfilMode = perfilDetalle?.colores ?? perfilDetalle?.modoColor;
  const byPerfil = requiredConsumableChannelsFromColorMode(perfilMode);
  if (byPerfil.length > 0) return byPerfil;

  const machineModes =
    maquinaParametros?.coloresSoportados ??
    maquinaParametros?.configuracionColor ??
    maquinaParametros?.configuracionCanales;
  const byMachine = requiredConsumableChannelsFromColorMode(machineModes);
  if (byMachine.length > 0) return byMachine;

  return [];
}

export function getConsumableChannelFromDetail(
  detalle: Record<string, unknown> | null | undefined,
): ConsumableChannel | null {
  return normalizeConsumableChannel(detalle?.color ?? detalle?.canal);
}

export function isDuplicatorMasterDetail(
  detalle: Record<string, unknown> | null | undefined,
) {
  const rol = typeof detalle?.rol === 'string' ? detalle.rol.toLowerCase() : '';
  return rol === 'master' || rol === 'máster';
}

export function duplicatorMasterQuantity(caras: number) {
  return caras === 2 ? 2 : 1;
}

export function consumableTypeForChannel(
  plantilla: string,
  channel: ConsumableChannel,
) {
  if (channel === 'barniz') return 'barniz';
  if (plantilla === 'impresora_laser' || plantilla === 'IMPRESORA_LASER') {
    return 'toner';
  }
  return 'tinta';
}

export function consumableUnitForTemplate(plantilla: string) {
  if (plantilla === 'impresora_laser' || plantilla === 'IMPRESORA_LASER') {
    return 'gramo';
  }
  return 'ml';
}
