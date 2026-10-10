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
    (b) => b.textContent === texto,
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
  const b = boton(texto);
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
const renderEditor = (puedeGestionar = true) =>
  act(async () =>
    root.render(
      <CentroCopiadoTarifarios
        cfg={configTarifarios}
        puedeGestionar={puedeGestionar}
        permiteCad={false}
        ofertaSinGuardar={false}
        onGuardado={() => {}}
      />,
    ),
  );
async function abrir() {
  await renderEditor();
  await elegir("Tarifario a editar", "Mostrador de prueba");
}
it("crea con precios exactos: celda vacía pendiente y cero gratuito", async () => {
  await renderEditor();
  await click("Nuevo tarifario");
  await escribir(entrada("Nombre del tarifario"), "Web ficticia");
  await click("Agregar combinaciones de la oferta");
  const precios = el.querySelectorAll<HTMLInputElement>(
    'input[placeholder="Pendiente"]',
  );
  await escribir(precios[0], "999999999999999999,12345678");
  await escribir(precios[1], "0");
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
  expect(boton("Agregar combinaciones de la oferta").disabled).toBe(true);
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
  expect(el.textContent).toContain("Desde 100 carillas");
});
it("editar rangos generales conserva inicios comunes y avisa al retirar precios", async () => {
  await abrir();
  const inputs = el.querySelectorAll<HTMLInputElement>(
    'input[placeholder="Pendiente"]',
  );
  await escribir(inputs[1], "80");
  await click("Editar rangos generales");
  await escribir(entrada("Inicios de los tramos"), "1; 50; 500");
  await click("Aplicar rangos");
  expect(document.body.textContent).toContain("Se eliminarán 1 precios");
  await click("Confirmar");
  expect(el.textContent).toContain("Desde 50 hojas");
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
  expect(el.querySelectorAll("tbody tr")).toHaveLength(0);
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
  expect(el.querySelectorAll("tbody tr")).toHaveLength(0);
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
