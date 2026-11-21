"use client";

import * as React from "react";
import Decimal from "decimal.js";
import { ComboBox, Input, ListBox } from "@heroui/react";
import { PlusIcon } from "lucide-react";
import { ActionButton } from "@/components/design-system/action-button";
import { SelectField } from "@/components/design-system/select-field";
import {
  useDesignScope,
  useDesignTheme,
} from "@/components/design-system/appearance";
import focus from "@/components/design-system/field-focus.module.css";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  getMateriasPrimas,
  getMateriasPrimasStock,
} from "@/lib/materias-primas-api";
import type { MateriaPrimaStock } from "@/lib/materias-primas";
import { getMateriaPrimaVarianteLabel } from "@/lib/materias-primas-variantes-display";
import {
  materialPriceContext,
  materialPriceInUnit,
  normalizeMaterialUnit,
} from "@/lib/material-units";
import { formatearMoneda, type Moneda } from "@/lib/moneda";
import { normalizarBusqueda } from "@/lib/busqueda-texto";
import { useTipoCambioDocumento } from "./tipo-cambio-documento";
import s from "./trabajo-medida-dialog.module.css";

type Variante = MateriaPrimaStock["variantes"][number];

function preciosPorUnidad(material: MateriaPrimaStock, variante: Variante) {
  const contexto = materialPriceContext({
    ...variante,
    materiaPrima: material,
    atributosVarianteJson: variante.atributosVariante,
    equivalenciasJson: variante.equivalencias,
  });
  const precios = new Map<string, number>();
  if (variante.precioReferencia == null) return precios;
  const candidatas = [
    contexto.unidadUso,
    contexto.unidadStock,
    contexto.unidadPrecio,
    contexto.unidadCompra,
    "unidad",
    "metro_lineal",
    "m2",
    ...(contexto.equivalencias ?? []).flatMap((e) => [e.origen, e.destino]),
  ];
  for (const valor of new Set(candidatas)) {
    if (!valor) continue;
    const unidad = normalizeMaterialUnit(valor);
    const resultado = materialPriceInUnit(
      contexto,
      variante.precioReferencia,
      unidad,
    );
    if (resultado.ok && Number.isFinite(resultado.precio))
      precios.set(unidad, resultado.precio);
  }
  return precios;
}

function etiquetaUnidad(unidad: string, cantidad = 1) {
  if (unidad === "unidad" && cantidad !== 1) return "unidades";
  if (unidad === "metro_lineal")
    return cantidad === 1 ? "m lineal" : "m lineales";
  if (unidad === "m2") return "m²";
  if (unidad === "m3") return "m³";
  return unidad;
}

export type ConfirmarMaterial = () => {
  materiales: number;
  detalleMateriales: string;
} | null;

type EstimacionProps = {
  moneda: Moneda;
  costo: number;
  detalle: string;
  onAgregar: (costo: number, detalle: string) => void;
  onPendiente?: (pendiente: boolean) => void;
  confirmarRef?: React.Ref<ConfirmarMaterial>;
};

export function MaterialInventarioEstimado(props: EstimacionProps) {
  const puedeVerStock = usePuede("inventario.stock.ver");
  const puedeVerMovimientos = usePuede("inventario.movimientos.ver");
  const puedeVerMateriales = usePuede("inventario.materiales.ver");
  const cargar =
    puedeVerStock || puedeVerMovimientos
      ? getMateriasPrimasStock
      : puedeVerMateriales
        ? getMateriasPrimas
        : null;
  const [catalogo, setCatalogo] = React.useState<MateriaPrimaStock[] | null>(
    null,
  );
  const [errorCarga, setErrorCarga] = React.useState("");
  const [intento, setIntento] = React.useState(0);
  React.useEffect(() => {
    if (!cargar) return;
    let vigente = true;
    setErrorCarga("");
    cargar()
      .then((datos) => {
        if (vigente) setCatalogo(datos);
      })
      .catch(() => {
        if (vigente) setErrorCarga("No se pudo cargar el inventario.");
      });
    return () => {
      vigente = false;
    };
  }, [cargar, intento]);

  if (!cargar) return null;
  if (!catalogo)
    return (
      <div className={s.inventory} role="status">
        {errorCarga || "Cargando materiales del inventario…"}
        {errorCarga && (
          <ActionButton
            className={s.inlineAction}
            variant="outline"
            onPress={() => setIntento((v) => v + 1)}
          >
            Reintentar
          </ActionButton>
        )}
      </div>
    );
  return <SelectorMaterialEstimado {...props} catalogo={catalogo} />;
}

export function SelectorMaterialEstimado({
  catalogo,
  moneda,
  costo,
  detalle,
  onAgregar,
  onPendiente,
  confirmarRef,
}: EstimacionProps & { catalogo: MateriaPrimaStock[] }) {
  const scope = useDesignScope();
  const theme = useDesignTheme();
  const [intento, setIntento] = React.useState(0);
  const [seleccion, setSeleccion] = React.useState("");
  const [busqueda, setBusqueda] = React.useState("");
  const [unidadElegida, setUnidadElegida] = React.useState("");
  const [cantidad, setCantidad] = React.useState("1");
  const documento = useTipoCambioDocumento();
  const resolverCambio = documento?.resolver;
  const [errorCambio, setErrorCambio] = React.useState("");
  const variantes = React.useMemo(
    () =>
      catalogo
        .filter((m) => m.activo)
        .flatMap((material) =>
          material.variantes
            .filter((v) => v.activo)
            .map((variante) => {
              const nombre = getMateriaPrimaVarianteLabel(material, variante);
              return {
                material,
                variante,
                nombre,
                texto: normalizarBusqueda(
                  [nombre, material.codigo, variante.sku].join(" "),
                ),
              };
            }),
        ),
    [catalogo],
  );
  const elegida = variantes.find((v) => v.variante.id === seleccion);
  const precios = React.useMemo(
    () =>
      elegida
        ? preciosPorUnidad(elegida.material, elegida.variante)
        : new Map<string, number>(),
    [elegida],
  );
  const unidad = precios.has(unidadElegida)
    ? unidadElegida
    : ([...precios.keys()][0] ?? "");
  const origen = elegida?.variante.moneda?.toUpperCase() || moneda.codigo;
  const requiereCambio = origen === "USD" && origen !== moneda.codigo;
  React.useEffect(() => {
    if (!requiereCambio || !resolverCambio || documento?.cambio) return;
    let vigente = true;
    setErrorCambio("");
    resolverCambio().catch(() => {
      if (vigente)
        setErrorCambio("No se pudo obtener el tipo de cambio del documento.");
    });
    return () => {
      vigente = false;
    };
  }, [requiereCambio, resolverCambio, documento?.cambio, intento]);
  const tasa =
    origen === moneda.codigo
      ? 1
      : requiereCambio && documento?.cambio?.monedaDestino === moneda.codigo
        ? documento.cambio.tasa
        : null;
  const referencia = precios.get(unidad);
  const unitario =
    referencia != null && tasa != null && Number.isFinite(tasa) && tasa > 0
      ? new Decimal(referencia).mul(tasa)
      : null;
  const consumo = Number(cantidad);
  const subtotal =
    unitario && Number.isFinite(consumo) && consumo > 0
      ? unitario.mul(cantidad).toDecimalPlaces(moneda.decimales)
      : null;
  const formatearPrecio = (n: Decimal) =>
    formatearMoneda(n.toNumber(), moneda, {
      decimales: Math.max(moneda.decimales, Math.min(6, n.decimalPlaces())),
    });
  const linea =
    elegida && subtotal && unitario
      ? `${elegida.nombre} · ${consumo.toLocaleString(moneda.locale, { maximumFractionDigits: 12 })} ${etiquetaUnidad(unidad, consumo)} × ${formatearPrecio(unitario)} = ${formatearMoneda(subtotal.toNumber(), moneda)}`
      : "";
  const nuevoDetalle = [detalle, linea].filter(Boolean).join("\n");
  const nuevoCosto = subtotal?.plus(Number.isFinite(costo) ? costo : 0);
  const limpiar = () => {
    setSeleccion("");
    setBusqueda("");
    setUnidadElegida("");
    setCantidad("1");
    onPendiente?.(false);
  };
  const terminos = normalizarBusqueda(busqueda).split(/\s+/);
  const coincidencias = variantes
    .filter((v) => terminos.every((t) => v.texto.includes(t)))
    .slice(0, 60);
  function problemaDeSeleccion() {
    if (!elegida) return "";
    if (elegida.variante.precioReferencia == null)
      return "Esta variante no tiene precio de referencia en inventario.";
    if (!precios.size)
      return "Revisá la unidad de precio y las equivalencias de la variante en inventario.";
    if (origen !== moneda.codigo && !requiereCambio)
      return `No hay conversión de ${origen} a ${moneda.codigo}.`;
    if (requiereCambio && !unitario) {
      if (errorCambio) return errorCambio;
      return resolverCambio && !documento?.cambio
        ? "Cargando tipo de cambio…"
        : "Falta un tipo de cambio válido en el documento.";
    }
    if (!subtotal) return "Ingresá una cantidad mayor que cero.";
    if (nuevoDetalle.length > 2000)
      return "El detalle de materiales admite hasta 2000 caracteres.";
    if (nuevoCosto?.gt(1e10))
      return "El costo de materiales supera el máximo permitido.";
    return "";
  }
  const problema = problemaDeSeleccion();
  const confirmar: ConfirmarMaterial = () => {
    if (!elegida) return null;
    if (problema || !nuevoCosto || !linea)
      throw new Error(problema || "Revisá el costo del material seleccionado.");
    limpiar();
    return { materiales: nuevoCosto.toNumber(), detalleMateriales: nuevoDetalle };
  };
  React.useImperativeHandle(confirmarRef, () => confirmar);
  return (
    <div className={s.inventory}>
      <Field>
        <FieldLabel htmlFor="medida-inventario">
          Material del inventario
        </FieldLabel>
        {!elegida ? (
          <ComboBox
            aria-label="Material del inventario"
            inputValue={busqueda}
            onInputChange={setBusqueda}
            selectedKey={null}
            menuTrigger="focus"
            fullWidth
            isDisabled={!variantes.length}
            items={coincidencias}
            onSelectionChange={(key) => {
              if (key != null) {
                setSeleccion(String(key));
                onPendiente?.(true);
              }
            }}
          >
            <ComboBox.InputGroup>
              <Input
                id="medida-inventario"
                className={focus.singleBorder}
                placeholder="Buscar material o SKU…"
              />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover {...scope} className={theme}>
              <ListBox renderEmptyState={() => "Sin coincidencias."}>
                {(opcion: (typeof variantes)[number]) => (
                  <ListBox.Item
                    id={opcion.variante.id}
                    textValue={opcion.nombre}
                  >
                    <div>
                      {opcion.nombre}
                      <p className="text-xs text-muted-foreground">
                        {opcion.variante.sku}
                      </p>
                    </div>
                  </ListBox.Item>
                )}
              </ListBox>
            </ComboBox.Popover>
          </ComboBox>
        ) : (
          <strong>{elegida.nombre}</strong>
        )}
        {!variantes.length && (
          <FieldDescription>
            El inventario todavía no tiene variantes activas.
          </FieldDescription>
        )}
        {requiereCambio && errorCambio && (
          <ActionButton
            className={s.inlineAction}
            variant="outline"
            onPress={() => setIntento((v) => v + 1)}
          >
            Reintentar
          </ActionButton>
        )}
      </Field>
      {elegida && (
        <>
          {precios.size > 0 && (
            <div className={s.twoFields}>
              <Field>
                <FieldLabel htmlFor="medida-consumo">
                  Cantidad de material
                </FieldLabel>
                <Input
                  id="medida-consumo"
                  className={focus.singleBorder}
                  type="number"
                  step="any"
                  min="0"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="medida-unidad-consumo">
                  Unidad de consumo
                </FieldLabel>
                <SelectField
                  id="medida-unidad-consumo"
                  aria-label="Unidad de consumo"
                  value={unidad}
                  onChange={setUnidadElegida}
                  options={[...precios.keys()].map((u) => ({
                    value: u,
                    label: etiquetaUnidad(u),
                  }))}
                />
              </Field>
            </div>
          )}
          {unitario && (
            <div className={s.inventoryAmounts}>
              <span>
                Costo por {etiquetaUnidad(unidad)}{" "}
                <strong>{formatearPrecio(unitario)}</strong>
              </span>
              <span>
                Subtotal{" "}
                <strong>
                  {subtotal
                    ? formatearMoneda(subtotal.toNumber(), moneda)
                    : "—"}
                </strong>
              </span>
            </div>
          )}
          {problema && <p role="status">{problema}</p>}
          <div className={s.inventoryActions}>
            <ActionButton
              variant="outline"
              isDisabled={!nuevoCosto || !linea || Boolean(problema)}
              onPress={() => {
                const suma = confirmar();
                if (suma) onAgregar(suma.materiales, suma.detalleMateriales);
              }}
            >
              <PlusIcon aria-hidden /> Sumar material
            </ActionButton>
            <ActionButton variant="ghost" onPress={limpiar}>
              Descartar selección
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}
