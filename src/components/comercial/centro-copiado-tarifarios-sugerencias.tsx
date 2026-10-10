"use client";
import { useRef, useState } from "react";
import { nombreCanalVenta } from "@/lib/canales-venta";
import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  leerPoliticaTarifarios,
  type ContenidoTarifario,
} from "@/lib/centro-copiado-tarifarios-api";
import { normalizarContenido } from "@/lib/centro-copiado-tarifarios-editor";
import {
  sugerirCelda,
  ponerPrecio,
  canalesDelTarifario,
  caidasEntreTramos,
} from "@/lib/centro-copiado-tarifarios-sugerencias";
import type {
  CeldaSimulacion,
  ResultadoCeldaSimulacion,
} from "../../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
import {
  TextoTarifa,
  ErrorTarifa,
  mensajeErrorTarifa,
} from "./centro-copiado-tarifarios-controles";
import styles from "./centro-copiado-tarifarios.module.css";

type Fuente = {
  celda: CeldaSimulacion;
  etiqueta: string;
  resultado?: ResultadoCeldaSimulacion;
};
type Revision = {
  firma: string;
  nuevo: ContenidoTarifario;
  filas: {
    etiqueta: string;
    celda: CeldaSimulacion;
    sugerencia?: ReturnType<typeof sugerirCelda>;
    error?: string;
  }[];
  canales: string;
  caidas: ReturnType<typeof caidasEntreTramos>;
};
const estados = {
  CUMPLE: "Cumple el mínimo",
  REQUIERE_AUTORIZACION: "Requiere autorización",
  BLOQUEADO: "Bloqueado",
  NO_VERIFICABLE: "Sin verificar",
};
export function SugerenciasTarifario({
  contenido,
  tarifarioId,
  fuentes,
  seleccionadas,
  disabled,
  onChange,
}: {
  contenido: ContenidoTarifario;
  tarifarioId: string | null;
  fuentes: Fuente[];
  seleccionadas: Fuente[];
  disabled: boolean;
  onChange?: (c: ContenidoTarifario) => void;
}) {
  const titulo = useRef<HTMLHeadingElement | null>(null);
  const [redondeo, setRedondeo] = useState("");
  const [revision, setRevision] = useState<Revision | null>(null);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function revisar(elegidas: Fuente[]) {
    if (disabled || !onChange || cargando) return;
    setCargando(true);
    setError(null);
    try {
      const nuevo = normalizarContenido(contenido);
      const filas = elegidas.map((f) => {
        try {
          if (!f.resultado) throw new Error("Primero simulá esta celda.");
          const sugerencia = sugerirCelda(
            nuevo,
            f.resultado,
            redondeo.trim() || undefined,
          );
          ponerPrecio(nuevo, f.celda, sugerencia.nuevo);
          return { etiqueta: f.etiqueta, celda: f.celda, sugerencia };
        } catch (e) {
          return {
            etiqueta: f.etiqueta,
            celda: f.celda,
            error: mensajeErrorTarifa(e),
          };
        }
      });
      let canales = "Tarifario nuevo, todavía sin asignaciones por canal.";
      if (tarifarioId) {
        try {
          const politica = await leerPoliticaTarifarios();
          const nombres = canalesDelTarifario(politica.contenido, tarifarioId);
          canales = nombres.length
            ? `Canales que comparten este tarifario en la política guardada: ${nombres.map(nombreCanalVenta).join(", ")}.`
            : "Sin canales asignados en la política guardada.";
        } catch {
          canales =
            "No se pudieron consultar los canales. Revisá la pestaña Canales antes de publicar.";
        }
      }
      setPagina(0);
      const filasAfectadas = new Set(
        filas
          .filter((f) => f.sugerencia)
          .map((f) => `${f.celda.seccion}:${f.celda.fila}`),
      );
      setRevision({
        firma: JSON.stringify({ contenido, fuentes, seleccionadas }),
        nuevo,
        filas,
        canales,
        caidas: caidasEntreTramos(nuevo).filter((a) =>
          filasAfectadas.has(`${a.seccion}:${a.fila}`),
        ),
      });
    } catch (e) {
      setError(mensajeErrorTarifa(e));
    } finally {
      setCargando(false);
    }
  }
  const validas = revision?.filas.filter((f) => f.sugerencia) ?? [];
  const cambio =
    revision != null &&
    revision.firma !== JSON.stringify({ contenido, fuentes, seleccionadas });
  const dinero = (s: string | null) =>
    s == null
      ? "Pendiente"
      : new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: contenido.monedaCodigo,
          maximumFractionDigits: 8,
        }).format(Number(s));
  return (
    <>
      <div className={styles.suggestions}>
        <div>
          <p className={styles.eyebrow}>Propuesta del motor</p>
          <p>Revisá los precios sugeridos antes de llevarlos al borrador.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <TextoTarifa
              etiqueta="Redondear precio hacia arriba"
              valor={redondeo}
              onChange={setRedondeo}
              inputMode="decimal"
              placeholder="Sin redondeo · ej. 10"
              disabled={disabled || !onChange || cargando}
            />
          </div>
          <Button
            variant="outline"
            disabled={disabled || !onChange || cargando || !fuentes.length}
            onClick={() => void revisar(fuentes)}
          >
            <WandSparkles data-icon="inline-start" />
            {cargando
              ? "Preparando revisión…"
              : `Revisar sugerencias (${fuentes.length})`}
          </Button>
          {seleccionadas.length > 0 && (
            <Button
              variant="outline"
              disabled={disabled || !onChange || cargando}
              onClick={() => void revisar(seleccionadas)}
            >
              Revisar selección ({seleccionadas.length})
            </Button>
          )}
        </div>
        <ErrorTarifa error={error} />
      </div>
      <Dialog
        open={!!revision}
        onOpenChange={(v) => {
          if (!v) setRevision(null);
        }}
      >
        <DialogContent
          initialFocus={titulo}
          className="sm:max-w-5xl max-h-[90dvh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle ref={titulo} tabIndex={-1}>
              Revisar sugerencias del motor
            </DialogTitle>
            <DialogDescription>
              {validas.length} precios para aplicar al borrador ·{" "}
              {revision ? revision.filas.length - validas.length : 0} celdas
              omitidas. Precios{" "}
              {contenido.composicion.iva === "INCLUIDO"
                ? "con IVA incluido"
                : "más IVA"}
              . La preparación se descuenta de la propuesta cuando se cobra
              aparte; el mínimo se aplica al pedido.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {revision?.canales} Las versiones publicadas conservan sus precios.
          </p>
          {cambio && (
            <Alert variant="destructive">
              <AlertTitle>El borrador cambió</AlertTitle>
              <AlertDescription>
                Cambió el contenido, la selección o una simulación. Cerrá esta
                revisión y generá una nueva propuesta.
              </AlertDescription>
            </Alert>
          )}
          {!!revision?.caidas.length && (
            <Alert>
              <AlertTitle>Revisá los saltos entre tramos</AlertTitle>
              <AlertDescription>
                {revision.caidas.length} fronteras de tramo reducen el total al
                aumentar el volumen. Incluye preparación y mínimo. Revisá las
                filas marcadas antes de publicar.
              </AlertDescription>
            </Alert>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combinación / tramo</TableHead>
                <TableHead>Actual</TableHead>
                <TableHead>Sugerido</TableHead>
                <TableHead>Margen resultante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revision?.filas
                .slice(pagina * 20, (pagina + 1) * 20)
                .map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-normal max-w-80">
                      {f.etiqueta}
                      {revision.caidas.some(
                        (a) =>
                          a.seccion === f.celda.seccion &&
                          a.fila === f.celda.fila,
                      ) && (
                        <div className="mt-2">
                          <Badge variant="destructive">
                            Revisar salto de tramo
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {f.sugerencia ? dinero(f.sugerencia.anterior) : "—"}
                    </TableCell>
                    <TableCell>
                      {f.sugerencia ? dinero(f.sugerencia.nuevo) : "Se omite"}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-2">
                        {f.error && <span>{f.error}</span>}
                        {f.sugerencia?.controles.map((c, j) => (
                          <div
                            key={j}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <Badge
                              variant={
                                c.estado === "CUMPLE"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {c.cobertura} · {estados[c.estado]}
                            </Badge>
                            <span>
                              {c.porcentaje == null
                                ? "Sin porcentaje"
                                : `${c.porcentaje}%`}
                            </span>
                          </div>
                        ))}
                        {f.sugerencia?.avisos.map((a) => (
                          <p key={a} className="text-xs text-muted-foreground">
                            {a}
                          </p>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          {revision && revision.filas.length > 20 && (
            <div className="flex justify-end items-center gap-3">
              <Button
                variant="outline"
                disabled={!pagina}
                onClick={() => setPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <span>
                {pagina + 1} / {Math.ceil(revision.filas.length / 20)}
              </span>
              <Button
                variant="outline"
                disabled={(pagina + 1) * 20 >= revision.filas.length}
                onClick={() => setPagina(pagina + 1)}
              >
                Siguiente
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            El margen es el del pedido de referencia. Aplicar una propuesta no
            autoriza pedidos con margen insuficiente. Los costos deben volver a
            comprobarse al cotizar el pedido real.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevision(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!validas.length || cambio || disabled || !onChange}
              onClick={() => {
                if (revision && !cambio && !disabled && onChange) {
                  onChange(revision.nuevo);
                  setRevision(null);
                }
              }}
            >
              Aplicar {validas.length} precios al borrador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
