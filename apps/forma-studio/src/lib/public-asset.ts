/** Recursos del editor tanto en desarrollo independiente como bajo /3d. */
export function publicAsset(path: string): string {
  return `${import.meta.env?.BASE_URL ?? "/"}${path.replace(/^\/+/, "")}`;
}
