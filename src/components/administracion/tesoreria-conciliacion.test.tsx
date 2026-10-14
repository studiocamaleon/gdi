// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TesoreriaView } from "./tesoreria-view";
import type { CuentaFondos, TesoreriaKpis } from "@/lib/administracion";

const mocks = vi.hoisted(() => ({
  movimientos: vi.fn(),
  conciliar: vi.fn(),
  refresh: vi.fn(),
  error: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: mocks.error } }));
vi.mock("@/lib/administracion-api", async (original) => ({
  ...(await original<typeof import("@/lib/administracion-api")>()),
  getMovimientosCuenta: mocks.movimientos,
  conciliarMovimientoFondos: mocks.conciliar,
  getDestinosTransferencia: async () => [],
}));
vi.mock("../navigation/capacidades-provider", () => ({
  useCapacidad: () => true,
}));
vi.mock("../navigation/permisos-provider", () => ({ usePuede: () => true }));
vi.mock("../design-system/select-field", () => ({
  SelectField: ({
    options,
    value,
    onChange,
    ...props
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (v: string) => void;
    "aria-label": string;
  }) => (
    <select
      aria-label={props["aria-label"]}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const cuenta: CuentaFondos = {
  id: "cuenta-ficticia",
  tipo: "banco",
  nombre: "Banco ficticio",
  banco: null,
  cbuAlias: null,
  moneda: "ARS",
  saldo: 100,
  permiteSaldoNegativo: false,
  ultimoMovimiento: null,
  activo: true,
};
const kpis: TesoreriaKpis = {
  posicionLocal: 100,
  posiciones: { ARS: 100 },
  efectivo: 0,
  bancos: 100,
  cajasActivas: 0,
  cuentasLocales: 1,
  aAcreditar: 0,
  aAcreditarPorMoneda: {},
  valoresEnCartera: 0,
  valoresPorMoneda: {},
};
const pagina = (cantidad = 3) => ({
  items: Array.from({ length: cantidad }, (_, i) => ({
    id: `mov-${i}`,
    fecha: "2026-10-13T15:00:00Z",
    createdAt: "2026-10-13T15:00:00Z",
    tipo: "entrada",
    monto: 10,
    concepto: `Movimiento ficticio ${i}`,
    origenTipo: "cobro",
    saldoPosterior: 100,
    estadoConciliacion: "pendiente",
    conciliadoEl: null,
    conciliadoPorNombre: null,
    referencia: null,
    notas: null,
    actorNombre: "Operador ficticio",
    ordenId: null,
    ordenNumero: null,
  })),
  total: cantidad,
  page: 1,
  pageSize: 25,
  pages: 1,
});
let el: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.movimientos.mockResolvedValue(pagina());
  mocks.conciliar.mockResolvedValue({ ok: true });
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(async () => {
  await act(async () => root.unmount());
  el.remove();
});
async function montar(cuentas = [cuenta]) {
  await act(async () =>
    root.render(
      <TesoreriaView
        initialCuentas={cuentas}
        initialKpis={kpis}
        monedaLocal="ARS"
      />,
    ),
  );
}
const botones = () => [
  ...el.querySelectorAll<HTMLButtonElement>("table button"),
];
async function filtrar(valor: string) {
  const select = el.querySelector<HTMLSelectElement>(
    '[aria-label="Filtrar por conciliación"]',
  )!;
  await act(async () => {
    select.value = valor;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

it("concilia 25 movimientos seguidos sin recargar el layout ni el extracto", async () => {
  mocks.movimientos.mockResolvedValue(pagina(25));
  await montar();
  for (const boton of botones()) await act(async () => boton.click());
  expect(mocks.conciliar).toHaveBeenCalledTimes(25);
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(mocks.movimientos).toHaveBeenCalledTimes(1);
  expect(botones().every((b) => b.disabled)).toBe(true);
});
it("evita el doble clic en una fila y permite conciliar otras mientras espera", async () => {
  const resolver = new Map<string, () => void>();
  mocks.conciliar.mockImplementation(
    (_cuenta: string, id: string) =>
      new Promise<void>((r) => resolver.set(id, r)),
  );
  await montar();
  const [a, b, c] = botones();
  await act(async () => {
    a.click();
    a.click();
    b.click();
  });
  expect(mocks.conciliar).toHaveBeenCalledTimes(2);
  expect(a.disabled).toBe(true);
  expect(b.disabled).toBe(true);
  expect(c.disabled).toBe(false);
  await act(async () => resolver.get("mov-1")!());
  await act(async () => resolver.get("mov-0")!());
  expect(
    botones()
      .slice(0, 2)
      .every((b) => b.disabled),
  ).toBe(true);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("un fallo de conciliación queda en la fila y permite reintentar sin cambiar saldos", async () => {
  mocks.conciliar.mockRejectedValueOnce(new Error("No se pudo conciliar"));
  await montar();
  const antes = el.querySelector("table")!.textContent;
  await act(async () => botones()[0].click());
  expect(mocks.error).toHaveBeenCalledWith("No se pudo conciliar");
  expect(el.querySelector("table")!.textContent).toBe(antes);
  expect(botones()[0].disabled).toBe(false);
  await act(async () => botones()[0].click());
  expect(botones()[0].disabled).toBe(true);
});
it("actualiza sólo el extracto cuando un conciliado deja de pertenecer al filtro", async () => {
  await montar();
  await filtrar("pendiente");
  mocks.movimientos.mockResolvedValue({
    ...pagina(),
    items: pagina().items.slice(1),
    total: 2,
  });
  await act(async () => botones()[0].click());
  expect(mocks.movimientos).toHaveBeenCalledTimes(3);
  expect(botones()).toHaveLength(2);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("una lectura anterior no vuelve a pendiente una conciliación recién confirmada", async () => {
  await montar();
  let resolver!: (p: ReturnType<typeof pagina>) => void;
  mocks.movimientos.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  const select = el.querySelector<HTMLSelectElement>(
    '[aria-label="Filtrar por origen"]',
  )!;
  await act(async () => {
    select.value = "cobro";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => botones()[0].click());
  // Cambiar filtros puede dejar una consulta anterior todavía en vuelo.
  await act(async () => resolver(pagina()));
  expect(botones()[0].disabled).toBe(true);
  expect(mocks.refresh).not.toHaveBeenCalled();
});

it("el error de una lectura no vuelve a abrir el layout ni borra filas confirmadas", async () => {
  await montar();
  await act(async () => botones()[0].click());
  mocks.movimientos.mockRejectedValueOnce(
    new Error("Demasiadas solicitudes. Reintentá en un minuto."),
  );
  await filtrar("pendiente");
  expect(el.textContent).toContain("No pudimos cargar el extracto");
  expect(botones()[0].disabled).toBe(true);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("asocia la conciliación a la cuenta de la fila mientras se carga otra cuenta", async () => {
  await montar([
    cuenta,
    { ...cuenta, id: "segunda", nombre: "Otra cuenta ficticia" },
  ]);
  let resolver!: (p: ReturnType<typeof pagina>) => void;
  mocks.movimientos.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolver = r;
      }),
  );
  const cambiar = [...el.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.textContent?.includes("Otra cuenta ficticia"),
  )!;
  await act(async () => cambiar.click());
  await act(async () => botones()[0].click());
  expect(mocks.conciliar).toHaveBeenCalledWith(cuenta.id, "mov-0", {
    estado: "conciliado",
  });
  await act(async () => resolver({ ...pagina(), items: [] }));
});
it("respeta un filtro elegido mientras la conciliación estaba en curso", async () => {
  let resolver!: () => void;
  mocks.conciliar.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolver = r;
      }),
  );
  await montar();
  await act(async () => botones()[0].click());
  await filtrar("pendiente");
  mocks.movimientos.mockResolvedValue({
    ...pagina(),
    items: pagina().items.slice(1),
    total: 2,
  });
  await act(async () => resolver());
  expect(botones()).toHaveLength(2);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
