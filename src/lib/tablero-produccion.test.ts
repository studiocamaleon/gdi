import { describe, expect, it } from "vitest";

import { resolverEstacionDePaso } from "@/lib/tablero-produccion";

type Est = {
  id: string;
  activo: boolean;
  familias: string[];
  maquinas: Array<{ id?: string | null; centroCostoId: string | null }>;
  reglas?: Array<{ tipo: string; valor: string }>;
};

function est(id: string, over: Partial<Est> = {}): Est {
  return {
    id,
    activo: true,
    familias: [],
    maquinas: [],
    ...over,
  };
}

type Paso = {
  familiaCodigo: string;
  centroCostoId: string | null;
  maquinaId?: string | null;
  tecnologia?: string | null;
};

function paso(over: Partial<Paso> = {}): Paso {
  return { familiaCodigo: "impresion", centroCostoId: null, ...over };
}

describe("resolverEstacionDePaso — fallback legacy (neutral)", () => {
  it("única candidata por familia, paso sin centro → la devuelve", () => {
    const e = est("A", { familias: ["impresion"] });
    expect(resolverEstacionDePaso([e], paso())?.id).toBe("A");
  });

  it("familia + centro: gana la estación cuya máquina tiene ese centro", () => {
    const a = est("A", {
      familias: ["impresion"],
      maquinas: [{ centroCostoId: "c1" }],
    });
    const b = est("B", {
      familias: ["impresion"],
      maquinas: [{ centroCostoId: "c2" }],
    });
    const r = resolverEstacionDePaso([a, b], paso({ centroCostoId: "c2" }));
    expect(r?.id).toBe("B");
  });

  it("sin match de centro → gana la general (con familia, sin máquinas)", () => {
    const conMaq = est("A", {
      familias: ["impresion"],
      maquinas: [{ centroCostoId: "c1" }],
    });
    const general = est("G", { familias: ["impresion"] });
    const r = resolverEstacionDePaso(
      [conMaq, general],
      paso({ centroCostoId: "cX" }),
    );
    expect(r?.id).toBe("G");
  });

  it("sin familia que matchee → null", () => {
    const e = est("A", { familias: ["corte"] });
    expect(resolverEstacionDePaso([e], paso())).toBeNull();
  });

  it("dos candidatas con máquinas, sin centro-match ni general → null", () => {
    const a = est("A", { familias: ["impresion"], maquinas: [{ centroCostoId: "c1" }] });
    const b = est("B", { familias: ["impresion"], maquinas: [{ centroCostoId: "c2" }] });
    expect(resolverEstacionDePaso([a, b], paso({ centroCostoId: "cX" }))).toBeNull();
  });
});

describe("resolverEstacionDePaso — reglas nuevas", () => {
  it("por MÁQUINA (id): rutea sin depender de la familia", () => {
    const uv = est("UV", { maquinas: [{ id: "m-uv", centroCostoId: "c1" }] });
    const eco = est("ECO", { maquinas: [{ id: "m-eco", centroCostoId: "c2" }] });
    const r = resolverEstacionDePaso(
      [uv, eco],
      paso({ maquinaId: "m-eco" }),
    );
    expect(r?.id).toBe("ECO");
  });

  it("dos digitales misma tecnología, distinta máquina → cada una a su estación", () => {
    const prod = est("PROD", { maquinas: [{ id: "laser-A", centroCostoId: "c" }] });
    const copia = est("COPIA", { maquinas: [{ id: "laser-B", centroCostoId: "c" }] });
    // Mismo centro 'c' compartido: el centro NO alcanza, la máquina sí.
    expect(resolverEstacionDePaso([prod, copia], paso({ maquinaId: "laser-A", centroCostoId: "c" }))?.id).toBe("PROD");
    expect(resolverEstacionDePaso([prod, copia], paso({ maquinaId: "laser-B", centroCostoId: "c" }))?.id).toBe("COPIA");
  });

  it("por TECNOLOGÍA (regla)", () => {
    const uv = est("UV", { reglas: [{ tipo: "tecnologia", valor: "uv" }] });
    const r = resolverEstacionDePaso([uv], paso({ tecnologia: "uv" }));
    expect(r?.id).toBe("UV");
  });

  it("por PASO concreto: separa dos pasos de la misma familia", () => {
    const a = est("A", { reglas: [{ tipo: "paso", valor: "acabado_x" }] });
    const b = est("B", { reglas: [{ tipo: "paso", valor: "acabado_y" }] });
    expect(resolverEstacionDePaso([a, b], paso({ familiaCodigo: "acabado_y" }))?.id).toBe("B");
  });
});

describe("resolverEstacionDePaso — prioridad", () => {
  it("máquina gana a tecnología", () => {
    const porMaq = est("MAQ", { maquinas: [{ id: "m1", centroCostoId: "c" }] });
    const porTec = est("TEC", { reglas: [{ tipo: "tecnologia", valor: "uv" }] });
    const r = resolverEstacionDePaso(
      [porTec, porMaq],
      paso({ maquinaId: "m1", tecnologia: "uv" }),
    );
    expect(r?.id).toBe("MAQ");
  });

  it("tecnología gana a paso concreto", () => {
    const porTec = est("TEC", { reglas: [{ tipo: "tecnologia", valor: "uv" }] });
    const porPaso = est("PASO", { reglas: [{ tipo: "paso", valor: "impresion" }] });
    const r = resolverEstacionDePaso(
      [porPaso, porTec],
      paso({ tecnologia: "uv", familiaCodigo: "impresion" }),
    );
    expect(r?.id).toBe("TEC");
  });

  it("regla nueva gana al fallback por familia", () => {
    const porFamilia = est("FAM", { familias: ["impresion"] });
    const porTec = est("TEC", { reglas: [{ tipo: "tecnologia", valor: "uv" }] });
    const r = resolverEstacionDePaso(
      [porFamilia, porTec],
      paso({ familiaCodigo: "impresion", tecnologia: "uv" }),
    );
    expect(r?.id).toBe("TEC");
  });
});
