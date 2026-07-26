"use client";

import * as React from "react";
import { formatearMoneda, parsearMonto, type Moneda } from "@/lib/moneda";
import { useConfigRegional } from "@/components/navigation/config-regional-provider";
import { PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Badge } from "@/components/ui/badge";
import { ConfirmacionDestructiva } from "@/components/ui/confirmacion-destructiva";
import { usePuede } from "@/components/navigation/permisos-provider";
import {
  MOTIVOS_REMUNERACION,
  crearRemuneracion,
  eliminarRemuneracion,
  getRemuneraciones,
  type MotivoRemuneracion,
  type Remuneracion,
} from "@/lib/empleados-api";

/**
 * La remuneración del legajo: qué gana hoy, cuánto cuesta de verdad y cómo
 * llegó hasta acá.
 *
 * Esta es la fuente ÚNICA del costo laboral. Antes el sueldo se cargaba en cada
 * centro de costo donde la persona trabajaba, y ya había divergido: la misma
 * persona con dos sueldos distintos en centros distintos. Los centros ahora
 * leen de acá. Ver docs/legajos-nomina-diseno.md
 */

const fmt = (n: number, moneda: Moneda) =>
  formatearMoneda(n, moneda, { decimales: 0 });

/** 'YYYY-MM' → 'julio 2026'. */
function mesLargo(periodo: string): string {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(anio, mes - 1, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
}

function mesActual(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
}

type Borrador = {
  vigenteDesde: string;
  sueldoNeto: string;
  cargasSociales: string;
  sueldosPorAnio: number;
  motivo: MotivoRemuneracion;
};

const BORRADOR_VACIO: Borrador = {
  vigenteDesde: mesActual(),
  sueldoNeto: "",
  cargasSociales: "",
  sueldosPorAnio: 13,
  motivo: "paritaria",
};

export function RemuneracionSection({ empleadoId }: { empleadoId: string }) {
  const { moneda } = useConfigRegional();
  const puedeVer = usePuede("registros.ver_remuneraciones");
  const [filas, setFilas] = React.useState<Remuneracion[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [agregando, setAgregando] = React.useState(false);
  const [guardando, setGuardando] = React.useState(false);
  const [borrador, setBorrador] = React.useState<Borrador>(BORRADOR_VACIO);
  const [aBorrar, setABorrar] = React.useState<Remuneracion | null>(null);

  React.useEffect(() => {
    if (!puedeVer) return;
    let vivo = true;
    getRemuneraciones(empleadoId)
      .then((r) => vivo && setFilas(r))
      .catch(() => vivo && setError("No se pudo leer la remuneración."));
    return () => {
      vivo = false;
    };
  }, [empleadoId, puedeVer]);

  // Sin el permiso la sección no existe: enumerar lo que no podés ver es
  // información que no hace falta dar.
  if (!puedeVer) return null;

  const vigente = filas?.find((f) => f.vigenteHasta === null) ?? null;

  async function guardar() {
    // El usuario tipea con los separadores de su moneda ("1.234,56"); el DTO
    // del API exige @IsNumberString() canónico ("1234.56"). Se parsea acá y
    // se manda String(numero): el texto crudo nunca viaja.
    const sueldo = parsearMonto(borrador.sueldoNeto, moneda);
    if (sueldo === null || sueldo <= 0) {
      toast.error("Falta el sueldo neto (o no es un monto válido).");
      return;
    }
    const cargas = borrador.cargasSociales.trim()
      ? parsearMonto(borrador.cargasSociales, moneda)
      : 0;
    if (cargas === null) {
      toast.error("Las cargas sociales no son un monto válido.");
      return;
    }
    setGuardando(true);
    try {
      await crearRemuneracion(empleadoId, {
        vigenteDesde: borrador.vigenteDesde,
        sueldoNeto: String(sueldo),
        cargasSociales: String(cargas),
        sueldosPorAnio: borrador.sueldosPorAnio,
        motivo: borrador.motivo,
      });
      setFilas(await getRemuneraciones(empleadoId));
      setBorrador(BORRADOR_VACIO);
      setAgregando(false);
      toast.success("Remuneración guardada.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo guardar la remuneración.",
      );
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(fila: Remuneracion) {
    try {
      await eliminarRemuneracion(empleadoId, fila.id);
      setFilas(await getRemuneraciones(empleadoId));
      toast.success("Remuneración eliminada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar.");
    } finally {
      setABorrar(null);
    }
  }

  return (
    <Card className="rounded-2xl border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-bold tracking-tight">
          Remuneración
        </CardTitle>
        <CardDescription>
          Lo que cobra esta persona. Los centros de costo toman el sueldo de
          acá: no hace falta cargarlo de nuevo en cada uno.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : filas === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            {vigente ? (
              <div className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <WalletIcon className="size-4 text-muted-foreground" />
                  <span className="text-2xl font-semibold tracking-tight">
                    {fmt(vigente.sueldoNeto, moneda)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    de bolsillo + {fmt(vigente.cargasSociales, moneda)} de cargas
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    desde {mesLargo(vigente.vigenteDesde)}
                  </Badge>
                  {/* También la vigente se puede borrar: si te equivocaste de
                      mes al cargarla, corregirla con otra encima dejaría el
                      error adentro del historial para siempre. Al borrarla, la
                      anterior vuelve a quedar vigente. */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Eliminar la remuneración vigente"
                    onClick={() => setABorrar(vigente)}
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </div>

                <div className="mt-3 border-t border-border/60 pt-3 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-muted-foreground">
                      Cuesta por mes
                      {vigente.sueldosPorAnio !== 12
                        ? ` (${vigente.sueldosPorAnio} sueldos al año, aguinaldo prorrateado)`
                        : " (sin aguinaldo)"}
                    </span>
                    <span className="font-semibold">
                      {fmt(vigente.costoMensual, moneda)}
                    </span>
                  </div>
                  {vigente.provisionSacMensual > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {fmt(vigente.costoMensualSinSac, moneda)} del mes +{" "}
                      {fmt(vigente.provisionSacMensual, moneda)} de provisión del
                      aguinaldo. Se prorratea para que el mismo trabajo no
                      cueste distinto en junio que en marzo.
                    </p>
                  ) : null}
                </div>

                {vigente.notas ? (
                  <p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
                    {vigente.notas}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Todavía no cargaste la remuneración de esta persona. Sin ella,
                los centros de costo donde trabaje no pueden costear su hora.
              </p>
            )}

            {filas.length > 1 ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Historial
                </p>
                {filas
                  .filter((f) => f.vigenteHasta !== null)
                  .map((f) => (
                    <div
                      key={f.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <span className="text-muted-foreground">
                        {mesLargo(f.vigenteDesde)} → {mesLargo(f.vigenteHasta!)}
                      </span>
                      <span className="font-medium">{fmt(f.sueldoNeto, moneda)}</span>
                      <span className="text-xs text-muted-foreground">
                        + {fmt(f.cargasSociales, moneda)} cargas
                      </span>
                      {f.motivo ? (
                        <Badge variant="outline" className="text-xs">
                          {MOTIVOS_REMUNERACION.find(
                            (m) => m.value === f.motivo,
                          )?.label ?? f.motivo}
                        </Badge>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="ml-auto size-7"
                        aria-label="Eliminar esta remuneración"
                        onClick={() => setABorrar(f)}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </div>
                  ))}
              </div>
            ) : null}

            {agregando ? (
              <div className="flex flex-col gap-3 rounded-2xl border border-border/70 p-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Desde el mes</span>
                    <Input
                      type="month"
                      value={borrador.vigenteDesde}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          vigenteDesde: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Sueldo neto</span>
                    <MoneyInput
                      placeholder="0"
                      value={borrador.sueldoNeto}
                      moneda={moneda}
                      onValueChange={(texto) =>
                        setBorrador((b) => ({ ...b, sueldoNeto: texto }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">
                      Cargas sociales
                    </span>
                    <MoneyInput
                      placeholder="0"
                      value={borrador.cargasSociales}
                      moneda={moneda}
                      onValueChange={(texto) =>
                        setBorrador((b) => ({
                          ...b,
                          cargasSociales: texto,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-muted-foreground">Sueldos al año</span>
                    <select
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                      value={borrador.sueldosPorAnio}
                      onChange={(e) =>
                        setBorrador((b) => ({
                          ...b,
                          sueldosPorAnio: Number(e.target.value),
                        }))
                      }
                    >
                      <option value={13}>13 — con aguinaldo</option>
                      <option value={12}>12 — sin aguinaldo</option>
                      <option value={14}>14 — por convenio</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Motivo</span>
                  {MOTIVOS_REMUNERACION.map((m) => (
                    <Button
                      key={m.value}
                      type="button"
                      size="sm"
                      variant={
                        borrador.motivo === m.value ? "secondary" : "ghost"
                      }
                      onClick={() =>
                        setBorrador((b) => ({ ...b, motivo: m.value }))
                      }
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  Al guardar, la remuneración anterior se cierra sola el mes
                  previo. No hace falta editarla.
                </p>

                <div className="flex gap-2">
                  <Button type="button" onClick={() => void guardar()} disabled={guardando}>
                    {guardando ? "Guardando…" : "Guardar"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setAgregando(false);
                      setBorrador(BORRADOR_VACIO);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAgregando(true)}
                >
                  <PlusIcon data-icon="inline-start" />
                  {vigente ? "Cargar un cambio de sueldo" : "Cargar la remuneración"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <ConfirmacionDestructiva
        open={aBorrar !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setABorrar(null);
        }}
        titulo="Eliminar esta remuneración"
        descripcion={
          aBorrar
            ? `Se borra el tramo que arranca en ${mesLargo(aBorrar.vigenteDesde)}.`
            : ""
        }
        impacto={[
          "Los centros de costo de esos meses se quedan sin sueldo de referencia.",
          "Si era el último tramo, el anterior vuelve a quedar vigente.",
        ]}
        // Borrar un tramo viejo no es catastrófico y se puede volver a cargar:
        // no vale la pena hacerle tipear el nombre.
        requiereTipear={false}
        accionLabel="Eliminar"
        onConfirmar={async () => {
          if (aBorrar) await borrar(aBorrar);
        }}
      />
    </Card>
  );
}
