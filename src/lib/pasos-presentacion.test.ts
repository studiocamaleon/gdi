import { describe, expect, it } from "vitest";

import { descripcionPasoParaUsuario } from "@/lib/pasos-presentacion";

describe("descripcionPasoParaUsuario", () => {
  it("oculta referencias internas y traduce códigos técnicos", () => {
    const resultado = descripcionPasoParaUsuario(
      "Usa M-1 y permite T-4. Ver docs/editor-interno.md §15. HEREDAN outputs previos.",
    );

    expect(resultado).toContain("una máquina");
    expect(resultado).toContain("tiempo cargado al cotizar");
    expect(resultado).toContain("heredan resultados");
    expect(resultado).not.toContain("docs/");
    expect(resultado).not.toContain("M-1");
  });
});
