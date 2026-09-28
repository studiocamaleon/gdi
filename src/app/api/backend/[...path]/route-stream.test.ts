import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gdi_access_token" ? { value: "token-sintetico" } : undefined,
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("transmite SSE por BFF sin acumular el cuerpo ni exponer la credencial y propaga cancelación", async () => {
  vi.stubEnv("STAGING_PRIVATE", "false");
  vi.stubEnv("API_URL", "http://127.0.0.1:3001/api");
  const cancelar = vi.fn();
  let publicar!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start: (c) => {
      publicar = c;
    },
    cancel: cancelar,
  });
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(stream, {
        headers: { "content-type": "text/event-stream" },
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  const abortar = new AbortController();
  const request = new Request(
    "http://localhost:3000/api/backend/integraciones/meta/inbox/stream",
    {
      signal: abortar.signal,
      headers: { accept: "text/event-stream", "last-event-id": "4" },
    },
  );
  const response = await GET(request, {
    params: Promise.resolve({
      path: ["integraciones", "meta", "inbox", "stream"],
    }),
  });
  expect(response.headers.get("cache-control")).toBe(
    "private, no-store, no-transform",
  );
  expect(response.headers.get("x-accel-buffering")).toBe("no");
  expect(response.headers.get("authorization")).toBeNull();
  const opciones = fetcher.mock.calls[0][1]!;
  expect(opciones.signal).toBe(request.signal);
  expect(new Headers(opciones.headers).get("authorization")).toBe(
    "Bearer token-sintetico",
  );
  expect(new Headers(opciones.headers).get("last-event-id")).toBe("4");
  const reader = response.body!.getReader();
  publicar.enqueue(
    new TextEncoder().encode('event: ready\ndata: {"revision":"5"}\n\n'),
  );
  expect(new TextDecoder().decode((await reader.read()).value)).toContain(
    "event: ready",
  );
  abortar.abort();
  expect(opciones.signal?.aborted).toBe(true);
  await reader.cancel();
  expect(cancelar).toHaveBeenCalledOnce();
});
