/** Límite del JSON del BFF, igual al límite predeterminado del API. */
export const MAX_CUERPO_API = 1024 * 1024;

export class CuerpoDemasiadoGrande extends Error {
  constructor() {
    super("La solicitud supera el tamaño permitido.");
  }
}

/** Content-Length sirve para rechazar pronto, nunca como prueba del tamaño. */
export async function leerCuerpoLimitado(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array> {
  const anunciado = Number(request.headers.get("content-length"));
  if (anunciado > maxBytes) {
    await request.body?.cancel().catch(() => undefined);
    throw new CuerpoDemasiadoGrande();
  }
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const cuerpo = new Uint8Array(maxBytes);
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (total + value.byteLength > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new CuerpoDemasiadoGrande();
      }
      cuerpo.set(value, total);
      total += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  return cuerpo.slice(0, total);
}
