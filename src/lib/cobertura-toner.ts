/**
 * Cobertura de tóner por nivel (front). Eje ortogonal al perfil: sólo modula el
 * consumo de tóner. Los 3 niveles son fijos del sistema y espejan el backend
 * (apps/api/.../cobertura-toner.ts). Ver docs/cobertura-toner-por-nivel-diseno.md.
 */

export const NIVELES_COBERTURA = ["borrador", "normal", "alta"] as const;
export type NivelCobertura = (typeof NIVELES_COBERTURA)[number];

export const NIVEL_COBERTURA_DEFAULT: NivelCobertura = "normal";

export const NIVEL_COBERTURA_LABELS: Record<NivelCobertura, string> = {
  borrador: "Borrador",
  normal: "Normal",
  alta: "Alta",
};

/** Consumo g/m² por nivel; cada uno opcional (vacío = usar consumoBase). */
export type ConsumoPorCobertura = Partial<Record<NivelCobertura, number>>;
