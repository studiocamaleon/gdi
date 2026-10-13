// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CentroCopiadoTarifarios } from "./centro-copiado-tarifarios";
import { CentroCopiadoCanales } from "./centro-copiado-tarifarios-canales";
import { configTarifarios } from "@/lib/__fixtures__/tarifarios";
import {
  contenidoInicial,
  filasOferta,
} from "@/lib/centro-copiado-tarifarios-editor";
import * as api from "@/lib/centro-copiado-tarifarios-api";
vi.mock("@/lib/centro-copiado-tarifarios-api", () => ({
  listarTarifarios: vi.fn(),
  simularCeldasTarifario: vi.fn(),
  obtenerTarifario: vi.fn(),
  guardarTarifario: vi.fn(),
  versionesTarifario: vi.fn(),
  vigenteTarifario: vi.fn(),
  publicarTarifario: vi.fn(),
  leerVersionTarifario: vi.fn(),
  catalogoCadTarifarios: vi.fn(),
  previsualizarCanales: vi.fn(),
  guardarPoliticaTarifarios: vi.fn(),
}));
// jsdom no tiene geometría de popovers. Se conserva el formulario real y se
// sustituye sólo el selector; Base UI se comprueba también en el navegador local.
vi.mock("./centro-copiado-tarifarios-controles", async (original) => ({
  ...(await original<object>()),
  Elegir: ({
    etiqueta,
    valor,
    opciones,
    onChange,
    disabled,
  }: {
    etiqueta: string;
    valor: string;
    opciones: { value: string; label: string }[];
    onChange: (v: string) => void;
    disabled?: boolean;
  }) => (
    <div>
      <label htmlFor={`select-${etiqueta}`}>{etiqueta}</label>
      <select
        id={`select-${etiqueta}`}
        value={valor}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {opciones.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
let root: Root;
let el: HTMLDivElement;
const id = "00000000-0000-4000-8000-000000000010";
function borrador(): api.BorradorTarifario {
  const contenido = contenidoInicial("ARS");
  contenido.hojas!.filas = filasOferta(
    configTarifarios,
    contenido.hojas!,
  ).slice(0, 2);
  return {
    id,
    nombre: "Mostrador de prueba",
    revision: 4,
    ultimoNumero: 0,
    contenido,
  };
}
function politica(): api.BorradorPolitica {
  return {
    estado: "BORRADOR",
    operativa: false,
    revision: 1,
    actualizadoEl: null,
    contenido: {
      esquema: 1,
      general: { modalidad: "MOTOR" },
      canales: {
        mostrador: { modalidad: "HEREDAR" },
        whatsapp: { modalidad: "HEREDAR" },
        email: { modalidad: "HEREDAR" },
        web: { modalidad: "HEREDAR" },
        app_movil: { modalidad: "HEREDAR" },
      },
    },
  };
}
function vista(b = politica()): api.VistaCanales {
  return {
    borrador: b,
    monedaCodigo: "ARS",
    evaluadoEl: "2026-10-10T12:00:00Z",
    canales: (Object.keys(b.contenido.canales) as api.CanalCopiado[]).map(
      (canalVenta) => ({ canalVenta, origen: "GENERAL", estado: "MOTOR" }),
    ),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(globalThis, {
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  });
  vi.mocked(api.listarTarifarios).mockResolvedValue([borrador()]);
  vi.mocked(api.obtenerTarifario).mockResolvedValue(borrador());
  vi.mocked(api.versionesTarifario).mockResolvedValue([]);
  vi.mocked(api.vigenteTarifario).mockResolvedValue({ version: null });
  vi.mocked(api.catalogoCadTarifarios).mockResolvedValue({ perfiles: [] });
  vi.mocked(api.previsualizarCanales).mockResolvedValue(vista());
  vi.mocked(api.guardarTarifario).mockImplementation(async (_id, datos) => ({
    ...borrador(),
    ...datos,
    revision: (datos.revision ?? 0) + 1,
  }));
  vi.mocked(api.guardarPoliticaTarifarios).mockImplementation(
    async (revision, contenido) => ({
      ...politica(),
      revision: revision + 1,
      contenido,
    }),
  );
  el = document.createElement("div");
  document.body.appendChild(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
const boton = (texto: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.trim() === texto,
  )!;
const entrada = (label: string) => {
  const etiqueta = [...document.querySelectorAll("label")].find(
    (l) => l.textContent === label,
  )!;
  return document.getElementById(etiqueta.htmlFor) as HTMLInputElement;
};
async function escribir(input: HTMLInputElement, valor: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function click(texto: string) {
  const b =
    boton(texto) ??
    [
      ...document.querySelectorAll<HTMLElement>('[role="tab"], [role="radio"]'),
    ].find(
      (t) =>
        t.textContent === texto ||
        t.getAttribute("aria-label") === texto ||
        t.getAttribute("aria-label")?.startsWith(`${texto} `) ||
        t.textContent?.startsWith(`${texto} · `),
    );
  expect(b, `Botón ${texto}`).toBeTruthy();
  await act(async () => b.click());
}
async function elegir(label: string, valor: string) {
  const campo = entrada(label) as unknown as HTMLSelectElement;
  const opcion = [...campo.options].find((o) => o.textContent === valor)!;
  expect(opcion, `Opción ${valor}`).toBeTruthy();
  await act(async () => {
    campo.value = opcion.value;
    campo.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
const renderEditor = (
  puedeGestionar = true,
  cfg = configTarifarios,
  ofertaSinGuardar = false,
) =>
  act(async () =>
    root.render(
      <CentroCopiadoTarifarios
        cfg={cfg}
        puedeGestionar={puedeGestionar}
        permiteCad={false}
        ofertaSinGuardar={ofertaSinGuardar}
        onGuardado={() => {}}
      />,
    ),
  );
const precio = (desde: number, faz = "Simple faz") =>
  [
    ...el.querySelectorAll<HTMLInputElement>('input[placeholder="Pendiente"]'),
  ].find(
    (i) =>
      i.getAttribute("aria-label") ===
      `Obra de prueba · 80 g · A4 · K · ${faz}, desde ${desde}, precio por hoja`,
  )!;
async function abrir() {
  await renderEditor();
  await elegir("Tarifario a editar", "Mostrador de prueba");
}
it("crea con precios exactos: celda vacía pendiente y cero gratuito", async () => {
  await renderEditor();
  await click("Nuevo tarifario");
  await escribir(entrada("Nombre del tarifario"), "Web ficticia");
  await click("Agregar combinaciones de la oferta");
  await click("Blanco y negro · K");
  await escribir(precio(1), "999999999999999999,12345678");
  await escribir(precio(100), "0");
  await click("Guardar borrador");
  expect(api.guardarTarifario).toHaveBeenCalledWith(
    null,
    expect.objectContaining({ nombre: "Web ficticia" }),
  );
  const c = vi.mocked(api.guardarTarifario).mock.calls[0][1].contenido;
  expect(c.hojas!.filas[0].precios.map((p) => p.precioUnitario)).toEqual([
    "999999999999999999.12345678",
    "0",
    null,
  ]);
  expect(boton("Guardar borrador").disabled).toBe(true);
});
it("conserva cambios ante conflicto y no permite publicar el borrador sucio", async () => {
  await abrir();
  await escribir(entrada("Nombre del tarifario"), "Mis cambios");
  vi.mocked(api.guardarTarifario).mockRejectedValue(
    Object.assign(new Error("conflicto"), { status: 409 }),
  );
  await click("Guardar borrador");
  expect(entrada("Nombre del tarifario").value).toBe("Mis cambios");
  expect(el.textContent).toContain("Otra sesión");
  expect(boton("Publicar versión").disabled).toBe(true);
  expect(api.guardarTarifario).toHaveBeenCalledWith(
    id,
    expect.objectContaining({ revision: 4 }),
  );
});
it("advierte antes de abandonar un tarifario con cambios", async () => {
  await abrir();
  await escribir(entrada("Nombre del tarifario"), "Pendiente");
  await click("Nuevo tarifario");
  expect(document.body.textContent).toContain("Cambios sin guardar");
  await click("Seguir editando");
  expect(entrada("Nombre del tarifario").value).toBe("Pendiente");
});
it("el lector puede consultar pero no editar ni publicar", async () => {
  await renderEditor(false);
  await elegir("Tarifario a editar", "Mostrador de prueba");
  expect(entrada("Nombre del tarifario").disabled).toBe(true);
  expect(boton("Guardar borrador")).toBeUndefined();
  expect(boton("Publicar versión")).toBeUndefined();
  expect(boton("Actualizar combinaciones").disabled).toBe(true);
  expect(api.guardarTarifario).not.toHaveBeenCalled();
});
it("publica la revisión guardada y recarga la revisión posterior", async () => {
  await abrir();
  const b = borrador();
  const v: api.VersionTarifario = {
    id: "version-ficticia",
    tarifarioId: id,
    numero: 1,
    revisionBorrador: 4,
    nombre: b.nombre,
    contenido: b.contenido,
    tipoVigencia: "INMEDIATA",
    vigenteDesde: "2026-10-10T12:00:00Z",
    publicadoEl: "2026-10-10T12:00:00Z",
  };
  vi.mocked(api.publicarTarifario).mockResolvedValue(v);
  vi.mocked(api.obtenerTarifario).mockResolvedValue({
    ...b,
    revision: 5,
    ultimoNumero: 1,
  });
  vi.mocked(api.versionesTarifario).mockResolvedValue([v]);
  vi.mocked(api.vigenteTarifario).mockResolvedValue({ version: v });
  await click("Publicar versión");
  expect(document.body.textContent).toContain("6 precios pendientes");
  await click("Confirmar publicación");
  expect(api.publicarTarifario).toHaveBeenCalledWith(id, {
    revision: 4,
    tipoVigencia: "INMEDIATA",
  });
  await escribir(entrada("Nombre del tarifario"), "Renombrado");
  await click("Guardar borrador");
  expect(api.guardarTarifario).toHaveBeenLastCalledWith(
    id,
    expect.objectContaining({ revision: 5 }),
  );
});
it("aplica sugerencias en Alta, guarda y publica; al reabrir muestra esos precios sin completar otras coberturas", async () => {
  let guardado = borrador();
  const m = guardado.contenido.hojas!;
  m.reglas.cobertura = "DIFERENCIADA";
  m.filas = filasOferta(configTarifarios, m).filter(
    (f) =>
      f.combinacion.tamano === "A4" &&
      f.combinacion.gramaje === 80 &&
      f.combinacion.faz === 1,
  );
  let publicada: api.VersionTarifario | null = null;
  vi.mocked(api.obtenerTarifario).mockImplementation(async () =>
    structuredClone(guardado),
  );
  vi.mocked(api.guardarTarifario).mockImplementation(async (_id, datos) => {
    guardado = structuredClone({
      ...guardado,
      ...datos,
      revision: guardado.revision + 1,
    });
    return structuredClone(guardado);
  });
  vi.mocked(api.publicarTarifario).mockImplementation(async () => {
    publicada = {
      id: "version-ficticia",
      tarifarioId: id,
      numero: 1,
      revisionBorrador: guardado.revision,
      nombre: guardado.nombre,
      contenido: structuredClone(guardado.contenido),
      tipoVigencia: "INMEDIATA",
      vigenteDesde: "2026-10-12T12:00:00Z",
      publicadoEl: "2026-10-12T12:00:00Z",
    };
    guardado = {
      ...guardado,
      revision: guardado.revision + 1,
      ultimoNumero: 1,
    };
    return structuredClone(publicada);
  });
  vi.mocked(api.versionesTarifario).mockImplementation(async () =>
    publicada ? [structuredClone(publicada)] : [],
  );
  vi.mocked(api.vigenteTarifario).mockImplementation(async () => ({
    version: structuredClone(publicada),
  }));
  vi.mocked(api.simularCeldasTarifario).mockImplementation(
    async (_id, solicitud) => ({
      resultados: solicitud.celdas.map((celda) => {
        const f = guardado.contenido.hojas!.filas[celda.fila];
        const cantidad = String(
          guardado.contenido.hojas!.rangosGenerales[celda.tramo],
        );
        return {
          celda,
          escenarios: [
            {
              estado: "CALCULADO",
              cobertura: f.combinacion.cobertura!,
              calculadoEl: "2026-10-12T12:00:00Z",
              costoTotal: String(700 * Number(cantidad)),
              costoUnitario: "700",
              cantidadReferencia: cantidad,
              cantidadFacturable: cantidad,
              unidad: "HOJA",
              referencia: "Pedido ficticio",
              grupos: [
                {
                  fila: celda.fila,
                  desdeCantidad: cantidad,
                  cantidadFacturable: cantidad,
                },
              ],
              ivaPorcentaje: "21",
              decimalesPrecio: 2,
              trazas: [],
              avisos: [],
              comercial: {
                cargas: [],
                ventaMotorNeta: null,
                metodosMotor: [],
                motivo: null,
              },
            },
          ],
        };
      }),
    }),
  );
  const valoresVisibles = () =>
    [
      ...el.querySelectorAll<HTMLInputElement>(
        'input[placeholder="Pendiente"]',
      ),
    ].map((i) => i.value);
  await abrir();
  await click("Alta");
  await click("Calcular precios con el motor");
  expect(el.textContent).toContain(
    "Sólo Color · cobertura Alta. 3 de 18 precios",
  );
  await click("Calcular 3 precios");
  await click("Revisar 3 precios");
  await click("Aplicar 3 precios al borrador");
  const preciosAplicados = valoresVisibles();
  expect(preciosAplicados).toHaveLength(3);
  expect(preciosAplicados.every((v) => Number(v) > 0)).toBe(true);
  await click("Guardar borrador");
  await click("Publicar versión");
  expect(document.body.textContent).toContain("15 precios pendientes");
  await click("Confirmar publicación");
  await act(async () => root.unmount());
  root = createRoot(el);
  await abrir();
  expect(
    el.querySelector(
      '[role="tab"][aria-selected="true"][aria-label="Color · CMYK 3"]',
    ),
  ).not.toBeNull();
  expect(valoresVisibles()).toEqual(preciosAplicados);
  expect(el.textContent).toContain("Alta · 3/3");
  await click("Normal");
  expect(valoresVisibles()).toEqual(["", "", ""]);
  expect(el.textContent).toContain("Esta vista no tiene precios cargados");
  await click("Ver precios cargados");
  expect(valoresVisibles()).toEqual(preciosAplicados);
  expect(api.guardarTarifario).toHaveBeenCalledTimes(1);
  expect(api.publicarTarifario).toHaveBeenCalledTimes(1);
});
it("si la publicación termina pero falla la lectura, bloquea otra escritura hasta recargar", async () => {
  await abrir();
  vi.mocked(api.publicarTarifario).mockResolvedValue({
    numero: 1,
    tipoVigencia: "INMEDIATA",
  } as api.VersionTarifario);
  vi.mocked(api.obtenerTarifario).mockRejectedValue(new Error("sin red"));
  await click("Publicar versión");
  await click("Confirmar publicación");
  expect(el.textContent).toContain("La versión se publicó");
  expect(boton("Publicar versión").disabled).toBe(true);
  expect(entrada("Nombre del tarifario").disabled).toBe(true);
});
it("cambiar a carilla requiere confirmar, reinicia precios y cambia la unidad de los tramos", async () => {
  await abrir();
  const input = el.querySelector<HTMLInputElement>(
    'input[placeholder="Pendiente"]',
  )!;
  await escribir(input, "120");
  await elegir("Unidad del precio de hojas", "Por carilla impresa");
  expect(document.body.textContent).toContain("Revisar cambio de regla");
  expect(input.value).toBe("120");
  await click("Confirmar cambio");
  expect(input.value).toBe("");
  expect(el.textContent).toContain("100–499 carillas");
});
it("editar rangos generales conserva inicios comunes y avisa al retirar precios", async () => {
  await abrir();
  await escribir(precio(100), "80");
  await click("Editar rangos generales");
  await escribir(entrada("Inicios de los tramos"), "1; 50; 500");
  await click("Aplicar rangos");
  expect(document.body.textContent).toContain("Se eliminarán 1 precios");
  await click("Confirmar");
  expect(el.textContent).toContain("50–499 hojas");
  await click("Guardar borrador");
  const c = vi.mocked(api.guardarTarifario).mock.calls[0][1].contenido;
  expect(c.hojas!.rangosGenerales).toEqual([1, 50, 500]);
  expect(
    c.hojas!.filas[0].precios.every((p) => p.precioUnitario === null),
  ).toBe(true);
});
it("permite editar la política general y excepciones sin mostrar una vista previa vieja", async () => {
  await act(async () =>
    root.render(
      <CentroCopiadoCanales puedeGestionar revisionTarifarios={0} activo />,
    ),
  );
  await elegir("Política general", "Mostrador de prueba");
  await elegir("Web", "Motor de cotización");
  expect(
    el.querySelectorAll('[aria-label="Precios resueltos por canal"] > li'),
  ).toHaveLength(0);
  expect(el.textContent).toContain("Guardá los cambios");
  await click("Guardar canales");
  expect(api.guardarPoliticaTarifarios).toHaveBeenCalledWith(1, {
    esquema: 1,
    general: { modalidad: "TARIFARIO", tarifarioId: id },
    canales: {
      mostrador: { modalidad: "HEREDAR" },
      whatsapp: { modalidad: "HEREDAR" },
      email: { modalidad: "HEREDAR" },
      web: { modalidad: "MOTOR" },
      app_movil: { modalidad: "HEREDAR" },
    },
  });
  expect(
    el.querySelectorAll('[aria-label="Precios resueltos por canal"] > li'),
  ).toHaveLength(0);
});
it("refrescar el catálogo al publicar otro tarifario conserva la política editada", async () => {
  await act(async () =>
    root.render(
      <CentroCopiadoCanales puedeGestionar revisionTarifarios={0} activo />,
    ),
  );
  await elegir("Web", "Mostrador de prueba");
  await act(async () =>
    root.render(
      <CentroCopiadoCanales puedeGestionar revisionTarifarios={1} activo />,
    ),
  );
  await click("Guardar canales");
  expect(api.guardarPoliticaTarifarios).toHaveBeenCalledWith(
    1,
    expect.objectContaining({
      canales: expect.objectContaining({
        web: { modalidad: "TARIFARIO", tarifarioId: id },
      }),
    }),
  );
});

it("una vista previa tardía no reemplaza una asignación que ya se editó y guardó", async () => {
  await act(async () =>
    root.render(
      <CentroCopiadoCanales puedeGestionar revisionTarifarios={0} activo />,
    ),
  );
  let entregar!: (v: api.VistaCanales) => void;
  vi.mocked(api.previsualizarCanales).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        entregar = resolve;
      }),
  );
  await act(async () =>
    root.render(
      <CentroCopiadoCanales puedeGestionar revisionTarifarios={1} activo />,
    ),
  );
  await elegir("Web", "Mostrador de prueba");
  const b = politica();
  b.revision = 2;
  b.contenido.canales.web = { modalidad: "TARIFARIO", tarifarioId: id };
  vi.mocked(api.previsualizarCanales).mockResolvedValue(vista(b));
  await click("Guardar canales");
  await act(async () => entregar(vista()));
  expect(entrada("Web").value).toBe(id);
});

it("los rangos propios de una fila no cambian los generales ni las demás combinaciones", async () => {
  await abrir();
  await act(async () =>
    el
      .querySelector<HTMLButtonElement>('button[aria-label^="Opciones de"]')!
      .click(),
  );
  await click("Rangos");
  await elegir("Origen de los rangos", "Usar rangos propios");
  await escribir(entrada("Inicios de los tramos"), "1; 20");
  await click("Aplicar rangos");
  await click("Guardar borrador");
  const matriz = vi.mocked(api.guardarTarifario).mock.calls[0][1].contenido
    .hojas!;
  expect(matriz.rangosGenerales).toEqual([1, 100, 500]);
  expect(matriz.filas[0].rangosPropios).toEqual([1, 20]);
  expect(matriz.filas[1].rangosPropios).toBeUndefined();
});

it("el motor se abre dentro de matrices sin guardar ni simular automáticamente", async () => {
  await abrir();
  await click("Calcular precios con el motor");
  expect(
    [...el.querySelectorAll('[role="tab"], [role="radio"]')]
      .find((t) => t.textContent === "Matrices")
      ?.getAttribute("aria-selected"),
  ).toBe("true");
  expect(el.textContent).not.toContain("Costos y sugerencias");
  expect(boton("Calcular 6 precios").disabled).toBe(false);
  expect(api.guardarTarifario).not.toHaveBeenCalled();
  expect(api.simularCeldasTarifario).not.toHaveBeenCalled();
});

it("revisa y aplica las bajas de la oferta sólo al borrador, sin publicar ni guardar automáticamente", async () => {
  const base = borrador();
  base.contenido.hojas!.filas = filasOferta(
    configTarifarios,
    base.contenido.hojas!,
  );
  for (const f of base.contenido.hojas!.filas)
    for (const p of f.precios) p.precioUnitario = "123.456789";
  vi.mocked(api.obtenerTarifario).mockResolvedValue(base);
  await abrir();
  const cfg = structuredClone(configTarifarios);
  cfg.tamanos = ["A4"];
  await renderEditor(true, cfg);
  expect(el.textContent).toContain("combinaciones ya no se ofrecen");
  await click("Revisar cambios de oferta");
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Combinaciones a retirar",
  );
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "A3",
  );
  await click("Cancelar");
  expect(boton("Guardar borrador").disabled).toBe(true);
  await click("Actualizar combinaciones");
  await click("Aplicar actualización");
  expect(api.guardarTarifario).not.toHaveBeenCalled();
  expect(api.publicarTarifario).not.toHaveBeenCalled();
  expect(
    base.contenido.hojas!.filas.some((f) => f.combinacion.tamano === "A3"),
  ).toBe(true);
  await click("Guardar borrador");
  const guardado = vi.mocked(api.guardarTarifario).mock.calls[0][1].contenido
    .hojas!;
  expect(guardado.filas.every((f) => f.combinacion.tamano === "A4")).toBe(true);
  expect(
    guardado.filas.every((f) =>
      f.precios.every((p) => p.precioUnitario === "123.456789"),
    ),
  ).toBe(true);
});
it("no actualiza combinaciones con oferta sin guardar ni acepta una revisión que cambió", async () => {
  await abrir();
  await renderEditor(true, configTarifarios, true);
  expect(boton("Actualizar combinaciones").disabled).toBe(true);
  await renderEditor();
  await click("Actualizar combinaciones");
  const cfg = structuredClone(configTarifarios);
  cfg.tamanos = ["A4"];
  await renderEditor(true, cfg);
  expect(boton("Aplicar actualización").disabled).toBe(true);
  expect(api.guardarTarifario).not.toHaveBeenCalled();
});

it("distingue motor, versión de tarifario y pendientes en la vista por canal", async () => {
  const preview = vista();
  preview.canales = [
    { canalVenta: "mostrador", origen: "GENERAL", estado: "MOTOR" },
    {
      canalVenta: "web",
      origen: "CANAL",
      estado: "TARIFARIO",
      version: {
        id: "version-ficticia",
        numero: 3,
        nombre: "Web de prueba",
        vigenteDesde: "2026-10-10T12:00:00Z",
      },
    },
    {
      canalVenta: "email",
      origen: "CANAL",
      estado: "PENDIENTE",
      motivo: "SIN_VERSION_VIGENTE",
    },
  ];
  vi.mocked(api.previsualizarCanales).mockResolvedValue(preview);
  await act(async () =>
    root.render(
      <CentroCopiadoCanales puedeGestionar revisionTarifarios={0} activo />,
    ),
  );
  const filas = el.querySelectorAll(
    '[aria-label="Precios resueltos por canal"] > li',
  );
  expect(filas).toHaveLength(3);
  expect(filas[0].textContent).toContain("Hereda la política general");
  expect(filas[0].textContent).toContain("Motor de cotización");
  expect(filas[1].textContent).toContain("Sin versión vigente");
  expect(filas[2].textContent).toContain("Web de prueba");
  expect(filas[2].textContent).toContain("Versión 3");
  expect(boton("Activar asignación en pedidos").disabled).toBe(true);
});

it("la navegación GRAFO conserva la edición al pasar entre matriz y reglas", async () => {
  await abrir();
  const campoPrecio = precio(1);
  await escribir(campoPrecio, "123.45");
  await click("Reglas y contribución");
  expect(campoPrecio.isConnected).toBe(true);
  expect(campoPrecio.closest("[data-inert]")).not.toBeNull();
  await click("Matrices");
  expect(precio(1).value).toBe("123.45");
  await click("Guardar borrador");
  expect(api.guardarTarifario).toHaveBeenCalledWith(
    id,
    expect.objectContaining({
      contenido: expect.objectContaining({
        hojas: expect.objectContaining({
          filas: expect.arrayContaining([
            expect.objectContaining({
              precios: expect.arrayContaining([
                expect.objectContaining({ precioUnitario: "123.45" }),
              ]),
            }),
          ]),
        }),
      }),
    }),
  );
});
