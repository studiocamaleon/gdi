import { afterEach, expect, it, vi } from "vitest";
import { cargarArchivoInbox } from "./inbox-archivo-temporal";
const archivo = {
  url: "https://files.example.invalid/file",
  mimeType: "application/pdf",
  nombre: "Prueba.pdf",
  bytes: 4,
  expiraEn: 60,
};
const response = (body = "%PDF", type = "application/pdf") =>
  new Response(body, { headers: { "content-type": type } });
afterEach(() => vi.unstubAllGlobals());
it("renueva una firma caducada automáticamente una sola vez", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
    .mockResolvedValueOnce(response());
  vi.stubGlobal("fetch", fetch);
  const abrir = vi
    .fn()
    .mockResolvedValueOnce(archivo)
    .mockResolvedValueOnce({ ...archivo, url: `${archivo.url}?nueva` });
  const progreso = vi.fn();
  const r = await cargarArchivoInbox(
    "mensaje",
    abrir,
    new AbortController().signal,
    progreso,
  );
  expect(await r.blob.text()).toBe("%PDF");
  expect(progreso).toHaveBeenLastCalledWith(100);
  expect(abrir).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith(
    `${archivo.url}?nueva`,
    expect.objectContaining({
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    }),
  );
});
it("no entra en un bucle si el archivo sigue inaccesible", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    cargarArchivoInbox(
      "m",
      vi.fn().mockResolvedValue(archivo),
      new AbortController().signal,
    ),
  ).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(2);
});
it.each([
  ["%P", "application/pdf"],
  ["%PDFextra", "application/pdf"],
  ["%PDF", "text/html"],
])(
  "rechaza bytes incompletos, excesivos o formato ajeno (%s, %s)",
  async (body, mime) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(body, mime)));
    await expect(
      cargarArchivoInbox(
        "m",
        vi.fn().mockResolvedValue(archivo),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  },
);
it.each([0, -1, 100_000_001, NaN])(
  "rechaza el tamaño %s antes de descargar",
  async (bytes) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      cargarArchivoInbox(
        "m",
        vi.fn().mockResolvedValue({ ...archivo, bytes }),
        new AbortController().signal,
      ),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  },
);
it("no descarga después de cerrar mientras esperaba autorización", async () => {
  const c = new AbortController(),
    fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const abrir = vi.fn().mockImplementation(async () => {
    c.abort();
    return archivo;
  });
  await expect(cargarArchivoInbox("m", abrir, c.signal)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("no sustituye un PDF por una imagen aunque ambos formatos estén admitidos", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    cargarArchivoInbox(
      "m",
      vi.fn().mockResolvedValue({ ...archivo, mimeType: "image/png" }),
      new AbortController().signal,
      undefined,
      "application/pdf",
    ),
  ).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
