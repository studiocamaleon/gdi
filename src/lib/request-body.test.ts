import { expect, it, vi } from "vitest";
import { CuerpoDemasiadoGrande, leerCuerpoLimitado } from "./request-body";

function solicitud(partes: number[], cancelar = vi.fn()) {
  let entregadas = 0;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (!partes.length) {
          controller.close();
          return;
        }
        entregadas += 1;
        controller.enqueue(new Uint8Array(partes.shift()!).fill(65));
      },
      cancel: cancelar,
    },
    { highWaterMark: 0 },
  );
  return {
    request: new Request("http://localhost/api", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit),
    entregadas: () => entregadas,
  };
}

it("acepta un cuerpo dividido en fragmentos que llega exactamente al límite", async () => {
  const { request } = solicitud([2, 0, 3, 3]);
  expect(new TextDecoder().decode(await leerCuerpoLimitado(request, 8))).toBe(
    "AAAAAAAA",
  );
});

it("corta y cancela el flujo al superar el límite sin leer lo que sigue", async () => {
  const cancelar = vi.fn();
  const { request, entregadas } = solicitud([8, 1, 1000], cancelar);
  await expect(leerCuerpoLimitado(request, 8)).rejects.toBeInstanceOf(
    CuerpoDemasiadoGrande,
  );
  expect(cancelar).toHaveBeenCalledOnce();
  expect(entregadas()).toBe(2);
});
