// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { InboxAdjunto } from "./inbox-adjunto";
import type { AbrirAdjuntoInbox } from "@/lib/meta-inbox-api";
let root: Root, container: HTMLDivElement;
let visible: (value: boolean) => void;
let abrir: ReturnType<typeof vi.fn<AbrirAdjuntoInbox>>;
const render = async (mime = "audio/ogg", tipo = "audio") => {
  abrir.mockResolvedValue({
    url: "https://files.example.invalid/media",
    nombre: "Muestra",
    mimeType: mime,
    bytes: 4,
    expiraEn: 60,
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockImplementation(
        async () => new Response("data", { headers: { "content-type": mime } }),
      ),
  );
  await act(async () =>
    root.render(
      <InboxAdjunto
        mensajeId="medio"
        tipo={tipo}
        adjunto={{
          estado: "LISTO",
          nombre: "Muestra",
          mimeType: mime,
          bytes: 4,
          version: "1",
        }}
        abrir={abrir}
      />,
    ),
  );
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        visible = (value) =>
          callback(
            [
              {
                isIntersecting: value,
                boundingClientRect: { height: 180 },
              } as IntersectionObserverEntry,
            ],
            this as unknown as IntersectionObserver,
          );
      }
      observe() {}
      disconnect() {}
    },
  );
  URL.createObjectURL = vi.fn().mockReturnValue("blob:medio");
  URL.revokeObjectURL = vi.fn();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  abrir = vi.fn<AbrirAdjuntoInbox>();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([
  ["audio/aac", "audio"],
  ["audio/amr", "audio"],
  ["audio/mpeg", "audio"],
  ["audio/mp4", "audio"],
  ["audio/ogg", "audio"],
  ["video/mp4", "video"],
  ["video/3gpp", "video"],
  ["image/jpeg", "img"],
  ["image/png", "img"],
  ["image/webp", "img"],
])(
  "ofrece controles para %s incluso si llegó como documento",
  async (mime, tag) => {
    await render(mime, "document");
    expect(abrir).not.toHaveBeenCalled();
    await act(async () => visible(true));
    const element = container.querySelector(tag);
    expect(element?.getAttribute("src")).toBe("blob:medio");
    if (tag !== "img") {
      if (tag === "audio")
        expect(
          container.querySelector('[aria-label="Reproducir audio"]'),
        ).not.toBeNull();
      else expect(element?.hasAttribute("controls")).toBe(true);
      expect(element?.hasAttribute("autoplay")).toBe(false);
    }
    if (tag === "audio" || tag === "video") {
      expect(container.querySelector("a[download]")).toBeNull();
      const menu = container.querySelector<HTMLButtonElement>(
        `[aria-label="Opciones del ${tag === "audio" ? "audio" : "video"}"]`,
      )!;
      expect(menu).not.toBeNull();
    } else expect(container.querySelector("a")?.download).toBe("Muestra");
  },
);
it("no descarga fuera de la vista y libera la copia al salir", async () => {
  await render();
  expect(abrir).not.toHaveBeenCalled();
  await act(async () => visible(true));
  expect(abrir).toHaveBeenCalledOnce();
  await act(async () => visible(false));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:medio");
  expect(container.querySelector("audio")).toBeNull();
});
it("conserva el audio que se está escuchando aunque se desplace la conversación", async () => {
  await render();
  await act(async () => visible(true));
  const audio = container.querySelector("audio")!;
  await act(async () => audio.dispatchEvent(new Event("play")));
  await act(async () => visible(false));
  expect(container.querySelector("audio")).toBe(audio);
  await act(async () => audio.dispatchEvent(new Event("pause")));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:medio");
});
it("explica códecs incompatibles y conserva la descarga", async () => {
  await render("audio/amr");
  await act(async () => visible(true));
  await act(async () =>
    container.querySelector("audio")!.dispatchEvent(new Event("error")),
  );
  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Este navegador",
  );
  expect(
    container.querySelector('[aria-label="Opciones del audio"]'),
  ).not.toBeNull();
});
it("presenta el sticker suelto, sin tarjeta, nombre ni descarga permanente", async () => {
  await render("image/webp", "sticker");
  await act(async () => visible(true));
  expect(container.querySelector("img")?.alt).toBe("Sticker");
  expect(container.querySelector("img")?.getAttribute("src")).toBe(
    "blob:medio",
  );
  expect(container.querySelector("a")).toBeNull();
  expect(container.textContent).not.toContain("Muestra");
  expect(container.querySelector('[aria-label="Archivo privado"]')).toBeNull();
});

it("el audio no tiene tarjeta ni nombre visible y permite avanzar y cambiar velocidad", async () => {
  await render();
  await act(async () => visible(true));
  const audio = container.querySelector("audio")!;
  await act(async () => {
    Object.defineProperty(audio, "duration", {
      value: 125,
      configurable: true,
    });
    audio.dispatchEvent(new Event("loadedmetadata"));
  });
  expect(container.textContent).not.toContain("Muestra");
  expect(container.querySelector('[aria-label="Archivo privado"]')).toBeNull();
  expect(container.textContent).toContain("2:05");
  await act(async () =>
    container
      .querySelector<HTMLButtonElement>('[title="Cambiar velocidad"]')!
      .click(),
  );
  expect(audio.playbackRate).toBe(1.5);
  expect(
    container.querySelector("input[type=range]")?.getAttribute("max"),
  ).toBe("125");
});
