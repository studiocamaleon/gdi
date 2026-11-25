// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { parseSvg, physicalHeight } from "../src/core/source";
import { newProject } from "../src/core/project";
import { parseProject } from "../src/core/storage";
import { LightboxEditor } from "../src/components/LightboxEditor";
import { ArtworkPreview } from "../src/components/ArtworkPreview";
import { artworkBlob, readArtwork } from "../src/core/artwork";

afterEach(() => vi.unstubAllGlobals());

const rect = '<rect width="10" height="10"/>';
const wrap = (content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" height="10mm" viewBox="0 0 10 10">${content}${rect}</svg>`;
describe("SVG no confiable", () => {
  it.each([
    '<animate attributeName="href" values="javascript:alert(1)"/>',
    '<set attributeName="onload" to="alert(1)"/>',
    '<g style="fill:url(https://example.invalid/recurso)"/>',
    '<g filter="url(https://example.invalid/filtro)"/>',
    '<style>@import "https://example.invalid/externo.css";</style>',
    '<script xmlns="http://www.w3.org/1999/xhtml">alert(1)</script>',
  ])("rechaza contenido activo o recursos externos: %s", (payload) => {
    expect(() => parseSvg(wrap(payload))).toThrow();
  });
  it("valida el documento también cuando se proporcionan contornos calculados", () => {
    const shapes = parseSvg(wrap(""));
    expect(() =>
      physicalHeight(wrap("<script>alert(1)</script>"), shapes),
    ).toThrow();
    expect(() => physicalHeight("<!DOCTYPE svg>" + wrap(""), shapes)).toThrow();
  });
  it("conserva transformaciones, estilo de relleno y dimensiones", () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" height="20mm" viewBox="0 0 20 20"><g transform="translate(2 3)"><rect width="10" height="5" style="fill:#000;stroke:none"/></g></svg>';
    expect(physicalHeight(svg)).toBeCloseTo(5);
    expect(parseSvg(svg)[0][0]).toContainEqual([2, -3]);
  });
  it("conserva rellenos con degradados internos", () => {
    const svg = wrap(
      '<defs><linearGradient id="grad"><stop stop-color="#000"/></linearGradient></defs><rect width="3" height="4" fill="url(#grad)"/>',
    );
    expect(parseSvg(svg)).toHaveLength(2);
  });
});
describe("Gráficas de banderola", () => {
  it.each([
    "https://example.invalid/seguimiento.png",
    "javascript:alert(1)",
    'data:image/svg+xml,<svg onload="alert(1)"/>',
  ])("no asigna una URL arbitraria al visor: %s", (source) => {
    const project = newProject();
    project.faceArtwork = { a: source, b: "" };
    const html = renderToStaticMarkup(
      <LightboxEditor
        project={project}
        onChange={() => {}}
        component="faceA"
        onComponentChange={() => {}}
        isolated={false}
        onIsolatedChange={() => {}}
        section={false}
        onSectionChange={() => {}}
      />,
    );
    expect(html.includes("<img")).toBe(false);
  });
  it("rechaza SVG disfrazado de PNG al abrir un proyecto", () => {
    const project = newProject();
    project.faceArtwork = {
      a: "data:image/png;base64," + btoa('<svg onload="alert(1)"/>'),
      b: "",
    };
    expect(() => parseProject(project)).toThrow();
  });
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJz8AAAAASUVORK5CYII=";
  it("acepta una carga raster y rechaza MIME falsificado, base64 inválido y exceso de tamaño", async () => {
    const bytes = Uint8Array.from(atob(png.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
    expect(
      await readArtwork(new File([bytes], "imagen.png", { type: "image/png" })),
    ).toBe(png);
    await expect(
      readArtwork(new File(["<svg/>"], "imagen.png", { type: "image/png" })),
    ).rejects.toThrow();
    await expect(
      readArtwork(
        new File([new Uint8Array(2_000_001)], "grande.png", {
          type: "image/png",
        }),
      ),
    ).rejects.toThrow();
    expect(() => artworkBlob("data:image/png;base64,A===")).toThrow();
    expect(() => artworkBlob(png.replace("image/png", "image/jpeg"))).toThrow();
    const project = newProject();
    project.faceArtwork = { a: png, b: "" };
    expect(parseProject(project).faceArtwork?.a).toBe(png);
  });
  it("muestra únicamente blobs raster propios y libera su URL al cambiar o desmontar", async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const createObjectURL = vi.fn(
      (_blob: Blob) => "blob:https://example.invalid/local",
    );
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      await act(async () =>
        root.render(<ArtworkPreview source={png} alt="Gráfica A" />),
      );
      expect(container.querySelector("img")?.getAttribute("src")).toBe(
        "blob:https://example.invalid/local",
      );
      expect(createObjectURL.mock.calls[0][0].type).toBe("image/png");
      await act(async () =>
        root.render(
          <ArtworkPreview
            source="https://example.invalid/external.png"
            alt="Gráfica A"
          />,
        ),
      );
      expect(container.querySelector("img")).toBeNull();
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      await act(async () =>
        root.render(<ArtworkPreview source={png} alt="Gráfica A" />),
      );
    } finally {
      await act(async () => root.unmount());
    }
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});
