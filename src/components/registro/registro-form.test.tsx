import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PlanRegistro } from "@/lib/registro-api";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("plan=print&utm_source=web"),
}));
vi.mock("@/lib/registro-api", () => ({ iniciarRegistro: vi.fn() }));
import { RegistroForm } from "./registro-form";

const planes: PlanRegistro[] = [
  {
    codigo: "taller",
    nombre: "Taller",
    descripcion: "Impresión",
    precioMensual: 219,
    moneda: "USD",
    trialDias: 14,
    registroPublico: true,
    recomendado: false,
    precioAConsultar: false,
    features: { usuariosMax: 6 },
  },
  {
    codigo: "estudio",
    nombre: "Producción",
    descripcion: "Cartelería",
    precioMensual: 329,
    moneda: "USD",
    trialDias: 14,
    registroPublico: true,
    recomendado: true,
    precioAConsultar: false,
    features: { usuariosMax: 15 },
  },
  {
    codigo: "diamante",
    nombre: "Enterprise",
    descripcion: "Industrial",
    precioMensual: null,
    moneda: "USD",
    trialDias: null,
    registroPublico: false,
    recomendado: false,
    precioAConsultar: true,
    features: {},
  },
];

describe("Formulario de registro con el catálogo real", () => {
  it("usa importes de la API, códigos estables y una consulta para Industrial", () => {
    const html = renderToStaticMarkup(<RegistroForm planes={planes} />);
    expect(html).toContain('aria-label="Plan Print"');
    expect(html).toContain('aria-label="Plan Sign"');
    expect(html).toContain('value="taller"');
    expect(html).toContain(">219<");
    expect(html).toContain(">329<");
    expect(html).not.toContain(">190<");
    expect(html).not.toContain('value="diamante"');
    expect(html).toContain(
      "mailto:soporte@grafoprint.com.ar?subject=Plan%20Industrial",
    );
    expect(html).not.toContain("−20%");
  });
  it("conserva campos, consentimiento explícito y botón bloqueado antes de completar", () => {
    const html = renderToStaticMarkup(<RegistroForm planes={planes} />);
    for (const name of [
      "nombreCompleto",
      "empresaNombre",
      "email",
      "password",
      "paisCodigo",
      "aceptaTerminos",
    ])
      expect(html).toContain(`name="${name}"`);
    expect(html).toContain('minLength="10"');
    expect(html).toContain('maxLength="72"');
    expect(html).toMatch(/type="submit"[^>]*disabled=""/);
    expect(html).not.toMatch(/type="checkbox"[^>]*checked/);
  });
});
