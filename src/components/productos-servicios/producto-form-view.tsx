"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftIcon,
  BadgeDollarSignIcon,
  PackageIcon,
  RulerIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { HumanSelect, optionFromLabel } from "@/components/ui/human-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
  getCatalogoComercial,
} from "@/lib/productos-servicios-api";
import type {
  DimensionProducto,
  ModoMedidasProducto,
  ProductoCategoriaComercial,
  ProductoDetalle,
} from "@/lib/productos-servicios";
import { unidadComercialProductoItems } from "@/lib/productos-servicios";
import { getDimensionesRequeridas } from "@/lib/producto-medidas";
import { LabelConTooltip } from "@/components/ui/label-con-tooltip";
import {
  getLabel,
  modoMedidasLabels,
  unidadComercialLabels,
} from "@/lib/labels-humanos";
import {
  TabPrecioEditor,
  type TabPrecioConfig,
} from "@/components/productos-servicios/tab-precio-editor";

import styles from "./producto-form-view.module.css";

type Modo = "crear" | "editar";

interface Props {
  modo: Modo;
  productoExistente?: ProductoDetalle;
}

const MODOS_MEDIDAS = [
  { value: "FIJA", label: "Medida fija" },
  { value: "LIBRE", label: "Medida libre" },
  { value: "COMERCIAL_ELIGE", label: "Medidas predefinidas" },
  { value: "MIXTA", label: "Predefinida o personalizada" },
];

export function ProductoFormView({ modo, productoExistente }: Props) {
  const router = useRouter();
  const [guardando, setGuardando] = React.useState(false);
  const [eliminando, setEliminando] = React.useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = React.useState(false);

  const [nombre, setNombre] = React.useState(productoExistente?.nombre ?? "");
  const [descripcion, setDescripcion] = React.useState(
    productoExistente?.descripcion ?? "",
  );
  const [catalogoComercial, setCatalogoComercial] = React.useState<
    ProductoCategoriaComercial[]
  >([]);
  const [subcategoriaComercialCodigo, setSubcategoriaComercialCodigo] =
    React.useState(
      productoExistente?.subcategoriaComercial?.codigo ?? "producto_a_medida",
    );
  const [unidadComercial, setUnidadComercial] = React.useState(
    productoExistente?.unidadComercial ?? "unidad",
  );
  const [modoMedidas, setModoMedidas] = React.useState<ModoMedidasProducto>(
    productoExistente?.modoMedidas ?? "FIJA",
  );
  const [geometria, setGeometria] = React.useState<"2D" | "3D">(() =>
    productoExistente &&
    getDimensionesRequeridas(productoExistente).includes("PROFUNDIDAD")
      ? "3D"
      : "2D",
  );
  const [anchoDefault, setAnchoDefault] = React.useState(
    productoExistente?.medidaDefaultAnchoMm ?? "",
  );
  const [altoDefault, setAltoDefault] = React.useState(
    productoExistente?.medidaDefaultAltoMm ?? "",
  );
  const [profundidadDefault, setProfundidadDefault] = React.useState(
    productoExistente?.medidaDefaultProfundidadMm ?? "",
  );
  const [activo, setActivo] = React.useState(productoExistente?.activo ?? true);

  // Tab Precio: editor completo con tramos (F.3.8)
  const precioConfigInicial: TabPrecioConfig =
    (productoExistente?.precioConfigJson as TabPrecioConfig | null) ?? {
      metodoCalculo: "por_margen",
      detalle: { marginPct: 40, minimumMarginPct: 25 },
    };
  const [precioConfig, setPrecioConfig] =
    React.useState<TabPrecioConfig>(precioConfigInicial);

  React.useEffect(() => {
    getCatalogoComercial()
      .then((catalogo) => {
        setCatalogoComercial(catalogo);
        setSubcategoriaComercialCodigo((current) =>
          catalogo.some((categoria) =>
            categoria.subcategorias.some(
              (subcategoria) => subcategoria.codigo === current,
            ),
          )
            ? current
            : (catalogo[0]?.subcategorias[0]?.codigo ?? "producto_a_medida"),
        );
      })
      .catch(() => setCatalogoComercial([]));
  }, []);

  const subcategoriaOptions = catalogoComercial.flatMap((categoria) =>
    categoria.subcategorias.map((subcategoria) => ({
      value: subcategoria.codigo,
      label: `${categoria.nombre} · ${subcategoria.nombre}`,
    })),
  );

  const handleGuardar = async () => {
    setGuardando(true);
    try {
      const precioConfigJson = precioConfig as unknown as Record<
        string,
        unknown
      >;

      const dimensionesRequeridas: DimensionProducto[] =
        geometria === "3D"
          ? ["ANCHO", "ALTO", "PROFUNDIDAD"]
          : ["ANCHO", "ALTO"];
      const payload = {
        nombre,
        descripcion: descripcion || undefined,
        subcategoriaComercialCodigo,
        atributosComercialesJson:
          (productoExistente?.atributosComercialesJson as Record<
            string,
            unknown
          > | null) ?? {},
        unidadComercial: unidadComercial as "unidad" | "m2" | "metro_lineal",
        modoMedidas,
        dimensionesRequeridas,
        medidaDefaultAnchoMm: anchoDefault ? Number(anchoDefault) : undefined,
        medidaDefaultAltoMm: altoDefault ? Number(altoDefault) : undefined,
        medidaDefaultProfundidadMm:
          geometria === "3D" && profundidadDefault
            ? Number(profundidadDefault)
            : undefined,
        precioConfigJson,
      };

      if (modo === "crear") {
        const creado = (await crearProducto(payload)) as { id: string };
        toast.success(`Producto "${nombre}" creado`);
        router.push(`/productos-servicios/${creado.id}`);
      } else {
        await actualizarProducto(productoExistente!.id, { ...payload, activo });
        toast.success(`Producto "${nombre}" actualizado`);
        router.push(`/productos-servicios/${productoExistente!.id}`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = () => {
    if (!productoExistente) return;
    setConfirmandoEliminar(true);
  };

  const confirmarEliminar = async () => {
    if (!productoExistente) return;
    setConfirmandoEliminar(false);
    setEliminando(true);
    try {
      await eliminarProducto(productoExistente.id);
      toast.success("Producto eliminado");
      router.push("/productos-servicios");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error eliminando");
      setEliminando(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link
          href={
            modo === "editar"
              ? `/productos-servicios/${productoExistente!.id}`
              : "/productos-servicios"
          }
          className={styles.back}
        >
          <ArrowLeftIcon className="mr-1 size-4" />
          Volver
        </Link>
        <span className={styles.eyebrow}>Catálogo de productos</span>
        <h1>
          {modo === "crear"
            ? "Nuevo producto"
            : `Editar producto: ${productoExistente?.nombre}`}
        </h1>
        <p>
          {modo === "crear"
            ? "Atributos comerciales del producto. La configuración de pasos / rutas se edita después."
            : "Editás los atributos comerciales. Las rutas y configuración por paso se manejan en otra pantalla."}
        </p>
      </header>

      <nav className={styles.steps} aria-label="Secciones del producto">
        <div>
          <span>01</span>
          <strong>Identidad</strong>
          <small>Nombre y categoría</small>
        </div>
        <div>
          <span>02</span>
          <strong>Comercial y medidas</strong>
          <small>Cobro y dimensiones</small>
        </div>
        <div>
          <span>03</span>
          <strong>Precio</strong>
          <small>Método y margen</small>
        </div>
      </nav>

      <div className={styles.formGrid}>
        <Card className={styles.formCard}>
          <CardHeader className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true">
              <PackageIcon />
            </span>
            <div>
              <CardTitle>Identidad</CardTitle>
              <CardDescription>
                Nombre y categoría del producto en el catálogo.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className={`${styles.cardBody} space-y-4`}>
            <div className="space-y-2">
              <Label>Geometría del producto</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={geometria === "2D" ? "default" : "outline"}
                  onClick={() => setGeometria("2D")}
                >
                  2D · Ancho y alto
                </Button>
                <Button
                  type="button"
                  variant={geometria === "3D" ? "default" : "outline"}
                  onClick={() => setGeometria("3D")}
                >
                  3D · Ancho, alto y profundidad
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Tarjetas de Visita Premium 300gr"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategoriaComercial">
                Categoría comercial *
              </Label>
              <HumanSelect
                id="subcategoriaComercial"
                value={subcategoriaComercialCodigo}
                onValueChange={(value) =>
                  setSubcategoriaComercialCodigo(value || "producto_a_medida")
                }
                options={subcategoriaOptions}
              />
              <p className="text-muted-foreground text-xs">
                Define agrupación para reportes y campos visibles en propuestas.
              </p>
            </div>
            {modo === "editar" && (
              <div className={styles.activeRow}>
                <div>
                  <Label htmlFor="activo">Activo</Label>
                  <p className="text-muted-foreground text-xs">
                    Si está inactivo no aparece en el cotizador.
                  </p>
                </div>
                <Switch
                  id="activo"
                  checked={activo}
                  onCheckedChange={setActivo}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={styles.formCard}>
          <CardHeader className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true">
              <RulerIcon />
            </span>
            <div>
              <CardTitle>Comercial y medidas</CardTitle>
              <CardDescription>
                Definí cómo se vende el producto y qué datos deberá completar el
                comercial al cotizarlo.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className={`${styles.cardBody} space-y-4`}>
            <div className="space-y-2">
              <LabelConTooltip
                label="Unidad de venta"
                htmlFor="unidad"
                tooltip={
                  getLabel(unidadComercialLabels, unidadComercial).descripcion
                }
              />
              <HumanSelect
                id="unidad"
                value={unidadComercial}
                onValueChange={(v) => setUnidadComercial(v || "unidad")}
                options={unidadComercialProductoItems.map((it) =>
                  optionFromLabel(it.value, unidadComercialLabels),
                )}
              />
            </div>
            <div className="space-y-2">
              <LabelConTooltip
                label="¿Cómo se define la medida?"
                htmlFor="modoMedidas"
                tooltip={getLabel(modoMedidasLabels, modoMedidas).descripcion}
                ejemplo={getLabel(modoMedidasLabels, modoMedidas).ejemplo}
              />
              <HumanSelect
                id="modoMedidas"
                value={modoMedidas}
                onValueChange={(v) =>
                  setModoMedidas((v || "FIJA") as ModoMedidasProducto)
                }
                options={MODOS_MEDIDAS.map((it) =>
                  optionFromLabel(it.value, modoMedidasLabels),
                )}
              />
            </div>
            {modoMedidas !== "LIBRE" && (
              <div
                className={`grid gap-4 ${geometria === "3D" ? "grid-cols-3" : "grid-cols-2"}`}
              >
                <div className="space-y-2">
                  <Label htmlFor="ancho">Ancho default (mm)</Label>
                  <Input
                    id="ancho"
                    type="number"
                    value={anchoDefault}
                    onChange={(e) => setAnchoDefault(e.target.value)}
                    placeholder="90"
                  />
                </div>
                {geometria === "3D" && (
                  <div className="space-y-2">
                    <Label htmlFor="profundidad">
                      Profundidad default (mm)
                    </Label>
                    <Input
                      id="profundidad"
                      type="number"
                      value={profundidadDefault}
                      onChange={(e) => setProfundidadDefault(e.target.value)}
                      placeholder="180"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="alto">Alto default (mm)</Label>
                  <Input
                    id="alto"
                    type="number"
                    value={altoDefault}
                    onChange={(e) => setAltoDefault(e.target.value)}
                    placeholder="50"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={`${styles.formCard} ${styles.priceCard}`}>
          <CardHeader className={styles.cardHeader}>
            <span className={styles.cardIcon} aria-hidden="true">
              <BadgeDollarSignIcon />
            </span>
            <div>
              <CardTitle>Precio de venta</CardTitle>
              <CardDescription>
                Cómo se calcula el precio de venta a partir del costo del motor.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className={styles.priceBody}>
            <TabPrecioEditor
              value={precioConfig}
              onChange={setPrecioConfig}
              unidadComercial={unidadComercial}
            />
          </CardContent>
        </Card>
      </div>

      <footer className={styles.actions}>
        {modo === "editar" ? (
          <Button
            variant="destructive"
            className={styles.deleteAction}
            onClick={handleEliminar}
            disabled={guardando || eliminando}
          >
            <Trash2Icon className="mr-2 size-4" />
            {eliminando ? "Eliminando..." : "Eliminar"}
          </Button>
        ) : (
          <div />
        )}
        <Button
          className={styles.saveAction}
          onClick={handleGuardar}
          disabled={guardando || !nombre.trim()}
          size="lg"
        >
          <SaveIcon className="mr-2 size-4" />
          {guardando
            ? "Guardando..."
            : modo === "crear"
              ? "Crear producto"
              : "Guardar cambios"}
        </Button>
      </footer>

      <ConfirmacionDestructiva
        open={confirmandoEliminar}
        onOpenChange={(open) => {
          if (!open) setConfirmandoEliminar(false);
        }}
        titulo="Eliminar producto"
        descripcion={`¿Eliminar "${productoExistente?.nombre ?? ""}"?`}
        impacto={[
          "Si tiene cotizaciones se marcará como inactivo en vez de borrar.",
        ]}
        nombreItem={productoExistente?.nombre}
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={confirmarEliminar}
      />
    </main>
  );
}
