/** Convierte descripciones del catálogo técnico en texto apto para usuarios. */
export function descripcionPasoParaUsuario(descripcion?: string | null): string {
  if (!descripcion) return "";
  return descripcion
    .split(/(?<=[.!?])\s+/)
    .filter((frase) => !/docs\/|\.md\b|§\d/i.test(frase))
    .join(" ")
    .replace(/\bM-0\b/g, "trabajo manual")
    .replace(/\bM-1\b/g, "una máquina")
    .replace(/\bM-2\b/g, "varias máquinas posibles")
    .replace(/\bT-4\b/g, "tiempo cargado al cotizar")
    .replace(/\boutputs?\b/gi, "resultados")
    .replace(/\bHEREDAN\b/g, "heredan")
    .replace(/\s{2,}/g, " ")
    .trim();
}
