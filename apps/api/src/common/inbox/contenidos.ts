/** Datos de presentación, sin direcciones remotas ni identificadores de Meta. */
export type UbicacionInbox = {
  latitud: number;
  longitud: number;
  nombre: string;
  direccion: string;
};
export type ContactoCompartidoInbox = {
  nombre: string;
  telefonos: string[];
  correos: string[];
  organizacion: string;
  direcciones: string[];
};
export type CitaInbox = {
  id: string | null;
  nombre: string;
  texto: string;
  eliminado?: boolean;
};
const obj = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const str = (x: unknown, max = 1024) =>
  typeof x === 'string' ? x.slice(0, max) : '';
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
export function ubicacionInbox(x: unknown): UbicacionInbox | null {
  const l = obj(x),
    latitud = l.latitude ?? l.latitud,
    longitud = l.longitude ?? l.longitud;
  if (
    typeof latitud !== 'number' ||
    typeof longitud !== 'number' ||
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud) ||
    Math.abs(latitud) > 90 ||
    Math.abs(longitud) > 180
  )
    return null;
  return {
    latitud,
    longitud,
    nombre: str(l.name ?? l.nombre, 200),
    direccion: str(l.address ?? l.direccion, 500),
  };
}
export function contactosInbox(x: unknown): ContactoCompartidoInbox[] {
  return arr(x)
    .slice(0, 257)
    .map((raw) => {
      const c = obj(raw);
      return {
        nombre:
          str(obj(c.name).formatted_name ?? c.nombre, 256) ||
          'Contacto compartido',
        telefonos: arr(c.phones ?? c.telefonos)
          .slice(0, 20)
          .map((p) => str(typeof p === 'string' ? p : obj(p).phone, 80))
          .filter(Boolean),
        correos: arr(c.emails ?? c.correos)
          .slice(0, 20)
          .map((e) => str(typeof e === 'string' ? e : obj(e).email, 254))
          .filter(Boolean),
        organizacion: str(obj(c.org).company ?? c.organizacion, 256),
        direcciones: arr(c.addresses ?? c.direcciones)
          .slice(0, 10)
          .map((d) =>
            typeof d === 'string'
              ? str(d, 1024)
              : ['street', 'city', 'state', 'zip', 'country']
                  .map((k) => str(obj(d)[k], 200))
                  .filter(Boolean)
                  .join(', '),
          )
          .filter(Boolean),
      };
    });
}
