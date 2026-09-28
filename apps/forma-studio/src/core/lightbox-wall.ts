import type { LightboxParameters } from "./types";

/** Los cierres y la fijación del brazo conservan material de apoyo aunque
 * el resto de la pared sea fino. Los acrílicos siguen entrando por sus caras. */
export const lightboxFixingWall = (p: Pick<LightboxParameters, "wall">) => Math.max(5, p.wall);
