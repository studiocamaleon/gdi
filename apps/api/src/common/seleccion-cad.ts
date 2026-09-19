export type SeleccionCad = {
  /** Selección comercial: se resuelve contra el catálogo del tenant. */
  cotizacion?: { id: string; revision: string };
  /** Compatibilidad de cargas anteriores al desacople. Nunca se usa en altas. */
  perfilId?: string;
  versionPerfil?: number;
  versionDestino?: number;
};
